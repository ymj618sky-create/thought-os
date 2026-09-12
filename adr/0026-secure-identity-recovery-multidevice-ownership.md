# ADR-0026: Secure Identity, Recovery and Multi-Device Data Ownership

> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: ACCEPTED (Architecture boundary frozen — 边界定义已接受，不冻结实现算法；实现走 ADR-0027)
**Date**: 2026-08-10
**领域**: 安全 / 数据主权 / 身份 / 设备授权 / 同步
**关联文档**:
- `adr/0010-encryption-at-rest-app-layer-aes-gcm.md`（应用层信封加密）
- `adr/0011-sync-lamport-e2e-envelope.md`（同步 = 操作日志/Lamport/E2E 信封，**事件级**）
- `adr/0019-multi-platform-architecture-and-runtime-boundary.md`（Data Root 所有权）
- `adr/0020-data-ownership-encryption-key-custody-separation.md`（数据所有权 ≠ Account Principal，user-controlled recovery 冻结原则）
- `adr/0025-cognitive-layering-semantic-boundaries.md`（认知主权分层）
- `src/crypto/keyStore.ts`、`src/crypto/CryptoProvider.ts`、`src/api/app.ts`（当前实现，含今晨事故的 unlock-failure 覆盖缺陷）

---

## §0 Context

### 0.1 触发事件

2026-08-10 晨，单台 Windows 设备、同一用户会话下，运行时无法解开既有加密库（`ContainerUnlockError: Unsupported state or unable to authenticate data`），运行时按 `app.ts:204-235` 把旧库归档为 `thoughtos.db.enc.unreadable-*` 并以**新建空库**启动。诊断证实：当前 OS Keychain 中 `wrapped-dek` 能解包出一把合法 DEK，但该 DEK **解不开归档库**——即 `provisionDeviceUnlock`（`keyStore.ts:66-78`）在新建空库初始化时**用 `setPassword` 覆盖了 Keychain 的 `wrapped-dek`**，把旧库的钥匙熔掉了。

这不是用户的操作失误，是**架构缺陷**：解锁失败时，系统主动破坏了唯一的恢复材料。

### 0.2 真正的根问题（超出今天 bug）

当前模型隐含：

```
User → Device → OS Keychain → wrapped-DEK → Encrypted DB
```

即**"用户的数据安全性 = 某台设备上的某个系统凭据"**。这适合单机 App，不适合 Thought OS。一旦视角提升到长期产品架构（Web / Mobile / 多设备），同一根问题会反复出现：

- Keychain 只在本机存在 → 换设备/重装 = 密钥不随走 = 数据全丢（即便 `.enc` 文件拷过去也解不开）。
- 设备被当成身份根 → Device Authorization 与 User Identity 耦合。
- 同步若被理解为"复制加密数据库文件" → 多设备并发修改无法合并。

### 0.3 与认知主权的对称（COO 剃刀的对应）

ADR-0025 冻结了认知主权：AI 不替用户决定想什么（Operation 自带 boundary，User owns conclusion）。本 ADR 对应冻结**数据主权**：

| 认知层（COO 剃刀） | 数据层（本 ADR） |
|---|---|
| COO 不决定用户想什么 | Sync 不决定用户数据真相 |
| Operation 自带 boundary | Device 自带 authorization |
| User owns conclusion | **User owns encryption root** |

两者本质一致，反对同一反模式：

```
System Convenience  >  User Authority
```

今天的 bug 正是该反模式的实例：为了"快速让空库能启动"（系统便利），覆盖了用户的加密根材料（用户权威）。

### 0.4 与既有 ADR 的关系（避免重复，明确补位）

- **ADR-0020** 已冻结"数据所有权 ≠ Account Principal，必须 user-controlled recovery"——但它是**原则冻结**，`Out of Scope` 显式把 recovery phrase 生成/校验/多设备分发推迟到未来 ADR，且**未定义"解锁失败禁止覆盖密钥"**这条硬约束。本 ADR **Extends 0020**：补齐四层边界 + 这条硬约束。
- **ADR-0011** 已定"同步 = Lamport + E2E 信封 + **操作日志（事件）级**，否决全量 DB 快照"（备选 A）。本 ADR 的 Layer 4 与之一致，**不重复其实现细节**，仅把 Sync 在四层模型中定位为"operate on owned primitives/events"。
- **ADR-0019/0010** 提供 Data Root 与信封加密基础，本 ADR 在其上定义身份与授权边界。

---

## §1 Decision

本 ADR 将"数据主权"显式拆为**四层**，各层边界独立、互不越权。

### Layer 1 — User Identity（用户身份）

回答：**这个数据属于谁？**

身份根 MUST 是 **Thought OS Identity**，而非任何设备/OS 凭据：

```
Thought OS Identity
  ├─ identity_id
  ├─ master_secret（用户根秘密，跨设备存在）
  └─ recovery_material（恢复材料，离线持有）
```

**禁止**：把 `Windows User` / `Mac Keychain` / `Phone Secure Enclave` 当作身份根。设备凭据只能作为 Layer 2 的"解锁加速器"。

### Layer 2 — Encryption Authority（加密控制）

回答：**谁可以解开数据？**

```
User Root Secret (master_secret)
        │
        ├─→ KEK
        │      │
        │      └─→ DEK
        │             │
        │             └─→ encrypted data
        │
        ├─ Desktop Keychain cache      （加速器，非权威）
        ├─ Mobile Secure Storage cache （加速器，非权威）
        └─ Recovery Key                （用户持有，可离线）
```

**关键约束**：OS Keychain / Secure Enclave 只是 **device unlock accelerator**，是 `KEK` 的一个**缓存副本**，不是 identity authority，也不是解密的非有不可前提。`Recovery Key` 路径 MUST 在 Keychain 不可用时仍能解开数据。

### Layer 3 — Device Authorization（设备授权）

回答：**哪台设备允许访问？**

与 User Identity **分离**（Decision 5）。首次授权流：

```
Device (new)
  │
  User password / recovery key
  │
  Approve device
  │
  Generate device key (scoped to this device, derived from Root Secret)
```

之后该设备可用本地缓存（Keychain）无感解锁；但**撤销某设备** MUST 不波及 Root Secret 与其他设备。Web 端不直接持有 Root Secret，应经 Session Key + Server encrypted relay（属 Layer 4 后续设计）。

### Layer 4 — Synchronization（同步）

回答：**多设备如何一致？**

**MUST operate on owned data primitives / events，NOT raw encrypted database replication。**

```
Device ─ Local Event Store ─ Sync Layer ─ Event Graph ─ Projection ─ Materialized Local DB
```

类似 Event Sourcing / Git：设备提交 `ReflectionCreated` / `QuestionAnswered` 等 owned 事件，Sync 层做 Lamport 增量合并（见 ADR-0011），本地投影为可读库。**禁止**数据库文件级复制/合并。

---

### Decision 1 — Device Keychain is a convenience unlock mechanism, not the user identity root.

Keychain（Windows 凭据 / macOS Keychain / Android Keystore）只能缓存由 `master_secret` 派生的 KEK/DEK，**绝不**作为身份或解密权威。任何依赖"Keychain 存在才能解锁"的设计都是反模式。

### Decision 2 — Unlock failure MUST NOT mutate existing encryption material.

这是今晨事故的直接根因修正。**当 `tryDeviceUnlock` 失败（GCM tag 校验失败 / Keychain 缺失）时，运行时 MUST：**

- 保留 `wrapped-dek` 与磁盘 `.enc` 文件**原封不动**；
- 提供明确的错误信号（"无法用当前设备密钥解锁，请用主密码/恢复密钥"）；
- 提供 recovery 入口；
- **绝对禁止**以"新建空库"之名调用 `provisionDeviceUnlock` 覆盖 Keychain 的 `wrapped-dek`。

> 今晨的 `app.ts:204-235` + `keyStore.ts:77 setPassword` 违反本决策，是 MUST FIX（见 §4 P3）。

### Decision 3 — User-controlled recovery path is mandatory.

ADR-0020 第 3 条由"冻结原则"在本 ADR 升级为**强制要求**：首次初始化 MUST 引导用户设主密码（生成 `crypto.json`）并导出**一次性 recovery key**（离线保存）。Recovery key MUST 能独立于任何设备 Keychain 解开数据。无 recovery path 的产品形态不被接受。

### Decision 4 — Future synchronization MUST operate on owned data primitives/events, not raw encrypted database replication.

重申并定位 ADR-0011：Sync 在四层模型中属于 Layer 4，作用于 Reflection/Thought/Observation/Question/Knowledge 等 owned 事件，**不是** SQLite 文件同步。这与认知主权一致——Sync 不决定数据真相，只传输用户 own 的事件并做确定性合并。

### Decision 5 — Device authorization is separate from user identity.

`deviceId`（ADR-0016/0017/0018）解决"哪个设备"，`identity_id`（Layer 1）解决"谁"。撤销/新增设备 MUST 不影响 Root Secret 与其他已授权设备。设备密钥由 Root Secret 派生且可单独吊销。

---

## §2 四层不变量（Invariants）

1. **Root Secret 单一真相**：数据可解密性的最终权威是 `master_secret` + `recovery_material`，不是任何设备凭据。
2. **密钥不可自毁**：任何失败路径（尤其 unlock failure）不得改写既有 `wrapped-dek` / `device-kek`。
3. **跨设备可移植**：`.enc` + `crypto.json` + `recovery material` 三者可整体迁移到新设备并解锁。
4. **无中央数据权威**：不存在"平台决定数据真相"的同步服务端（呼应 ADR-0011 服务端不可读明文 + ADR-0020 平台不持明文密钥）。
5. **System Convenience ≤ User Authority**：便利性优化（如 Keychain 无感解锁）不得损害用户的数据主权（如覆盖密钥）。

---

## §3 备选方案（被否决的）

### A. Keychain-only 单设备绑定

维持现状：解锁只靠 OS Keychain。
**否决**：换设备/重装即数据全丢；今晨事故证明单点易碎；违反 Decision 1/3/5。

### B. 数据库文件级同步（DB replica）

多设备直接复制/合并 `.enc` 文件。
**否决**：与 ADR-0011 备选 A 同因——无法做增量事件合并，并发修改冲突无解；且把"数据真相"交给文件覆盖。

### C. user/password → server → data 传统 SaaS 模型

**否决**：直接违反 ADR-0020 Prohibited 与 Constitution Article 4（思想属于用户）。平台虽可不持明文，却通过"控制账户即控制恢复"间接触碰主权。

### D. 中央 Cognitive/Data Authority

让 Sync 服务端或 Runtime 替用户决定数据合并结果或思想真相。
**否决**：与 COO 剃刀（ADR-0025 精神）及本文 §0.3 对称原则冲突——System Convenience 不得凌驾 User Authority。

---

## §4 执行优先级（P0–P4）

本 ADR 是边界冻结，**不实现代码**。但边界决定了实现的先后顺序与"禁止方向"：

- **P0 — Identity Boundary（DONE）**：经 Step 4/5/6 边界冻结，身份模型已定义于 `specs/architecture/Alpha_Identity_Model_v0.1.md`（含 Root / Recovery Authority / Device Authorization 三层、四 invariant、Recovery Authority v0.1 Contract）。原"Alpha data rescue"探查发现当前 Alpha 为明文模式、三层身份均未建立，故 rescue 不当作补丁，而当作一次性边界建立（见 P1/Step 7）。
- **P0.5 — Incident RCA 降级（P4）**：今晨 archive 触发路径查证归类为 `Incident RCA`，**最低优先级**——Identity 模型修好后此类 failure mode 价值下降，且它回答"今天为何失败"不回答"未来为何不败"，不阻塞架构演进。
- **P1 — Step 7 Recovery Root v0.1 实施设计（READY）**：实施设计已落 `Alpha_Identity_Model_v0.1.md` §8，仅三输出：① `mirror.identity.json` 最小数据模型 ② 解锁状态机（`unlock fail → STOP → request recovery`，绝不生空库）③ 从无身份到 Recovery Root 的一次性迁移（保留明文兼容、零数据迁移风险）。**范围硬禁**：不引入 Sync/云账号/服务端/冲突解决；不锁定 credential 终态形态；不改业务层。详见 §8.4。
- **P1 — 冻结错误方向**：停止任何"Keychain-only / device-bound identity"的新代码；今晨的覆盖式 `provisionDeviceUnlock` 标记为反模式。
- **P2 — 本 ADR（ADR-0026）Accept**：边界定义被接受，成为后续实现的宪法级约束。
- **P3 — 最小修复（触发实现 ADR，建议 ADR-0027 或 implementation track）**：**仅**修 `unlock failure ≠ overwrite crypto`（Decision 2）。范围严格限定：改 `app.ts:204-235` 不覆盖 `wrapped-dek` + 提供 recovery 入口；**同时必须冻结 `CryptoProvider.unlock` 的隐式-init 分支（`CryptoProvider.ts:113-117`：meta 缺失时任何 `unlock` 静默新建空库 + 新 DEK + `provisionDeviceUnlock` 覆盖 `wrapped-dek`）**——该路径与 `provisionDeviceUnlock` 同构，是今晨事故的上游，须一并纳入 Recovery Integrity Invariant；不引入 Sync / Cloud / 新实体。
- **P4 — 未来同步设计**：等 Web/Mobile 真正启动，再基于 Layer 4 + ADR-0011 设计事件同步、冲突解决、服务端 relay。不在本 ADR 范围内提前实现。

---

## §5 Consequences

### 正向

- **根因闭环**：今晨事故的"解锁失败覆盖密钥"被 Decision 2 显式禁止，未来不会重演同类自毁。
- **换设备可恢复**：Decision 3 + Layer 1/2 保证 `.enc` + recovery material 可跨设备迁移，回应"换电脑数据全丢"的担忧。
- **与认知主权对称**：§0.3 把数据主权与认知主权对齐为同一原则两面，强化 Thought OS "Cognitive OS" 的定位（用户自己的认知基础设施，而非"运行在设备上的 AI 工具"）。
- **不重复既有 ADR**：Extends 0020、Aligns 0011/0019/0025，不重写其实现细节。
- **为 Web/Mobile 预留干净边界**：四层分离使未来多端只需新增 Layer 3 设备授权条目，不触碰 Identity/Encryption 根。

### 负向 / 风险

- **首次启动摩擦增加**：Decision 3 强制主密码 + recovery key，比"无感 Keychain"多一步；需用 UX 把 friction 降到最低（recovery key 一次性显示 + 离线保存引导）。
- **recovery key 丢失 = 数据不可恢复**：recovery material 是用户责任；产品 MUST 明确告知"无备份即无救援"，不在平台侧留存明文（呼应 ADR-0020）。
- **P3 修复需谨慎**：改 `app.ts` unlock 分支时不得引入新事实源或新实体，范围受 P3 约束。
- **Web 端 Session Key relay 细节未定**：属 P4，本 ADR 仅定位其属于 Layer 3/4 边界，不给实现。

### 后续行动

1. 用户 Accept 本 ADR（Status → ACCEPTED）。
2. 触发 P3 实现 ADR（建议 ADR-0027），仅修 unlock-failure 覆盖缺陷。
3. 更新 `app.ts` / `keyStore.ts` 注释，标注 Decision 2 为硬约束。
4. P0 主密码 + recovery key 引导文案（UX）落地。

---

## §6 Relations

- **Extends ADR-0020**：0020 冻结"所有权≠账户、需 user-controlled recovery"原则；本 ADR 补"四层边界 + 解锁失败禁改密钥 + Keychain 降级为加速器"，并将 recovery 由原则升级为强制（Decision 3）。
- **Precedes / Aligns ADR-0011**：Sync 已定事件级（Lamport/E2E），本 ADR 把 Sync 定位为 Layer 4，不重复其实现，仅重申"operate on events not DB"。
- **Depends on ADR-0010**：Layer 2 的信封加密（KEK/DEK/AES-GCM）来自 0010。
- **Orthogonal to ADR-0016/0017/0018（deviceId）**：deviceId 解决"哪个设备"，Layer 3 解决"设备如何被授权"，维度不同。
- **Aligns with ADR-0025（认知主权）**：§0.3 对称原则——认知主权（User owns conclusion）↔ 数据主权（User owns encryption root）。
- **Precedes `specs/architecture/Alpha_Identity_Model_v0.1.md`**：本 ADR 冻结四层边界（"是什么"），该文档把 Layer 1/2 落成 Alpha 阶段"用户身份到底是什么"的最小定义，并约束 P0 为"Alpha data rescue / recovery"而非终态身份方案。
- **Supersedes（反模式层面）**：今晨 `app.ts:204-235` + `keyStore.ts:77` 的"unlock-failure 覆盖 wrapped-dek"行为被本 ADR Decision 2 标记为 MUST NOT，待 P3 修复。
