# Cloud Sync Server Contract v0.1

> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: ACCEPTED DESIGN — CLOUD SYNC SERVER CONTRACT（冻结实现契约，非代码）
**Date**: 2026-08-14
**领域**: 多设备同步 / 云端服务端契约 / 认知与数据主权边界
**上游**:
- `adr/0026-secure-identity-recovery-multidevice-ownership.md`（四层边界，ACCEPTED）
- `adr/0027-recovery-secret-as-continuity-trust-root.md`（Recovery 信任根，ACCEPTED IMPLEMENTATION CONTRACT）
- `specs/architecture/Sync_Ownership_Boundary_v0.1.md`（所有权边界，FROZEN — BOUNDARY CONTRACT）
- `src/sync/engine.ts` / `src/sync/transport.ts`（现有 Sync Engine / Transport 骨架）
**下游**:
- 5.3 Cloud Sync Server 实现
- 5.4 `HttpTransport` 接线（替换 `MIRROR_SYNC_KEY` 临时骨架）
- 5.5 Bootstrap / multi-device E2E
- 5.6 三端真实同步验证

---

## §0 本文档只回答什么

> **Cloud Sync Server 必须如何存储、分发、鉴权、游标化密文信封，且绝不成为数据权威。**

本文档**不实现**服务端，不写任何代码，不重新设计 `SyncEngine` 的合并算法（继承 `Sync_Ownership_Boundary_v0.1.md §8`）。它把现有 `engine.ts` / `transport.ts` 的客户端契约与 ADR-0026/0027 的信任模型，冻结为服务端必须遵守的硬契约。

演化链（本轮收口锚点）：

```
ADR-0026 → ADR-0027 → Recovery implementation → Recovery UI/E2E → Sync audit → (本文档) Cloud Sync Contract → Server
```

---

## §1 Purpose & Scope

**Purpose**: 定义 Cloud Sync Server 的行为契约，使多台授权设备能在**服务端不可读明文**的前提下，增量收敛同一份本地投影，并支持新设备从云端 bootstrap。

**In Scope**:
- 服务端存储模型（不可变同步日志）
- 设备鉴权如何由 Identity Root 派生（不泄露 Recovery Secret）
- Push / Pull / Bootstrap 端点契约
- 游标语义与幂等
- 服务端非权威不变量（MUST NOT 列表）
- 元数据可见性边界

**Out of Scope**（继承 ADR-0027 §3 与 `Sync_Ownership_Boundary_v0.1.md §8`）:
- 冲突裁决算法（客户端 `SyncEngine` 职责，见 §12）
- Snapshot 优化（v0.1 仅 full operation bootstrap，见 §9）
- 账号系统 / QR 配对 / Cloud 持明文密钥
- 认知级冲突上浮 UI（待 ADR-0023/0024 由 Observation 驱动）

---

## §2 Relationship to ADR-0026 / ADR-0027

本文档**继承并强化**两条 ADR 的边界，不引入与原语相关的耦合：

- **ADR-0026 Decision 2**：解锁失败不覆盖、四层边界（Identity / Encryption / Device Auth / Sync）分离。服务端契约不得把任何一层合并进"云端账号"。
- **ADR-0027 Decision 1/2**：Recovery Secret 是跨设备连续性**唯一信任根**；三路派生（Identity Root / Container DEK recovery / Sync authority）职责分离。**本文档重申：Recovery Secret 永不出本机、永不作为网络认证秘密**（见 §3、§4）。

> 契约只冻结"建立/授权信任关系"，**不冻结具体密码学原语**（ADR-0027 §4 已声明）。服务端鉴权可用任意 device credential 方案，只要满足 §4 的不变量。

---

## §3 Trust Model（A 原则 — 冻结）

**核心禁令**:

```
Recovery Secret MUST NOT become a Sync Bearer Token.
Recovery Secret MUST NOT transit the network in any form (neither raw nor derived-as-credential).
```

现有 `container.ts:367` 的：

```ts
Authorization: `Bearer ${process.env['MIRROR_SYNC_KEY'] ?? ''}`
```

**MUST be treated as a temporary dev scaffold only**（`transport.ts` 的 `HttpTransport` 骨架同理）。它不得在正式 Cloud Sync 中成为 device 鉴权机制。

**正确的信任派生链（冻结）**:

```
Recovery Authority
      │   建立 / 恢复身份
      ↓
Identity Root                （用户跨设备身份根；recovery material 不落盘原始 secret）
      │
      ├── Device A credential   （具体设备访问 Sync 服务的凭证，由 Root 授权派生）
      ├── Device B credential
      │
      └── Sync Key             （仅用于加密同步 payload，见 §5）
```

各角色职责（硬分隔）:

| 角色 | 职责 | 是否触网 | 泄露后果 |
|---|---|---|---|
| Recovery Secret | 恢复用户身份 / 恢复授权 | **否** | 需同时丢失+无法恢复身份；但**不**直接给云端访问 |
| Identity Root | 跨设备身份根 | 否（仅本地派生） | 同 Recovery 域，不直接授云 |
| Device Credential | 具体设备访问 Sync 服务的凭证 | **是**（作为 Bearer/签名） | 仅该设备被吊销可解，不影响 Recovery/其他设备 |
| Sync Key | 加密同步 payload | 否（仅客户端 seal/open） | 仅该同步域密文可读，不授云访问 |
| Cloud | 存储/分发密文 | — | 无明文、无裁决权（见 §13） |

**推论（MUST）**:
- Device Credential 的签发/吊销**必须**经由 Identity Root（即 ADR-0026 的 Device Authorization 层），不得由用户手动复制同一 token 到多设备冒充多 credential。
- Cloud 看到的鉴权主体 = Device Credential，**不是** Recovery Secret、不是 Identity Root 明文、不是用户邮箱/手机号等平台 Principal（ADR-0026 禁止云账号 Principal）。

---

## §4 Identity / Device Authorization

**前置**: 设备参与 Sync 前，**必须**持有由 Identity Root 授权的 Device Credential（`Sync_Ownership_Boundary_v0.1.md §7`：authorization → sync execution，顺序不可反）。

**契约**:

1. **MUST**: 服务端在 `push` / `pull` / `bootstrap` 任一端点，先校验 Device Credential 合法性（签名/短期 token，方案不限），失败返回 `401` / `403`。
2. **MUST**: 服务端将每个信封与其来源 `device_id` 绑定（信封内的 `from_device` 字段**不可信**，服务端必须以鉴权后的 Device Credential 对应的 device 身份记录，防止客户端伪造 `from_device` 操纵 Lamport tiebreaker）。
3. **MUST NOT**: 服务端以 Recovery Secret 或 Sync Key 作为鉴权凭证。
4. **MUST**: 支持 Device Credential 吊销（revoke）；吊销后该 device 的后续请求 `401`，已存密文保留（不影响其他设备/用户所有权）。
5. **MUST NOT**: 服务端将 Device Credential 与"用户账号"等价绑定（禁止平台收编身份，ADR-0026）。

> device_id 的本地解析仍走 `util/device.ts:resolveDeviceId`，但**服务端侧身份以鉴权后的 credential 为准**，本地自报 `device_id` 仅作信封负载，不授信任。

---

## §5 Encrypted Sync Envelope

继承 `transport.ts:13` 的 `SyncEnvelope` 结构，并明确加密边界：

```ts
interface SyncEnvelope {
  envelope_id: string;        // 服务端可见（见 §14）
  from_device: string;        // 服务端可见，但服务端以鉴权身份覆写/校验（§4.2）
  created_at: string;         // 服务端可见（见 §14）
  iv: string;                 // base64，密文部分
  ciphertext: string;         // base64，AES-256-GCM 密文（明文记录 JSON）
}
```

**加密契约**:
- **MUST**: payload（`ciphertext`）由客户端 `SyncEngine.seal` 用 AES-256-GCM 加密，key = `SyncEngine.deriveSyncKey(passphrase)`（salt 固定 `mirror-sync-v1-salt`）；服务端**绝无**该 key。
- **MUST**: Sync Key 来源遵循 ADR-0027 Decision 2——优先 `MIRROR_SYNC_PASSPHRASE`，否则从本机已解开的容器密钥派生；**不得**从 Recovery Secret 直接派生并跨网传输。
- **MUST NOT**: 服务端解密、 inspect、或修改 `ciphertext` / `iv`（见 §13）。
- **MUST**: `envelope_id` 由客户端生成且全局唯一（用于幂等去重，§11）。

---

## §6 Server Storage Contract（B 原则 — 冻结）

**核心禁令**: 服务端**不得**是"单信封覆盖写"（现有 `LocalFileTransport` 的 `mirror.sync.json` 覆盖写**仅限测试 transport，不得作为 Cloud 模型**）。

**服务端存储模型（MUST）**:

```
Identity / account scope
      │   （由 Device Credential 鉴权，不直接等于 Recovery/用户平台账号）
      ↓
immutable sync op log
      │
      ├── append-only / idempotent operation store
      ├── deduplicate by (envelope_id)
      ├── ordered by server-assigned sequence (NOT Lamport)
      └── filterable by cursor
```

**契约条款**:

1. **MUST**: 服务端以**不可变追加日志**保存每个合法信封；收到即持久化，不覆盖历史。
2. **MUST**: 服务端按 `envelope_id` 去重（同 id 重复 push = 幂等成功，不创建重复记录，见 §11）。
3. **MUST**: 服务端为每个存储记录分配一个**服务端序列号 `seq`**（单调递增、按接收顺序），与 Lamport 解耦（Lamport 是设备本地时钟，非全局有序，见 §10）。
4. **MUST NOT**: 服务端对任何信封做业务级 conflict resolution、merge、或"选赢家"。
5. **MUST**: 服务端可按 device / account scope 分桶存储，使不同 Identity Root 的数据隔离。
6. **MUST**: 存储对密文负责（持久化、可用、按游标返回），不对明文负责。

---

## §7 Push Contract

**端点**: `POST /sync/push`（替换 `transport.ts:53` 的骨架 URL）

**请求**: 单个 `SyncEnvelope`（body = JSON 信封），带 Device Credential 鉴权头。
**服务端行为（MUST）**:
1. 校验 Device Credential（§4.1）→ 失败 `401`/`403`。
2. 以鉴权后的 device 身份覆写/校验 `from_device`（§4.2）。
3. 校验 `envelope_id` 唯一性（§11）；重复则幂等 `200` 已存在。
4. 分配 `seq`，追加进不可变日志（§6）。
5. 返回 `202 Accepted` + `{ seq, received_at }`（不返回解密内容）。

**客户端行为（继承 `engine.ts:43`）**:
- `push()` 取 `getLocalOpsSince(push_cursor)` 封一个信封 → `transport.push(env)` → 成功推进 `push_cursor = max(lamport)`。
- **MUST NOT**: 客户端在 push 失败后静默丢弃；应进入重试（见 §15）。

---

## §8 Pull Contract（E 原则 — 冻结）

**端点**: `GET /sync/pull?cursor=<seq>&limit=<n>`（替换 `transport.ts:61` 的"拉一个"骨架）

**核心禁令**: 当前 `pull()` 只取"一个信封"仅适合本地演练，**真实多端必须批量**。

**契约（MUST）**:
1. **MUST**: `pull(cursor, limit)` 返回**批量**信封数组 `[SyncEnvelope, ...]`，按服务端 `seq` 升序，且 `seq > cursor`，最多 `limit` 条。
2. **MUST**: 响应含 `next_cursor`（= 本次返回的最大 `seq`，或 `null` 表示无更多）。
3. **MUST NOT**: 服务端把"最大 Lamport"偷换为全局游标——Lamport 是设备本地时钟，不是天然全局有序序列（见 §10）。游标**必须**基于服务端 `seq`。
4. **MUST**: 返回的信封**不含**服务端任何业务加工；纯密文透传。
5. **客户端行为（继承 `engine.ts:54`）**: `pull()` 逐条 `open()` → 按 Lamport 排序 → `resolve(op)` 确定性合并 → 仅推进本地 `pull_cursor`（Lamport 偏序，用于客户端合并，与服务端 `seq` 游标正交）。
6. **MUST**: 若 `limit` 未提供，服务端使用合理默认（如 100），并始终返回 `next_cursor` 以支持分轮拉取。

---

## §9 Bootstrap Contract（C 原则 — 冻结）

**核心**: 新设备是 Cloud Sync 的核心用例，**不能只有 `pull since cursor`**。

**流程（MUST）**:

```
new device
   ↓  authenticate device (Device Credential, §4)
   ↓  bootstrap request
   ↓  server returns full available sync history for that Identity scope
   ↓  local SyncEngine replays operations → rebuilds local state
   ↓  establishes local cursor (Lamport / pull_cursor)
```

**契约条款**:
1. **MUST**: 服务端提供 `GET /sync/bootstrap`（或 `pull` 以 `cursor=0` 语义）返回该 Identity scope 下的**完整可用同步历史**（全量 op replay）。
2. **v0.1 决策**: 采用 **full operation bootstrap**（全量 op replay），**不引入 snapshot 优化**。理由：现有 `SyncEngine` 本就是 operation-based（`engine.ts` 逐条 `applyRemoteOp`），全量 replay 对现有模型改动最小、风险最低；snapshot 留作未来优化（Non-Goal，§16）。
3. **MUST**: bootstrap 返回的数据与 `pull` 同源（同一不可变日志），仅游标起点不同（bootstrap = `seq` 从最小可用开始）。
4. **MUST**: 新设备 replay 完成后，本地 `SyncEngine` 重建状态，建立本地 `pull_cursor`；后续增量走 `pull(cursor=next_cursor)`。
5. **MUST NOT**: 服务端在 bootstrap 时"挑选"或"合并"历史（仍是纯透传密文，§13）。

---

## §10 Cursor Semantics（E 原则 — 明确）

**两条正交游标（MUST 区分）**:

| 游标 | 所有者 | 语义 | 用途 |
|---|---|---|---|
| 服务端 `seq` | Cloud | 按接收顺序的全局单调序列 | Pull/batch 分页、去重边界 |
| 本地 `push_cursor` | Client | 本设备已 push 的最大 Lamport | 增量 push 起点 |
| 本地 `pull_cursor` | Client | 本设备已合并的最大 Lamport | 客户端合并偏序起点 |

**关键语义（MUST）**:
- 服务端返回的游标 = `seq`（接收序），**不是** Lamport。
- 客户端拉取成功后推进的"可以安全继续拉取的位置" = 响应中的 `next_cursor`（seq 语义）。
- **MUST NOT**: 把"最大 Lamport"当作全局 cursor 返回给客户端——Lamport 是设备本地时钟，设备 A 的 Lamport 与设备 B 的 Lamport 无天然全局序；只有服务端 `seq` 表达"这些记录已被成功交付"。
- 本地 `pull_cursor`（Lamport）只服务于客户端确定性合并（Lamport + device_id tiebreaker，继承 `engine.ts:76`），**不向上同步给服务端**。

---

## §11 Idempotency

**MUST**:
- `push` 以 `envelope_id` 去重：重复 `envelope_id` 的 push 返回 `200`（已存在），不重复存储、不报错。
- `pull` / `bootstrap` 天然幂等：同一 `cursor` 重复请求返回相同数据集；客户端 `applyRemoteOp` 以 `(entity_type, entity_id, lamport, device_id)` 主键 `ON CONFLICT DO NOTHING`（`SqliteStorage.ts:314`），重复合并无副作用。
- 服务端 `seq` 分配与去重之间**MUST**在事务内完成，避免并发重复。

---

## §12 Conflict Resolution Boundary

继承 `Sync_Ownership_Boundary_v0.1.md §5`:

- **MUST**: 所有冲突裁决在**客户端** `SyncEngine.resolve(op)` 完成（Lamport + device_id tiebreaker，确定性收敛）。
- **MUST NOT**: 服务端解密信封、做语义合并、或"选赢家操作"。
- **MUST**: `device_id` tiebreaker 仅用于**投影级收敛确定性**（所有设备最终一致），**不表达认知权威**（§5 of 前置文档：`higher_device_id wins` 不得作为 truth 裁决）。
- **认知级分歧**（"这个 thought 是否 true"）：客户端标记 `needs_user_resolution`，上浮 User / Resolver（ADR-0021/0022）；Sync 层不裁决。

---

## §13 Server Non-Authority Invariants（D 原则 — 冻结，硬约束）

**Cloud MAY**:
- store encrypted envelopes
- deduplicate by envelope_id
- order transport records by seq
- filter by cursor / device scope
- authenticate devices (via Device Credential, §4)

**Cloud MUST NOT**:
- decrypt payload
- inspect `record.data` / `ciphertext` 明文
- resolve conflicts
- choose winning operation
- mutate encrypted payload (iv / ciphertext)
- become source of truth

**最终裁决永远在客户端**:

```
Cloud
  ↓  encrypted ops (哑存储)
SyncEngine
  ↓  Lamport + device_id
local state
```

这与 ADR-0020（数据所有权 / 密钥托管分离）、ADR-0027（信任根授权不授云权威）完全一致。任何把 Cloud 变成事实仲裁者的实现**MUST 被拒绝**。

---

## §14 Metadata Visibility

**现实**: 当前 `SyncEnvelope` 的 `envelope_id` / `from_device` / `created_at` 在密文之外可见（审计已确认）。这是**设计选择，不是实现便利的副产品**——必须显式声明。

**可见性边界（MUST 声明）**:
- **Cloud MAY see**: `envelope_id`（去重/追踪）、`from_device`（鉴权后身份，§4.2）、`created_at`（接收时间）、服务端 `seq`、device scope 标识。
- **Cloud MUST NOT see**: `iv` / `ciphertext` 明文、`entity_type` / `entity_id` / `lamport` / `data` 的业务含义（全在密文内）。
- **设计选择记录**: v0.1 接受 metadata 泄露（device 标识 + 时间 + 信封 id）作为代价，换取无服务端解密的简单模型。**不要求 v0.1 解决**，但禁止以"实现方便"为由悄悄新增可见明文字段。

**未来可选项（Non-Goal，不阻塞 v0.1）**: 信封外层再包一层 metadata 加密 / 服务端 blind 存储。若未来要做，走独立变更，不修改本文档基线。

---

## §15 Failure / Retry Semantics

**MUST**:
- `push` 失败（网络/5xx）→ 客户端保留未确认 op，下次 `push` 重试；因 `envelope_id` 幂等（§11），重复 push 安全。
- `pull` 失败 → 客户端不推进 `next_cursor`，整批重试；因 `applyRemoteOp` 幂等，重复合并安全。
- 服务端 `500` 必须**不丢已持久化数据**：已分配的 `seq` + 已存信封要么全成功要么全回滚（事务，§11）。
- 客户端**MUST NOT** 因单次失败放弃同步或本地删除待推 op。
- 网络分区期间：各设备本地继续工作（离线优先），恢复后增量收敛（Lamport 确定性保证最终一致）。

---

## §16 Explicit Non-Goals

v0.1 **不**包含：
- Snapshot / 增量压缩优化（仅 full operation bootstrap，§9）
- 服务端 metadata 加密（§14 已声明接受现状）
- 冲突 resolver 产品 UI（待 ADR-0023/0024）
- 账号系统 / QR 配对 / Cloud 持明文密钥
- 任何把 Recovery Secret 或 Sync Key 暴露给网络的设计
- 服务端侧 merge / 选赢家 / 认知裁决

---

## §17 Implementation Acceptance Criteria

5.3 Server 实现 + 5.4 `HttpTransport` 接线 + 5.5 Bootstrap + 5.6 三端 E2E **MUST** 全部满足以下方可视为闭环：

1. ✅ 服务端以不可变日志 + `seq` 存储信封，单信封覆盖写模型已废弃。
2. ✅ `push` / `pull` / `bootstrap` 三端点均经 Device Credential 鉴权；`MIRROR_SYNC_KEY` 临时 Bearer 骨架已移除或显式标记为 dev-only 且不在 prod 路径。
3. ✅ `pull(cursor, limit)` 批量返回，`next_cursor` 基于 `seq`；Lamport 未被偷换为全局游标。
4. ✅ 新设备 `bootstrap` 全量 replay 后能重建本地状态并建立 cursor。
5. ✅ 服务端代码路径中**无任何**解密 / inspect / merge / 选赢家逻辑（静态审查 + 测试断言）。
6. ✅ `envelope_id` 幂等去重生效；并发 push 同 id 不重复。
7. ✅ Recovery Secret / Sync Key 不在网络鉴权头中出现（审计断言）。
8. ✅ 三台设备（A 推 → B 拉 → C bootstrap）最终本地投影一致（Lamport 确定性收敛）。
9. ✅ 离线分区后恢复，增量仍确定性收敛，无双版本。

---

## §18 与演化链的对齐（收口）

```
ADR-0026  (四层边界)
   ↓
ADR-0027  (Recovery 信任根实现契约)
   ↓
Recovery implementation + UI/E2E  (38a04ff → d386f8c)
   ↓
Sync Contract Audit  (5.1 ✅)
   ↓
Cloud Sync Server Contract v0.1  (本文档，5.2 ✅ 冻结)
   ↓
Cloud Sync Server 实现            (5.3)
   ↓
HttpTransport 接线                (5.4)
   ↓
Bootstrap / multi-device E2E      (5.5)
   ↓
三端真实同步验证                   (5.6)
```

本文档是 **5.2 的唯一产出**，冻结后 5.3 才可启动；任何对 A–E 原则的偏离都**必须**回到本文档修订（走 ADR/contract 变更，不静默改实现）。
