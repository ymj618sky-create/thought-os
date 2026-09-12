# ADR-0032: R0 — Observable Action Instrumentation Gate

> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: DESIGN ACCEPTED (2026-09-01) — **Implementation Pending**
**Date**: 2026-09-01
**领域**: Evidence Gate / 测量有效性（Measurement Validity）
**Phase**: R0 — Observable Action Instrumentation（Re-open efficacy 实验的前置门控）
**关联文档**: `adr/0029-reflection-observation-interpretation-distinction.md`（Observation ≠ Interpretation 已冻结）、`adr/0025-cognitive-layering-semantic-boundaries.md`、`adr/0028-representation-source-epistemic-authority.md`、`src/api/routes/reflection.ts`（`buildRevisitFeed` 现状）、`(Mirror reference product)`（`renderNoticed` 现状）

> **本 ADR 纪律（与 ADR-0029 一致）：只钉语义，不写代码、不改 schema、不引入新架构层、不进入实现周期。**
> 目标产出 = R0 Instrumentation Gate 的语义边界与 10 条 PASS 准则；收敛后才进入最小 instrumentation 实现（另开实现 ADR）。
>
> **状态标记**：`R0 Instrumentation Gate — Design Accepted / Implementation Pending`。

---

## §0 Context（为什么需要 R0，且它在 R1 之前）

当前 Mirror 已具备 Re-open 的**呈现**能力：`buildRevisitFeed`（`reflection.ts`）从 `related_thought_ids` 真实历史构建 revisit feed，前端 `renderNoticed`（`chat.js`）渲染为"你以前似乎这么想过"卡片，仅 `capEvent('MOMENT_A_SHOWN', ...)` 埋点展示。

**但现状存在一个测量学断层**：用户看到 revisit 卡片后，系统**没有任何通道记录用户对这条 AI 提议的处置**。我们既无法区分"用户用语言表达了认知变化"与"用户对认知对象实施了可检查动作"，也无法把"拒绝"精确归因到某条具体 proposal。

在讨论"Re-open 机制是否有效"（R1）之前，必须先回答一个更底层的问题：

> **我们能否把"语言中的认知表达"与"用户对认知对象实施了一个可检查动作"可靠地区分开？**

若答案是否定，则 `action rate` / `cognitive yield` / `OWN` / `Re-open effectiveness` 全部暂时没有测量基础。

这正是 ADR-0029 冻结的 `Observation ≠ Interpretation` 所缺失的第三层。ADR-0029 止步于"Reflection 产物如何区分 Observation 与 Interpretation"，但**没有定义用户侧的可检查动作（State Change）**。本 ADR 补齐：

```text
Observation        "用户说：这和以前不一样。"
        ↓
Interpretation     "这可能表示 Contrast。"
        ↓
State Change      用户实际修改 Thought / 设置 disposition / 建立 relation
```

三层必须严格分开。过去的研究容易直接从第一层跳第三层。本 ADR 锁定：**R0 只负责把"用户对 AI 提议的处置"变成可检查、可撤销、可追踪的独立事件流（State Change 的最小子集），且不穿透 Kernel 正式语义。**

---

## §1 Decision（R0 语义冻结）

### D1 — R0 是第一道门，不是功能

R0（Observable Action Instrumentation）= Evidence Gate 的第一阶段：**测量有效性（Measurement Validity）**。
R1（Mechanism Efficacy）= 第二阶段：Re-open 是否增加可观察变化。

顺序铁律：

```text
R0 Measurement validity
       ↓ 能可靠测到"用户改变了认知对象"？PASS
       ↓
R1 Mechanism efficacy（Re-open 是否增加这种变化）
       ↓
R2 Contextual specificity（Contextual vs Random 干净对照）
       ↓
R3 Cognitive Yield
       ↓
OWN
```

R0 不通过 → 不进入 R1。**R0 不是"Re-open 功能"，而是"什么才算一次可观察的用户动作"的冻结。**

### D2 — `proposal_id` 唯一且可追踪

每一次 Re-open 提议必须拥有全局唯一 `proposal_id`（建议 UUIDv7，与 ADR-0019 数据目录纪律一致）。
提议记录至少包含：

```text
proposal_id
source_thought_id        （被调出的旧想法）
current_context_id       （当前对话/空间上下文）
selection_reason         （为何此刻调出；Contextual 须含"因为你刚才说 X"）
user_response            （见 D4 四态）
timestamp
```

`proposal_id` 是后续所有 disposition / reject / accept 事件的锚点。**没有 `proposal_id` 的 Re-open 不进入任何测量。**

### D3 — Re-open 的 selection rationale 必须可见

无论 Contextual 还是 Random 条件，`selection_reason` 必须对用户与研究者同时可见（provenance / transparency / inspectability）。
这是 R2 干净对照的前提：两组都必须具备 provenance，唯一变量才是 `selection relevance`。

### D4 — 用户 disposition 是独立事件，不是 Relation

用户对 Re-open 提议的处置，表达为**四种 disposition 之一**，落独立事件流 `reopen_disposition`：

| disposition | 中文 | 语义承诺 |
|---|---|---|
| `related` | 有关 | 旧想法对现在有用（≠ 建立 Relation） |
| `unrelated` | 无关 | 旧想法对现在没用 |
| `uncertain` | 不确定 | 用户无法判断 |
| `not_now` | 现在还处理不了 | 用户当前无能力/意愿处理 |

**关键边界**：disposition 是 *user disposition toward proposed relation*，**不是** Kernel Relation。第一轮**故意避免"有关"二字映射成 Relation 写入**——语义承诺完全不同。

### D5 — disposition 可修改 / 可撤销

`reopen_disposition` 是**可撤销状态**，非一次性提交：

```text
Proposal
   ↓
User marks "有关" → Inspectable state（unresolved → related）
   ↓
User can undo → 回到 unresolved 或改标
```

用户对 AI 提议的回应 ≠ Kernel Relation。至少第一轮不写 Relation/Thought 本体。撤销须保留历史事件（audit trail），不物理删除。

### D6 — Reject / 否定必须指向具体 proposal

否定不能记录为泛化"user rejected"，必须携带 `proposal_id`：

```text
proposal_id: R184
decision: rejected   （即 disposition = unrelated 的显式否定语义）
```

精度要求：用户拒绝的是 Mirror 的**哪一个具体结构判断**。副产品：可首次测量 *Mirror 的结构提议质量*（Accepted / Rejected / Uncertain / Deferred 分布），而非仅"用户喜不喜欢"。

### D7 — Primary action 与 Secondary linguistic coding 分离

**Primary**（系统状态事件，可作为测量的主证据）：
`REOPEN_DISPOSITION_SET` / `REOPEN_DISPOSITION_CHANGED` / `PROPOSAL_REJECTED` / `PROPOSAL_ACCEPTED` / `USER_CREATED_RELATION` / `USER_MODIFIED_THOUGHT` / `USER_MARKED_UNRESOLVED`。

**Secondary**（独立评分员从语言中判断"用户是否表达明显认知变化"）：只能**验证**系统事件是否漏掉重要行为，**不能反向制造 Primary**（否则重新掉进 `LLM/researcher → interpret transcript → infer action`）。

### D8 — Primary action 互斥（防 metric inflation）

**一个用户事件只能有一个 Primary Action Label**。例如：

```text
Event #721
Primary:   REOPEN_DISPOSITION_CHANGED
Secondary: contrast_expression = true
           relation_expression = true
```

禁止一个动作同时 +3 action points（Contrast + Relate + Recognition）。Secondary 标记可多，Primary 唯一。

### D9 — `reopen_disposition` 不写入 Thought / Relation 本体

`reopen_disposition` 是**独立事件流**（建议落 `repos()` 下的独立存储，或既有 event_log 家族），**不修改** `Thought` / `Relation` / `Observation` / `Interpretation` 的正式语义与字段。

这守住 ADR-0028 Authority 与 ADR-0025 认知主权：**AI 可以提出认知结构，但用户对该结构的处理必须留下独立、可检查、可撤销的状态证据，且不自动污染 Kernel。**

### D10 — 暂不做的事（明确禁止清单）

R0 阶段**不做**：
- 自动 Relation / 自动 Contrast / 自动 Evolution 写入
- Cognitive Yield 评分
- LLM 判断"用户是否产生认知动作"
- Random control 实验执行
- 持续性追踪（T0→T1→T2 lasting change）
- 新的认知结构模型

**可撤销 ≠ 可持续**。R0 只要求：可撤销、可检查、可追踪。lasting cognitive change 是另一项研究。

### D11 — Safety / Autonomy 不是失败桶

四态中的 `unrelated` / `uncertain` / `not_now` 属 **Safety / Autonomy signal**，非 Primary Success，但极重要：
- 高 Reject（unrelated）率不必然产品失败，可能意味"Mirror 提议大胆，用户有能力拒绝"（认知主权成立）。
- 100% accept 未必好，可能是 UI authority bias（R2 后值得测）。
- `not_now` 不进入 Primary Success 统计。

---

## §2 Instrumentation Gate — PASS 准则（10 条）

> Can Mirror reliably distinguish user language about cognition from an observable user action on a cognitive object?

PASS 需要**全部成立**：

1. 每次 Re-open 都有唯一 `proposal_id`
2. 用户 disposition 可被系统记录（四态之一）
3. disposition 可撤销 / 修改
4. Reject 可指向具体 `proposal_id`
5. 系统事件与转写（transcript）分离存储
6. Primary action 互斥（单一 Primary Label）
7. Secondary linguistic coding 独立于 Primary，且不能制造 Primary
8. "无法处理"（`not_now`）不进入 Primary Success
9. provenance 对所有实验条件可见
10. 不改变 Kernel Relation / Thought 的正式语义

**任一不成立 → 不进入 Re-open efficacy experiment（R1）。**

---

## §3 Red lines（本 ADR 不违反 / 不重新开放）

| 约束 | Source | 对本 ADR 的含义 |
|---|---|---|
| Observation ≠ Interpretation | ADR-0029 | 本 ADR 补第三层 State Change；三层分离不可合并 |
| Representation 边界 | ADR-0028 §1 | `reopen_disposition` 是 Event，不持认知权威；不写 Representation 本体 |
| Authority 非权限系统 | ADR-0028 §3 | AI 提议 ≠ 用户认知纳入；disposition 是用户主权证据 |
| 认知主权 | ADR-0025 / ADR-0028 | 不自动写 Relation/Thought；可撤销、不污染 Kernel |
| 不引入新架构层 | 优化主线纪律 | `reopen_disposition` 是事件流，非新认知层 |
| 数据目录 / UUID | ADR-0019 | `proposal_id` 用 UUIDv7；存储落既有 `repos()` 路径 |
| 测量有效性优先 | 本 ADR D1 | R0 不通过不进 R1；不把 disposition 定义成 Cognitive Yield |

---

## §4 最小实现落点（Preflight 后已落地，非草案）

> **状态：已执行（2026-09-02）。** Preflight 发现既有 `CapabilityEvidenceStore`（`event_log`）与 disposition 需求同构，故**不新建端点/存储**，直接复用。下表为最终落地，与原草案的差异已标注。

**后端（`(Mirror reference product)`）**
- `reflection.ts` 的 `buildRevisitFeed` 每条 related item 附加 `proposal_id = createId()` 与纯 provenance `selection_reason { basis, source_thought_id, matched_count }`（零 inference）。
- `CapabilityEvidenceStore` 的 `CAPABILITY_EVENT_TYPES` 增加 `REOPEN_DISPOSITION_SET` / `REOPEN_DISPOSITION_CHANGED`（**复用既有 `event_log`，未新建存储**）。
- 写通道复用既有 `POST /api/capability-event` → `capabilityStore.record`（`object_id = proposal_id`）。**不新增端点**（原草案的"新增 `/api/reopen/disposition`"被 Preflight 推翻——基础设施已存在）。
- `CapabilityEvidenceStore.currentTs()`：ts 由毫秒 `toISOString()` 提升为 **ISO 基座 + 进程内单调微秒后缀**（固定宽度，字典序=时间序），根治同毫秒内多事件 `ORDER BY ts DESC` 顺序不确定（见 §6）。
- `/api/chat` payload 已自然透传 `proposal_id`/`selection_reason`（零新增计算）。

**前端（`frontend/src`，React 重构后）**
- `api/types.ts`：`HomeFeedItem` 增加 `proposal_id?` / `selection_reason?`（及 `origin_type?` / `evidence_link?`）。
- `views/Landing.tsx` revisit 卡：每项四按钮 `[有关][无关][不确定][现在还处理不了]`；点击经既有 `api.capabilityEvent({ type, objectId: proposal_id, metadata: { disposition } })` 写事件；去重（同值不重发）、首次=SET / 改判=CHANGED；`.catch(()=>{})` 不阻断交互。
- **旧 `public/chat.js` 的等价控件在 React 迁移后失活**，已迁至 React 主前端（见会话记录）。

**明确不碰**：`thought`/`relation`/`observation`/`interpretation`/`evolution`/`admission` 任何写路径；LLM 调用；sync 协议；新存储；新端点；R1 实验。Kernel mutation = 0。

---

## §5 状态（2026-09-02 实测）

1. **本阶段 = DESIGN ACCEPTED + IMPLEMENTATION COMPLETE（实测）**。
2. 后端 instrumentation（`buildRevisitFeed` + `CapabilityEvidenceStore` + ts 精度提升）零改动 Kernel，tsc 通过。
3. 前端 React 控件（`types.ts` + `Landing.tsx` + `capabilityEvent` 通道）tsc + 生产构建全绿，闭环确认。
4. **invariant 测试 `tests/r0-instrumentation-gate.test.ts` 实跑 6/6 通过**（含 §6 修复的顺序无关断言）。
5. **未进入 R1**。R0 的成功标准 = 拥有一种不会把"说"和"做"混为一谈的测量装置，非 Re-open 变聪明。

**与 ADR-0029 的关系**：ADR-0029 冻结 `Observation ≠ Interpretation`；本 ADR 补齐 `≠ State Change`，并完成 `Observation ≠ Interpretation ≠ State Change` 三层闭环。二者共同构成 Thought OS 研究语义地基的第二层（用户侧可检查动作的测量有效性门控）。

---

## §6 测试纪律（Implementation 阶段实测确立，约束 R0 及以后所有实验测试）

> R0 实测暴露一个被隐藏的测试缺陷：原 invariant 测试依赖 `recent()` 的 `ORDER BY ts DESC` 返回顺序做索引断言（`all[0]=SET`），但 `toISOString()` 仅毫秒精度，同毫秒内多事件 ts 完全相等，等值 ts 的 DESC 顺序**不确定**，导致偶发失败。本小节将根因收敛为两条固定纪律。

### T1 — append-only 审计断言必须顺序无关

任何验证"事件被记录且不丢历史"的测试，**不得依赖写入/读取的索引顺序**。应断言：
- 目标事件**存在**（按 `event_type` + `object_id` 定位）；
- **类型分布**正确（如 1×SET + 3×CHANGED）；
- **取值集合**完整（如 disposition ∈ {related, unrelated, uncertain, not_now}）；
- **previous_disposition 链条完整**（改标链 `related → unrelated` 的历史事件都在，且 `previous_disposition=related` 可被还原）。

顺序无关断言是 append-only 审计应有的不变量——历史完整性不依赖物理写入先后。

### T2 — 事件时间戳必须在同毫秒内唯一且单调

`CapabilityEvidenceStore.currentTs()` 已实现：ISO 毫秒基座 + 进程内单调微秒后缀（固定宽度，字典序=时间序）。**任何新增到 `event_log` 的事件类型都必须复用 `currentTs()`，不得直接用 `new Date().toISOString()`**——否则重蹈同毫秒顺序不确定的覆辙。

> 边界提醒（非当前问题）：`performance.now()` 是进程内单调时钟。若未来出现**多 runtime 写同一 `event_log`**，微秒后缀可能跨进程碰撞；届时正确修法是加 `rowid` 自增列做物理 tiebreaker，而非改用绝对时钟。当前单进程 runtime 下安全。

### T3 — invariant 测试是门禁，不是有效性证明

`tests/r0-instrumentation-gate.test.ts` 只证明"测量不污染认知状态（Invariant A：Kernel 行数严格不变）+ append-only 审计（Invariant B）"。它**不证明** Re-open 有效性 / Contextual vs Random / Cognitive Yield——那些是 R1/R2/R3 的事。R0 测试通过 ≠ R0 实验成功。

### 已落地的 R0 门禁测试（`tests/r0-instrumentation-gate.test.ts`）

- **Invariant A（no Kernel contamination）**：写 `REOPEN_DISPOSITION_SET` 前后，`thought`/`relation`/`observation`/`interpretation`/`evolution`/`admission`/`portrait` 表行数严格不变；事件只进 `event_log`。
- **Invariant B（append-only audit）**：`SET related → CHANGED unrelated` 保留两条历史事件，`previous_disposition = related`；多次改标均追加不覆盖（顺序无关断言）。
- 临时探针（8 条同毫秒写入，验证 ts 唯一 + DESC 单调）已跑通并删除，结论固化于 T2。
