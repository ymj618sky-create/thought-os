# Sync Ownership Boundary v0.1

> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: FROZEN — BOUNDARY CONTRACT（前置条件冻结，非实现规范）
**Date**: 2026-08-10
**领域**: 数据主权 / 多设备同步 / 认知权威边界
**上游**:
- `adr/0026-secure-identity-recovery-multidevice-ownership.md`（四层边界，ACCEPTED）
- `specs/architecture/Alpha_Identity_Model_v0.1.md`（Identity Boundary 已闭环）
**下游**: 未来 Step 9.3 Sync Engine（runtime 接入）、Step 9.4+ Multi-device Cognitive OS

---

## §1 本文档只回答三个问题

> **Sync 的所有者是谁？同步对象是什么？冲突属于谁？**

不设计 Sync Engine，不定义传输协议，不写代码。本契约是 **Sync 有资格被讨论前的所有权前置条件**——前三层（Recovery Authority → Device Authorization → Runtime Access Boundary）已成立，第四层才允许开始。

这与已形成的规律一致：

> 每当系统准备增加一个"中心机制"，先把它降级为边界契约，再决定是否需要运行时。

COO 如此，Identity 如此，Sync 也如此。

---

## §2 Identity Boundary 现状（Sync 的建立基础）

```
User Authority
      |
      |
Recovery Authority        (Step 7.1 ✅)
      |
      |
Device Authorization      (Step 8.1 ✅)
      |
      |
Runtime Access Boundary   (Step 8.2 ✅)
      |
      |
Local Data Projection
```

关键结论（来自 Step 8 收口）：

```
Device = Execution surface
Device ≠ Ownership surface
```

设备只是执行面，不再是所有权面。这与 Cognition / Data 两个域的同一边界原则同构：

| Cognition | Data |
|-|-|
| System governs operation | System governs access operation |
| User owns conclusion | User owns identity/data |
| Operation ≠ Authority | Device ≠ Ownership |

Sync 必须建立在这一结论之上，不能悄悄把 Device 重新抬回 Ownership 位置。

---

## §3 Q1：同步的所有者是谁？

### 冻结答案

```
User
```

同步的所有者是 **User（用户）**，不是任何单台设备、不是云端、不是 Server Account。

### 设备角色（Device Role）

设备只是：

```
authorized replica executor
```

- 设备经 Step 8 的 Device Authorization 获得"用户授予的 capability"，才有资格参与 Sync。
- 设备**执行** Sync（push/pull 本地投影），但**不拥有** Sync 的内容。
- 一台设备撤销（Step 8 revoke），不影响 User 对数据的所有权，也不影响其他设备的授权状态。

### 严禁的所有权语义

| 禁止 | 原因 |
|---|---|
| Sync 所有者 = Device A | 退回 Device = Identity，违反 Step 8 |
| Sync 所有者 = Cloud / Server | 云端成为事实仲裁者，违反 Constitution Article 4（数据主权属于用户） |
| Sync 所有者 = Server Account | Account 系统把身份收编为服务端资产，违反 ADR-0026 四层边界 |

---

## §4 Q2：同步对象是什么？

### 冻结答案

同步对象是 **Owned Cognitive Events**，不是实现产物。

### 禁止作为同步对象

| 禁止 | 原因 |
|---|---|
| SQLite database 文件 | 实现产物；含索引/游标/本地状态，非语义事实 |
| filesystem snapshot | 实现产物；无法表达事件因果 |
| encrypted container（`.enc`） | 是 at-rest 封装，设备本地秘密（DEK 独立），非跨设备共享语义 |

### Owned Cognitive Events（语义事实源）

同步的原子单位是**用户拥有的认知事件**，它们是事实源，数据库/投影是它们的派生物。与 `adr/0015`（Reflection Event = canonical source）方向一致：

```
Reflection Event        （一次反思事件，含 generated_thought_ids，事件溯源）
Observation Event       （AI 客观描述的产生事件）
Decision Frame Event    （决策框架的确立/修订事件）
Knowledge Lifecycle Event（知识进入/退出 continuity 的事件，readKnowledge 当前恒返回 [] 属正确设计）
```

> **投影角色（Projection Role）**：SQLite 表、`__sync_ops` 操作日志、UI feed 都是这些事件的**投影**。投影可重建、可丢弃、可跨设备重算；事件本身不可被投影反向覆盖（继承 ADR-0015 约束：projection → entity 写入被禁止）。

### 与 ADR-0011 的对接

ADR-0011 当前的同步原子单位是 `__sync_ops`（操作日志，实现产物）。这与本契约 §4 的"同步对象 = Owned Cognitive Events"存在**语义层缺口**：操作日志是事件的传输投影，不是事件本身。本契约冻结语义层后，ADR-0011 的 `__sync_ops` 应被理解为"Owned Cognitive Events 的增量传输投影"，而非真相源。详见 §6（Step 9.2 核对结论）。

---

## §5 Q3：冲突属于谁？

### 冻结边界

```
Sync conflict  ≠  Truth conflict
```

### Sync 能做的

Sync 只能**发现**：

```
Device A projection  ≠  Device B projection
```

即 Sync 检测到两台设备的本地投影存在差异（基于 Lamport 偏序等机制保证**确定性收敛**——所有设备最终看到同一份一致状态，避免双版本）。

### Sync 不能做的

Sync **不能决定**：

```
Which thought is true?
```

Lamport + tiebreaker 解决的是"**确定性收敛到一致状态**"（工程正确性，避免 wall-clock 导致不可复现合并），**不表达认知权威**。当冲突触及"某个 Thought 是否真实成立"时，必须由 User / Resolver（认知权威层，见 ADR-0021/0022）决定，绝不由设备标识或算法静默裁定。

### 严禁的冲突语义

| 禁止 | 原因 |
|---|---|
| `higher_device_id wins` 作为 truth 裁决 | 把 Device 抬回 Ownership/Authority 位置，违反 §3 |
| Sync 引擎调用 LLM 判定"哪个 thought 更好" | Sync 不得进入认知 authority（继承 ADR-0021 Constraint A） |
| Server 解密信封做语义合并 | 违反 Encryption_Policy + Article 4（服务端不可读明文） |

### 冲突边界的落点

- **投影级分歧**（同实体 status 流转并发）：可经确定性算法收敛（所有设备一致），属 Sync 职责。
- **认知级分歧**（"这个 thought 是否该存在 / 是否 true"）：上浮至 User / Resolver，Sync 只标记 `needs_user_resolution`，不自行裁决。

---

## §6 Step 9.2：与现有 ADR-0011 的核对结论

**问题**：现有 Event Sync（ADR-0011）是否满足新的 Identity Boundary？

**结论**：部分满足，缺边界。**继承方向一致，只补边界，不重设计。**

| 维度 | ADR-0011 现状 | 本契约要求 | 判定 |
|---|---|---|---|
| E2E 加密 / 服务端不可读 | ✅ 信封 AES-GCM，Transport 不接触明文 | 同 | 继承 |
| 增量操作日志 / 确定性收敛 | ✅ Lamport + device_id tiebreaker | 收敛正确，但 tiebreaker 用 device_id | **需补边界**：device_id 仅用于收敛确定性，不得表达 truth authority（见 §5） |
| 同步所有者 | 未声明 | User | **缺**：ADR-0011 需补 Q1 声明 |
| 同步对象 | `__sync_ops` 操作日志 | Owned Cognitive Events | **缺**：需将 ops 重新定位为事件的传输投影（§4） |
| 冲突权威边界 | 未声明 Sync conflict ≠ Truth conflict | 冻结 | **缺**：ADR-0011 需补 §5 边界，且 `higher_device_id wins` 须限定为"投影收敛"而非"truth 裁决" |
| 设备角色 | 传输层 replica（正确） | authorized replica executor | 一致，但需显式绑定 Step 8 Device Authorization 作为参与 Sync 的前置 |

**补边界动作（不写代码、不重设计 Sync Engine）**：

1. ADR-0011 增补一节「Ownership Boundary」：声明 Sync 所有者 = User；设备须持 Step 8 Device Authorization 才参与；`device_id` tiebreaker 仅用于投影收敛确定性，不授予任何认知权威。
2. ADR-0011 将 `__sync_ops` 在文档层重新定位为「Owned Cognitive Events 的增量传输投影」。
3. ADR-0011 增补「Conflict Authority Boundary」：投影级分歧可收敛；认知级分歧上浮 User/Resolver，Sync 不裁决。

---

## §7 Step 9.3（未来，非本轮）：runtime 接入顺序

未来 Sync Engine 的调用顺序必须是：

```
User ownership
      |
      |
Device Authorization Check        （Step 8 已建立）
      |
      |
Sync Engine Execution
      |
      |
Local Projection
```

注意顺序：**不是** `Sync → check permission`，而是 `authorization → sync execution`。这与 Step 8.2 Adapter 的 ownership-first 原则同构。

---

## §8 本契约的硬禁（Scope Lock）

- 不实现 Sync Engine / Transport / 合并算法（继承 ADR-0011 既有骨架，不重做）。
- 不设计设备配对 / QR 码 / 账号系统（ADR-0011 Alternative D 已划界）。
- 不定义云端服务端（Server 不可读明文，仅是传输通道）。
- 不引入新的事实源（继承 Phase 4 约束：Resolver 不持认知权，ContinueContext 不成为第四状态源）。
- 不提前设计 conflict resolver（待真实 Experience Observation 驱动，见 ADR-0023/0024 DEFERRED）。

---

## §9 与整体演化链的对齐

```
COO
 |  governance contract → Operations
 |
Identity Boundary
 |  ownership contract → Recovery Authority → Device Authorization → Runtime Access
 |
Future
 |  Owned Event Sync → Multi-device Cognitive OS
```
