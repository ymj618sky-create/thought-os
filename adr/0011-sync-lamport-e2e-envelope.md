# ADR-0011: 多设备同步采用 Lamport 时钟 + 确定性裁决 + E2E 加密信封



> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: Accepted
**Date**: 2026-07-30
**领域**: 数据主权 / Sync
**关联文档**: `specs/protocols/Sync_Protocol.md`（协议定义）、`src/sync/engine.ts`（实现）、`src/sync/transport.ts`（传输层）、`src/storage/SqliteStorage.ts`（操作日志与合并）、`src/util/device.ts`（设备标识）、`adr/0007-sharing-boundary-phase1-none.md`（边界：不做多用户）、`adr/0010-encryption-at-rest-app-layer-aes-gcm.md`（加密层，Sync 与之叠加）、Constitution Article 4（数据主权）

## Context

`specs/protocols/Sync_Protocol.md` 自 Phase 1 之初就定义了 Sync 的核心约束——同一用户多设备间的思想数据同步，端到端加密，服务器不可读明文。ADR-0007 划清了"不做多用户共享"的边界。

但协议文档标注"Phase 1 不实现"，而实际代码已在 Phase 1 末尾落入了 `SyncEngine`、`LocalFileTransport`、`HttpTransport`、`SqliteStorage.__sync_ops` 操作日志等完整实现。这个 gap 本身需要解释：不是"Phase 1 需要 Sync"，而是"Phase 1 需要 Sync 的**工程骨架**先落地，否则加密（`DataCodec`）的集成路径缺失一个验证锚点"。

Sync 的核心难题：两台设备**同时**修改同一条 Thought 的 `status`（一台确认此 Thought 为 `active`，另一台把它 `archived`），合并后必须收敛到同一个值——且服务端不能替用户做这个判断（因为服务器不持有密钥、读不到内容）。这就是"确定性冲突裁决"的来源。

## Decision

### 1. 操作日志 + Lamport 时钟（非 wall-clock timestamp）

每台设备维护一个本地 Lamport 时钟（单调递增计数器），每次本地写操作推进一次：

```
本地写 → Lamport = max(local_lamport, max(existing_lamports)) + 1
       → 写入 __sync_ops(entity_type, entity_id, lamport, device_id, op, data, is_remote=0)
```

**选择 Lamport 时钟而非 wall-clock timestamp 的理由**：

- 设备时钟可能不同步（时区、NTP 偏差、手动调时间）——用 timestamp 做合并会因时钟偏差产生不可复现的结果
- Lamport 保证因果序：若操作 A 发生在操作 B 之前，A.lamport < B.lamport。反向不一定成立（并发操作可以 lamport 相等），但提供了偏序
- 实现零依赖——纯整数计数器，不需要 NTP 或向量时钟

**代价**：Lamport 相等时无法判断因果先后（两个并发编辑分不清谁先谁后）。需要用 tiebreaker 收尾。

### 2. 确定性冲突裁决：高 Lamport 胜 → 相等则 device_id 大者胜

```typescript
resolve(remoteOp):
  localLamport > remoteLamport  → skip (保留本地)
  localLamport < remoteLamport  → apply (采用远端)
  localLamport == remoteLamport → higher_device_id wins
```

**这个算法选为默认而非 Protocol 推荐的"多层级版本→时间戳→设备"的理由**：

- Protocol 推荐的三层 tiebreaker（`version → confirmed_at → device_id`）依赖**实体内部字段**——但 `version` 和 `confirmed_at` 在 encrypted `data` 列里，服务器在执行 Sync 中转时读不到
- 冲突裁决必须在**持有密钥的客户端**侧执行（Protocol 明确要求：服务端不做内容合并）。但 Lamport + device_id 裁决可以在 `applyRemoteOp` 之前就完成——不需要先解密 `data` 列
- 简化了代码路径：`resolve()` 只依赖 `__sync_ops` 的元数据，不需要先 `decode` 两条记录再做比较

**与 Protocol 的偏差说明**：Protocol §1 推荐的三层策略是"推荐方案，最终实现前需再确认"。本条 ADR 构成那个"再确认"——采纳了比 Protocol 更简单的方案，理由如上。Protocol 文档应随之更新，不能保留已被实现否决的推荐。

**Lamport 相等的情形在实践中的频率**：两台设备各对同一个实体做好几次操作、中间从未 sync——这是"离线 + 多设备 + 频繁编辑同一实体"的三重叠加，在 Thought OS 的场景中概率很低（因为大多数实体的演化是追加式/supersede 链，不是原地修改）。真正的"原地修改"只有 `status` 流转——而 status 流转几乎都是用户单点触发。

### 3. E2E 加密信封：共享同步口令 → AES-256-GCM

```
信封结构（SyncEnvelope）:
{
  envelope_id: uuid,
  from_device: "device-a",
  created_at: "ISO8601",
  iv: base64(12 字节随机),
  ciphertext: base64(AES-256-GCM(JSON({ops: [...]}), key=syncKey, iv))
}
```

- **同步密钥派生**：`SyncEngine.deriveSyncKey(passphrase)` = Argon2id(共享口令, 固定盐 `mirror-sync-v1-salt`)
- 固定盐是**故意**的——Sync 要求两台设备用同一个口令派生出**相同的**密钥（而 at-rest 加密的盐是随机的，因为每台设备独立 unlock）
- 同步密钥与 at-rest DEK 完全独立——Sync 只保护"传输中的操作日志"，不接触 at-rest 的 DEK
- AES-256-GCM 提供 authenticated encryption：tag 校验失败 = 篡改或口令不匹配，拒绝合并

**为什么 Sync 不重用 at-rest 的 DEK**：at-rest DEK 是设备本地的秘密——两台设备各自 `mirror init` 会产生不同的 DEK。Sync 需要的是**跨设备共享**的秘密，所以必须独立于 DEK。同步口令是一个"群体密钥"——所有知道它的设备可以互相解密 Sync 操作日志。

### 4. 传输层抽象（Transport），与存储分离

```typescript
interface SyncTransport {
  push(env: SyncEnvelope): Promise<void>;
  pull(): Promise<SyncEnvelope | null>;
}
```

两个实现：
- **`LocalFileTransport`**：读/写本地 JSON 文件。作为 mock 远端，供开发测试两手演练收敛。也是 Phase 1 默认（无 Sync 服务端时）
- **`HttpTransport`**：POST `/sync/push` / GET `/sync/pull`。骨架已完备，服务端未部署

**Transport 不接触明文**：信封已是 AES-GCM 密文。Transport 只搬运 base64 字符串。这是一个硬边界——服务端即使被入侵，也只能看到 `{envelope_id, from_device, iv, ciphertext}`。

### 5. 分离 push_cursor / pull_cursor

操作日志表 `__sync_ops` 用两个独立游标而非一个全局游标：

- `push_cursor`：自上次 push 以来本地产生的最大 lamport（下一次 push 从此之后开始）
- `pull_cursor`：自上次 pull 以来远端已发送的最大 lamport（下一次 pull 跳过已处理的）

**分离的理由**：push 和 pull 是独立操作——用户可以只 push 不 pull（单向上传）、或反向。单游标会使"push 时意外消费了远端操作"或"pull 后 push 游标倒退"。

### 6. 不做 CRDT

Protocol 明确：本模型的演化语义天然接近"追加不改"（Evidence 不可变、Thought/Relation 通过 supersede 链演化）→ 绝大多数操作是创建新实体而非修改旧实体。CRDT（如 RGA、LWW-Register 等）的完整操作交换为这一个"天然 grow-only"的数据模型是过度设计。

真正的原地修改（`status` 流转）用 Lamport + 确定性裁决收尾。两个设备对同一条 Thought 并发改 `status` 的概率极低——且即使发生，Lamport tiebreaker 至少保证**所有设备收敛到相同值**（这点比"用 wall-clock 导致两台设备各有一个版本"正确得多）。

## 备选方案（被否决的）

### A. 全量快照同步（非增量）

每次 sync = 导出全库 JSON → 加密 → 推送。**否决理由**：
- 数据量随使用积累线性增长，每次 sync 传输全部数据
- 无法做增量合并——收到快照只能"全量覆盖"或"全量冲突"，没有逐操作粒度的裁决
- Protocol 明确要求增量操作日志（§3.3）

### B. 服务器端冲突合并

让 Sync 服务端解密信封、比较内容、做语义合并。**否决理由**：
- 直接违反 Encryption_Policy.md（服务器不得获得明文）和 Article 4（思想属于用户）
- Protocol 明确："合并逻辑必须发生在持有密钥的客户端"（§2 推论）

### C. 完整操作交换 CRDT（如 Automerge / Yjs）

导入一个 CRDT 库处理所有冲突。**否决理由**：
- Thought OS 的 6 实体数据模型有明确的 schema 与跨字段约束（`constraints.ts`）——通用 CRDT 不理解这些约束
- 大多数 CRDT 库针对"协作文档编辑"（富文本、字符级操作）优化——不是"结构化思想图谱的同步"
- 引入 ~100KB+ 的依赖（CRDT 库 + 序列化格式）与 Article 0 的原则矛盾

### D. 设备发现 / 配对流程

两台设备如何"发现彼此"、如何安全交换同步口令。**不在本条 ADR 范围**：Sync 只负责"已有传输信道和同步密钥之后"的增量合并。设备配对是独立问题（QR 码、手动输入口令、NFC），另行定义。

## 7. Ownership Boundary（2026-08-10 补充，配合 Step 8 Identity Boundary）

本 ADR 原决策聚焦"如何确定性同步"，但未显式声明 Sync 的**所有权边界**。在 Identity Boundary 闭环（Recovery Authority → Device Authorization → Runtime Access，见 `specs/architecture/Alpha_Identity_Model_v0.1.md` 与 `adr/0026`）之后，特补充以下边界，使 Sync 不悄悄把 Device 抬回 Ownership 位置：

### 7.1 同步所有者 = User（Q1）

Sync 的所有者是 **User**，不是 Device A / Device B / Cloud / Server Account。设备经 Step 8 的 Device Authorization 获得"用户授予的 capability"后，才有资格作为 `authorized replica executor` 参与 Sync。设备**执行** Sync，但**不拥有** Sync 内容；一台设备撤销不影响 User 对数据的所有权，也不影响其他设备的授权。

### 7.2 同步对象 = Owned Cognitive Events 的传输投影（Q2）

本 ADR 的 `__sync_ops` 操作日志在语义层重新定位为 **Owned Cognitive Events（Reflection Event / Observation Event / Decision Frame Event / Knowledge Lifecycle Event，见 `adr/0015`）的增量传输投影**，而非真相源。SQLite 表、操作日志、UI feed 均为事件的投影，可重建、可丢弃；投影不得反向覆盖事件本身（`adr/0015` 约束：projection → entity 写入被禁止）。

### 7.3 冲突权威边界（Q3）：Sync conflict ≠ Truth conflict

Lamport + `higher_device_id wins` tiebreaker 解决的是**投影级分歧的确定性收敛**（所有设备最终看到同一份一致状态，避免 wall-clock 导致不可复现合并）——它**仅用于收敛确定性，不表达任何认知权威**。`device_id` 在裁决中不得被理解为"设备更有资格决定 truth"。

当冲突触及"某个 Thought 是否真实成立 / 是否应存在"等**认知级分歧**时，Sync 不得自行裁决，必须上浮至 User / Resolver（认知权威层，见 `adr/0021`/`adr/0022`）。Sync 只标记 `needs_user_resolution`，不调用 LLM 判定"哪个 thought 更好"，服务端不解密信封做语义合并。

### 7.4 设备参与 Sync 的前置

未来 Sync Engine 接入顺序必须是 `User ownership → Device Authorization Check → Sync Engine Execution → Local Projection`，与 Step 8.2 Adapter 的 ownership-first 原则同构；而非 `Sync → check permission`。

## Consequences

### 正向

- **与 Protocol 的核心约束一致**：E2E 加密、增量操作日志、服务端不可读明文——三条纪律全部守住
- **确定性收敛**：Lamport + device_id tiebreaker 保证所有设备看到相同状态（不像 wall-clock timestamp 可能因时钟偏差导致不可复现的合并结果）
- **传输层可插拔**：`LocalFileTransport` 提供零依赖的开发验证路径；`HttpTransport` 是服务端部署后的一键切换
- **零额外依赖**：AES-256-GCM 用 Node 内置 `crypto`，Argon2id 复用 `CryptoProvider.deriveKey`（已在 at-rest 加密的依赖中）
- **分离游标支持非对称同步**：可以 push-only（备份到另一台设备）、pull-only（从备份恢复）、或双向

### 负向 / 风险

- **Lamport 相等 + 同 device_id → 采用远端是幂等操作**，不会标记为 conflict。但当远端和本地**内容确实不同**时（同设备通过不同传输路径收到两个版本），差异被静默覆盖（数据没有丢，但旧状态不可追溯）。当前概率极低（同设备不会通过两个路径 sync），但应在日志中记录
- **Protocol 文档与实现脱节**：`Sync_Protocol.md` 标注"Phase 1 不实现"且推荐的冲突策略（version → timestamp → device_id）已被实现否决。Protocol 应更新以反映实际决策，或者本 ADR 成为 Protocol 之上的权威（遵循 Authority Chain：ADR > 已过时的 Protocol 推荐）
- **同步口令的安全强度**：默认 `dev-insecure-sync-passphrase` 是明文的开发占位符——任何知道这个字符串的人都能解密同步信封。生产环境必须强制用户设置高强度口令（≥20 字符、含大小写与数字），并在 `mirror doctor` 中检测默认值并告警
- **重放攻击**：当前没有 envelope sequence number 或 nonce——攻击者可以截获旧的 push 信封并在 pull 时重新注入。这是"服务端被入侵且攻击者保存了历史信封"的场景。缓解方案（Phase 2）：信封内加 lamport range 或 monotonic counter，接收方拒绝重复 lamport
- **Lamport 溢出**：JavaScript number 是 53 位整数。如果用户在一台设备上做了 9e15 次操作（人类不可能达到），Lamport 会溢出。Phase 1 不需要处理——但应在 `nextLamport()` 加一个 assert
- **Sync + at-rest 加密的叠加未测试**：Sync 的 `applyRemoteOp` 直接调用 `storeRecord`——如果本地 `DataCodec` 是加密的，远端传来的 op.data 是明文（加密信封已解开），put 时会自动经本地 `encode` 加密。这是正确的，但这个流程没有集成测试
- **无 tombstone 压缩**：被删除的实体在 `__sync_ops` 中留下 `op='remove'`，但没有机制清理旧操作日志。长期使用后 `__sync_ops` 表会无限增长。Phase 2 需要 periodic compaction（保留最近 N 天或合并连续的同实体操作）
- **断线重连的效率**：如果两台设备离线编辑了很长时间（各自积累数百条操作），sync 时 `__sync_ops` 表按 lamport 升序逐条处理——O(n) 逐个实体——包含已 supersede 的旧状态。Phase 2 可以优化为"每个实体只传输最终状态"（需要更复杂的状态摘要协议）

### 后续行动

1. **更新 `Sync_Protocol.md`**：移除"Phase 1 不实现"标注，或在"实现状态"节注明实际采用的冲突策略与 Protocol 推荐方案的偏差及理由
2. **Sync + 加密集成测试**：一台设备加密 at-rest + 另一台加密 at-rest → 两台用相同同步口令 sync → 验证两端看到相同明文
3. **默认同步口令检测**：`mirror doctor` 检测到 `MIRROR_SYNC_PASSPHRASE` 为默认值时输出 fail（而非 ok/warn）——"dev-insecure" 在生产环境中是安全漏洞
4. **重放保护**（Phase 2）：信封内加 monotonic envelope counter，接收方拒绝重复序列号
5. **操作日志压缩**（Phase 2）：合并同一实体的连续操作（保留最终状态 + tombstone），定期清理超过 N 天的旧日志
