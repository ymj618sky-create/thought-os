# ADR-0022: Continuity Primary Resolution Authority

> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: ACCEPTED (Representation §3.1 frozen 2026-08-04; Authority §4 Model D decided 2026-08-04)
**Date**: 2026-08-03 (updated 2026-08-04)
**领域**: Continuity / Policy / 决策权归属
**Phase**: Phase 4 v0.2 (Policy Boundary) — Phase A, Q1
**关联文档**: `specs/policy/Continuity_Policy_Resolution_v0.2.md`（cycle 入口）、`adr/0021-continuity-resolution-read-side-projection.md`（ACCEPTED，边界约束来源）、`specs/Phase4_Resolver_Readside_Skeleton_Validation_Report.md`（ACCEPTED，v0.1 冻结结果）

> 本 ADR 是**决策记录**。§3.1 Representation 已冻结（ACCEPTED）：ContinueContext = continuation entry（R1 表达 / R4 生成机制两层分离）。§4 Authority 已决：Model D — Shared Authority（Continuity Policy 拥有生成权，User 拥有最终接受权）。矩阵不评分、不排名、不构成推荐。
> **两决策层均已闭合**：Representation + Authority。本 ADR 不进入 Phase C Proof Scope 与 Phase D Implementation。

---

## §0 Context

核心问题：

> 当多个 Continuity Primitive 同时存在时，系统由**谁**决定哪个 material 成为 primary continuation entry？

输入：
```
Reflection Event
PendingSlot
Knowledge
StalledPrompt
...
```

输出：
```
ContinueContext.primary
```

明确这**不是**：
- 排序算法问题；
- score 计算问题；
- AI 判断问题。

这是：

> **continuation authority（连续性决策权）的归属问题。**

现状说明：v0.1 中 `Reflection = primary` 是 validation baseline，用于证明通道存在，**不构成任何权力结构主张**。本 ADR 是 policy cycle 的**根节点** —— 其结论会向下影响 Q2（rationale 语义）、Q3（Knowledge 是否允许自动进入 continuity）以及 Phase C Proof Scope，因此不应在信息不足时提前锁死。

**依赖关系（显式）**：

```
Representation Boundary  (§3.1，CLOSED — 2026-08-04 ACCEPTED)
        ↓
Authority Boundary       (§4，CLOSED — 2026-08-04 Model D decided)
        ↓
Policy Boundary          (ADR-0022 ACCEPTED; 规则细节 → Q2/Q3 / Phase C)
        ↓
Implementation           (Phase D，本 ADR 不触及)
```

`Authority Question` 依赖于 `Representation Question` 的前提：**系统是否必须产出单一 primary**。该前提已于 2026-08-04 在 §3.1 冻结（ContinueContext = continuation entry，R1 表达层 / R4 生成机制两层分离），representation 层关闭。§4 在重构后的问题 `Who defines the generation authority of a continuation entry?` 下已于 2026-08-04 决出 **Model D（Continuity Policy 拥有生成权，User 拥有最终接受权）**——不讨论"什么更值得继续"，只讨论生成规则的归属、修改权与解释权。两决策层均闭合，ADR-0022 进入 ACCEPTED。

---

## §1 Existing Constraint（继承 ADR-0021，不在本 ADR 重开）

Resolver：
- 可以解析 continuity；
- **不**拥有 cognitive evaluation 权力；
- **不**创建 primitive；
- **不**改变 ownership。

对应 ADR-0021 Constraint A（Read-side Decision Layer）与 Constraint B（Primary Selection ≠ Cognitive Judgment）。

因此，任何方案如果隐含：

```
System decides what matters about user's thought
```

需要重新审视。这是审查红线，不是评分项。

---

## §2 Candidate Models

四个候选，仅记录候选空间，**不作选择**。

### Model A — Runtime Rule Authority

权力归属：
```
Predefined system policy
```

特点：确定性最高。

优势：
- 可测试；
- 可解释；
- 不依赖模型。

风险：
- 规则可能无法覆盖复杂情况；
- 用户意图表达不足。

---

### Model B — User Explicit Authority

权力归属：
```
User action
```

（例如 Continue Reflection / Resume Pending Task / Revisit Knowledge）

优势：
- 用户控制权最高；
- 避免系统替用户决定。

风险：
- 自动连续体验下降；
- 用户需要主动管理 continuation。

---

### Model C — Resolver Policy Authority

权力归属：
```
Continuity Policy layer
```

（依据 primitive metadata：freshness / recurrence / connection / user interaction）

优势：
- 自动化能力最高；
- 可以综合多个 primitive。

风险（**本模型需重点分析**）：容易从
```
resolve continuity
```
滑向
```
evaluate thought importance
```
与 §1 Constraint A / B 存在直接边界风险。这是四个模型中唯一在结构上可能触碰红线的选项，其可行性取决于能否给出一条不可逾越的机制性分界，而非依赖实现自律。

---

### Model D — Hybrid Authority

权力归属：组合模型。

例如：
```
Explicit user intent
>
unfinished active thread
>
system continuity rule
```

> 上述排序为**示例，不代表提案**。

优势：可能平衡自动性、用户控制、可解释性。

风险：组合规则本身仍需定义权责边界 —— 即"何时由谁裁决"必须被显式定义，否则 Hybrid 会退化为隐式的 Model C。

---

## §3 Decision Criteria

评价标准（ADR 不应只列方案）：

### 1. Ownership Alignment
是否保持：
```
Primitive owner ≠ Continuity judge
```

### 2. User Agency
用户是否保留对 continuation 的最终影响权。

### 3. Deterministic Validation
是否可以测试：输入 primitive 集合 → 输出 primary。

### 4. Cognitive Boundary Safety
是否会导致系统进入"判断用户思想价值"。

### 5. Future Extensibility
是否允许 Reflection / Knowledge / PendingSlot 等继续扩展。

### 6. Authority Transparency
当 primary 被选择时，系统能否明确说明**"为什么由这个机制产生这个结果"**。

**这不是 Q2 的 rationale。** 区别：
- Q2 rationale：如何向用户/系统**表达结果原因**（expression）；
- Authority Transparency：**决策权结构本身是否透明**（authority）。

例：Model C 即使能输出 `primary = Reflection A`，若无法回答"为什么 Resolver 有资格选择 A"，问题就不在 explanation，而在 authority。

> 本条**不作为额外权重**，只作为审查问题。它不改变决策数量，也不参与任何加总。

---

## §3.1 Representation Precondition — OPEN（未冻结，非本 ADR 决策对象）

> 本小节是 **representation boundary** 的前提登记，不是一个 policy authority 决策。它不构成 ADR-0025，也不在此做出任何选择。

### §3.1.0 为什么必须先解决 representation

当前 §2 的候选空间隐含一个前提：

```
multiple primitives → one primary
```

但 Q1（authority）的成立**依赖**于这个前提：

- 若 `ContinueContext = single primary`，则"**谁拥有选择 primary 的权力**"是一个良构问题；
- 若 `ContinueContext = candidate space`，则 Q1 必须被重构为"**谁拥有 candidate filtering / presentation authority**"——问题性质发生变化。

因此，在 representation 未确定前，§2 的模型是在一个**未完全定义的问题空间**里比较。本文**不进入 §4 Decision**，直到本小节被处理。

### §3.1.1 Representation Models（仅记录空间，不作选择）

#### Model R1 — Single Primary

```
Candidates
    ↓
Resolver
    ↓
Primary
+
Supporting
```

优势：
- UX 简单；
- ContinueContext 语义明确；
- Endpoint 消费简单。

风险：
- 强迫系统提前收敛；
- 可能把"不确定"伪装成确定；
- primary 容易被用户理解成"系统认为最重要"。

#### Model R2 — Ranked Candidates（候选集合，非 ranking）

```
Candidates
    ↓
Continuation Set

[
 candidate A,
 candidate B,
 candidate C
]
```

优势：
- 保留多种可能；
- 减少系统替用户决定。

风险：
- 容易滑向 ranking；
- 与 ADR-0021 的 non-goal 有边界风险；
- UX 复杂度增加。

注意：**"候选集合"不等于 ranking**。R2 保留可能性的同时，必须机制性禁止对候选赋分/排序，否则退化为 ADR-0021 明确排除的方向。

#### Model R3 — User-selected Focus

```
Candidates
    ↓
User focus
    ↓
Current continuation
```

优势：
- 用户拥有最终选择权。

风险：
- 自动连续能力降低；
- 用户负担增加。

#### Model R4 — Contextual Primary（temporary projection）

```
Conversation context
+
user action
+
current situation

↓

temporary primary
```

特点：primary **不是 primitive 的属性**，而是当前 session 的 projection。

风险：必须非常清楚地区分
```
temporary resolution
```
与
```
cognitive judgment
```
否则会与 §1 Constraint A / B 的红线直接冲突。

### §3.1.2 关键判断（已有约束排除一个方向）

当前 Thought OS 的已有约束（ADR-0021 Constraint A/B、Primitive 为唯一事实源）已排除：

```
System finds the most important thought        (禁止)
```

而接近：

```
System establishes a possible continuation entry  (允许)
```

二者语义差别非常大。因此 representation 决策应回答：

> **ContinueContext 是"一个入口"还是"一个选择结果集合"？**

而不是：

> 哪个 primitive 最重要？

### §3.1.3 建议处理路径

- **Step 1**（本文已完成）：在 ADR-0022 登记 Representation Assumption Review，列 R1 / R2 / R3 / R4，不做决定。
- **Step 2**：确定 representation。可能结果：保留 single primary（R1），或修改 `ContinueContext` contract（R2/R3/R4）。
- **Step 3**：回到 Q1（§2）。
  - 若 `ContinueContext = single primary` → "谁拥有选择 primary 的权力"成立；
  - 若 `ContinueContext = candidate space` → Q1 重构为"谁拥有 candidate filtering / presentation authority"。

### §3.1.4 状态

```
Representation Precondition:
  Question: Must Continuity Resolution always produce a single primary?
  Decision: ContinueContext represents a possible continuation entry
            generated from available continuity primitives and current context projection.
  Status:   ACCEPTED (frozen 2026-08-04; representation layer closed)
  Owner:    Product representation decision (先于 ADR-0022 Decision)
```

> 状态推进依据：§3.1.5 完成四模型 criteria 分析，§3.1.6 完成连锁影响清单，§3.1.7 记录用户体验驱动判断输入（R1 表达层 / R4 生成机制两层分离），§3.1.8 正式冻结 representation decision。Representation 层已关闭；§4 Authority Decision 由此解锁为 OPEN QUESTION（仅重构问题，不给结论）。

### §3.1.5 Evaluation Criteria — 非评分式分析

> 本小节不新增模型，也不评分、不排名、不推荐。目的是把 §3.1.1 四个模型映射到一组**本体论判断维度**，使 representation 决策从"哪个体验更好"上升到"continuation 在 Thought OS 中是什么"。

#### §3.1.5.0 核心问题：ContinueContext 的本体

四个模型实际对应四种不同理解：

| 模型 | ContinueContext 被理解为 |
|---|---|
| R1 Single Primary | 恢复入口 |
| R2 Candidate Space | 可能入口集合 |
| R3 User-selected Focus | 用户意图后的当前焦点 |
| R4 Contextual Primary | 临时上下文投影 |

因此真正的判断标准不是"哪个体验更好"，而是：

> **在 Thought OS 中，continuation 是系统状态，还是用户与系统共同形成的当前关系？**

#### §3.1.5.1 四个 Representation Criteria

**Criterion 1 — Primitive Integrity**
是否保留：
```
Primitive ≠ Continuation selection
```
即：Reflection 本身不是"下一步"。

**Criterion 2 — User Agency Boundary**
系统是否替用户完成了：
```
"你真正想继续的是 X"
```

**Criterion 3 — Continuity Meaning**（最关键）
continuity 表示：
- A. `恢复过去未完成状态`
- B. `建立当前思考入口`
- C. `推荐可能延续方向`
三者完全不同，且只有 C 会触碰 §1 红线。

**Criterion 4 — Projection Stability**
ContinueContext 是否仍满足：
```
generated → consumed → discarded/regenerated
```
若 representation 需要持久保存 selection 结果，则违反 ADR-0021 Constraint C（Projection，非 state）。

#### §3.1.5.2 R1–R4 按四 Criteria 的非评分式分析

形式：每格记 **Strength / Tension / Open Question**，不可比大小、不可加总、不产生排名。

**R1 — Single Primary**

| Criterion | Strength | Tension | Open Question |
|---|---|---|---|
| Primitive Integrity | primary 是 resolver 输出，primitive 本身不被改写为"下一步" | — | 无 |
| User Agency Boundary | — | 系统产出唯一 primary，易读成"系统替你决定 X" | primary 究竟应理解为"入口"还是"判断结果"？ |
| Continuity Meaning | 最贴合 B（建立当前思考入口）；语义与 `GET /api/continue` 一致 | — | 若 primary 被误解为 A（恢复状态）或 C（推荐），则越界 |
| Projection Stability | `generated→consumed→discarded` 天然成立 | — | 无 |

**R2 — Candidate Space**

| Criterion | Strength | Tension | Open Question |
|---|---|---|---|
| Primitive Integrity | 不强加单一 selection，primitive 完整性最高 | — | 无 |
| User Agency Boundary | 系统不替用户决定，只呈现可能 | 但呈现本身即一种隐含引导 | "候选集合"由谁筛选、以什么边界纳入？ |
| Continuity Meaning | 最贴合 B 的"可能入口集合"变体 | 易被读成 C（推荐方向） | 如何机制性保证 `candidate space ≠ ordered ranking`？ |
| Projection Stability | 集合本身是临时投影 | — | 若集合需持久化以供跨 session 复用，是否违反 Constraint C？ |

**R3 — User-selected Focus**

| Criterion | Strength | Tension | Open Question |
|---|---|---|---|
| Primitive Integrity | 最高，selection 完全外置给用户 | — | 无 |
| User Agency Boundary | 用户是唯一裁决者，结构上不可能越界 | — | 无 |
| Continuity Meaning | 介于 A 与 B，取决于用户动作语义 | — | 它回答"谁选择"（用户），是否实质是 authority 的一种实现，而非 representation？ |
| Projection Stability | focus 随 session 生灭，最贴合 projection | 但用户选择偏好若被记忆则退化为 state | 偏好记忆边界在哪？ |

**R4 — Contextual Primary**

| Criterion | Strength | Tension | Open Question |
|---|---|---|---|
| Primitive Integrity | primary 明确不是 primitive 属性，而是 projection | — | 无 |
| User Agency Boundary | 取决于 context 来源是否含用户动作 | 若 context 来源不清，系统实质替用户决定 | "context" 由哪些信号构成、谁提供？ |
| Continuity Meaning | 最贴合 B（当前思考入口的临时投影） | 若 context 隐含系统判断则滑向 C | 如何证明 temporary resolution ≠ cognitive judgment？ |
| Projection Stability | 最贴合 `generated→consumed→discarded` | — | 无 |

#### §3.1.5.3 横向观察（不构成推荐）

- **Primitive Integrity**：四模型均不要求改写 primitive，R1/R4 最显式，R3 最强。
- **User Agency Boundary**：R1 张力最大（系统产出唯一结果）；R3 最干净；R2/R4 取决于筛选/context 来源是否透明。
- **Continuity Meaning**：只有 C（推荐方向）触碰 §1 红线；R1/R2/R4 均可落在 A 或 B，**但 R1 的"primary"措辞最易被误读为 C**，需显式定义其语义为"入口"而非"判断"。
- **Projection Stability**：R1/R4 天然满足；R2 在持久化时、R3 在偏好记忆时存在违反 Constraint C 的风险。
- **结构警示**：R3 可能不是 representation 而是 authority 的实现（它回答"用户选择"）——若选 R3，Q1 与 representation 会重合，需在 §3.1.3 Step 3 中明确不重复决策。R4 若 context 来源不清，会退化为隐式 Model C。

#### §3.1.5.4 回到本体问题

基于四 criteria，representation 决策应回答的不是"哪个模型好"，而是：

> **Thought OS 的 continuation 是系统状态（A/部分 C），还是用户与系统共同形成的当前关系（B，含 R1 入口语义 / R2 可能集合 / R3 用户焦点 / R4 临时投影）？**

该回答一旦确定，§3.1 Status 可冻结，§4 Authority Decision 的问题空间即被收窄。

---

### §3.1.6 Representation Decision Options

> **纪律**：本小节不评价哪个更优、不给推荐、不提前进入 Q1 实质决策。只显式化"若选择 X，ADR-0022 的 authority 问题会变成什么"。前面 §3.1.5 已闭合候选空间，此处仅把选择后的连锁影响列出，供 representation 决策门使用。

Status:

```
DECISION INPUT
```

Purpose:

> Define what ContinueContext represents before deciding who controls resolution authority.

---

#### Option R1 — Single Primary Continuation Entry

**Representation**

```
Candidates
    ↓
Resolved ContinueContext
    ↓
primary + supporting
```

ContinueContext represents:

> 一个当前恢复入口。

**Consequence to Q1**

Q1 保持原问题：

> 谁决定哪个 primitive 成为 primary？

Authority candidates:
- Runtime Rule
- User Explicit Action
- Resolver Policy
- Hybrid

**New constraints introduced**

需要明确：

```
primary ≠ important thought
```

必须定义：

> primary is an entry point, not a value judgment.

---

#### Option R2 — Candidate Continuation Space

**Representation**

```
Candidates
    ↓
ContinueContext
    ↓
candidate set
```

ContinueContext represents:

> 当前可继续的可能空间。

**Consequence to Q1**

Q1 需要重构。

不再是：

> 谁选择 primary？

而是：

> 谁决定 candidate inclusion / exclusion / presentation？

**New questions introduced**

需要明确：
- candidate 是否有顺序？
- 是否允许用户选择？
- supporting 是否仍存在？

**Constraint attention**

必须保持：

```
candidate space ≠ ranking system
```

否则进入 ADR-0021 排除范围。

---

#### Option R3 — User-selected Focus

**Representation**

```
Candidates
    ↓
User selection
    ↓
Current focus
```

ContinueContext represents:

> 用户当前选择的继续焦点。

**Consequence to Q1**

Q1 可能被重新定义为：

> 用户选择之前，系统是否拥有任何 resolution authority？

**Boundary issue**

R3 与 Authority 重叠：

representation:

```
"结果来自用户选择"
```

同时定义：

authority:

```
"用户拥有选择权"
```

需要避免两个 ADR 混合（representation 与 Q1 在此重合，决策时只在一个位置落定）。

**Constraint attention**

如果 focus 被持久保存：

需要重新审查：

是否形成新的用户状态源（违反 ADR-0021 Constraint C）。

---

#### Option R4 — Contextual Primary Projection

**Representation**

```
Current context
+
candidate primitives
+
interaction state

↓

temporary primary
```

ContinueContext represents:

> 当前上下文中的临时连续入口。

**Consequence to Q1**

Q1 变为：

> 谁定义 context resolution rules？

**Boundary issue**

需要证明：

```
context resolution
```

不是：

```
cognitive evaluation
```

**Constraint attention**

如果 context 来源不透明：

可能退化为：

```
Resolver Policy
        +
hidden judgment
```

（即隐式 Model C，触碰 §1 红线）

---

#### Cross-option Impact Summary

| Representation | Q1 是否保持原问题 | Q1 重构后形态 |
| -------------- | ----------------- | ---------------------------------- |
| R1 | 是：谁选择 primary | （不变） |
| R2 | 否：谁管理 candidate space | 谁决定 candidate inclusion / exclusion / presentation |
| R3 | 否：用户选择权如何进入 resolution | 用户选择前系统是否拥有任何 resolution authority |
| R4 | 部分变化：谁定义 contextual resolution | 谁定义 context resolution rules |

---

#### Decision Gate

§3.1 冻结时需要产生：

```
Representation Decision:

ContinueContext represents ______.

Therefore Q1 becomes ______.
```

然后：
- 若 R1 → 返回 ADR-0022 原 §4（authority 问题空间不变）；
- 若 R2 / R3 / R4 → 先按上表重构 Q1，再进入 authority decision。

---

#### §3.1.7 用户体验驱动的产品判断输入（决策输入，非最终冻结）

> 本小节记录一个来自产品视角的 representation 判断输入，作为 §3.1 Decision Gate 的候选填法之一。**它不构成最终决策**——最终冻结仍由 `ContinueContext represents ______.` 这句本体定义落定，且须经 §3.1.6 Decision Gate 分流。此处只把判断显式化，不代答、不评分。

**判断起点（用户体验目标）**

以"用户第一次回来打开 Thought OS 时希望看到什么"为最终判断，而非从架构纯洁性出发。用户不感知 Primitive / Resolver / Projection，只感知：
- 它还记得我上次在想什么；
- 它知道哪里没有结束；
- 它没有替我定义答案，但帮我接上了思路；
- 它理解我的长期思考轨迹。

因此 continuity 不是"找到最重要的一条思想"，而是：

> **找到一个让用户自然重新进入自己思考过程的入口。**

**对四模型的体验观察（非技术评分）**

- R1 入口：体验最强，人类天然需要入口（浏览器"继续阅读"、IDE"继续编辑"、笔记"继续上次"同构）。关键是把 `Primary Thought` 改写为 `Primary Continuation Entry`——主入口，不是主思想。
- R2 候选空间：理论尊重用户，但首体验弱（像搜索结果页，而非"它理解我"），要求用户再次选择。
- R3 用户焦点：最尊重用户，但依赖用户已知道想继续什么；而 Thought OS 价值恰在用户未整理清楚时提供连续性，否则退化为高级笔记。
- R4 上下文投影：体验最接近智能助手，但架构风险最大——须回答"为什么这个 context"，否则用户感觉"AI 自己决定"。

**提出的层次分离模型（非 Hybrid authority）**

不是把 R1/R4 拼成 Hybrid 权威，而是拆成两个不同层：

```
Representation:
    R1 — continuation entry        (用户看到的表达模型)
Resolution:
    R4 — contextual projection     (入口如何产生的内部生成机制)
```

即：
```
Primitive
    ↓
Context Resolution (R4 mechanism)
    ↓
Continuation Entry (R1 representation)
```

- R1 单独易变成固定规则；R4 单独易变成隐式判断。
- 组合后：用户体验确定性（R1 入口）保留，Resolver 不获得认知判断权（R4 机制来源须透明）。

**若采用此方向，§3.1 Decision 可写**

```
ContinueContext represents a possible continuation entry
generated from current context projection.
```

注意：不是 `the most important continuation`，不是 `the system-selected thought`，而是 `entry`。

**对 Q1 的重构影响**

原 Q1 "谁决定什么最值得继续" 本身措辞有问题（隐含价值判断）。改为：

> **谁定义 continuation entry 的生成 authority？**

这贴合 Thought OS 原始哲学：AI 不判断人的思想价值，AI 帮助恢复思考连续性。

**实施路径含义（仅记录，不进入实现）**

```
Representation:  ContinueContext = continuation entry
        ↓
Authority:       谁参与生成 entry (runtime policy / user action / context rules)
        ↓
Policy:          哪些 primitive 可贡献入口 (Reflection / PendingSlot / Knowledge)
        ↓
Implementation:  Resolver v0.2 = continuation entry generator (非聪明排序器)
```

**结构警示（保持纪律）**

- 此方向若选 R1 表达层，按 §3.1.6 Decision Gate 仍返回原 §4，但 Q1 措辞应从"选择 primary"修正为"定义 entry 生成 authority"，避免隐含价值判断；
- R4 作为生成机制，context 来源必须透明（呼应 §3.1.1 R4 / §3.1.6 R4 边界：否则退化为隐式 Model C）；
- 这是 representation 与 resolution 的层分离，与 §2 的 Model D（Hybrid Authority）不是同一事物，不得在 §4 误并。

---

#### §3.1.8 Representation Decision (Frozen — 2026-08-04)

> 本小节经 Decision Gate 正式关闭 representation 层。范围仅限 §3.1，不跨入 §4 实质结论。

**Decision**

```
ContinueContext represents a possible continuation entry
generated from available continuity primitives and current context projection.
```

中文：

> **ContinueContext 表示一个由已有 continuity primitives 与当前上下文投影生成的可能继续入口。**

对应分层（已决，非候选）：

```
Representation:        continuation entry          (R1 表达层语义)
Resolution mechanism:  contextual projection        (R4 生成机制)
```

**冻结约束（五条，继承自既有纪律）**

- `continuation entry ≠ most important thought` —— 入口非结论；
- `primary ≠ cognitive judgment` —— 主入口非主思想、非价值判断（ADR-0021 Constraint B）；
- `projection ≠ new state source` —— ContinueContext 仍为 projection，非事实源（ADR-0021 Constraint C）；
- `Resolver ≠ evaluator` —— Resolver 不拥有认知评价权（ADR-0021 Constraint A）；
- `context projection ≠ hidden memory authority` —— context 来源须透明，不得退化为隐式 Model C。

**冻结后唯一开放问题（下一阶段）**

```
Who defines the generation authority of a continuation entry?
```

此问题不再讨论"什么思想更值得继续"，而讨论：

> continuation entry 的生成规则由谁定义、谁拥有修改权与解释权。

**状态分流**

- §3.1 Representation：**ACCEPTED**（frozen）；
- §4 Authority：**OPEN QUESTION**（reframed，未决）；
- Representation = frozen / Authority = open，不一次跨两层。

---

> 原 §3.1 登记的 "Model E（User-defined Continuity Space）" 已并入 §3.1.1 R3（User-selected Focus）表述，不再单列为 E。

---

## §3.2 Options Matrix (A/B/C/D × 6 criteria)

矩阵目的是**把隐含权衡显性化**，不是评分。

> 刻意不采用 `A = 8.5 / B = 7.2` 形式 —— 那会把产品哲学问题伪装成工程优化问题。
> 每格记 **Strength / Tension / Open Risk** 三项，不可比大小、不可加总、不产生排名。

### Model A — Runtime Rule Authority

| Criteria | Strength | Tension | Open Risk |
|---|---|---|---|
| Ownership Alignment | 规则外置于 primitive，owner 与 judge 天然分离 | 规则由谁书写、何时修订未定义 | 规则本身可能固化为隐性产品主张 |
| User Agency | — | 用户不参与，仅被动接受结果 | 用户与规则冲突时无表达通道 |
| Deterministic Validation | 输入集合 → 输出 primary 完全可测 | — | 无 |
| Cognitive Boundary Safety | 不判断价值，只应用顺序，最贴合 Constraint B | — | 低 |
| Future Extensibility | 新 primitive 只需插入顺序 | 顺序随类型增多而组合膨胀 | 规则表可能变成事实上的权重系统 |
| Authority Transparency | 可直答"因为规则如此" | 但无法回答"规则凭什么如此" | 权威落在规则作者，未被显式命名 |

### Model B — User Explicit Authority

| Criteria | Strength | Tension | Open Risk |
|---|---|---|---|
| Ownership Alignment | 系统完全不做 judge，结构最干净 | — | 无 |
| User Agency | 最高，用户是唯一裁决者 | 代价是必须主动管理 continuation | 无操作时系统无输出，continuity 退化为空 |
| Deterministic Validation | 输出等于用户输入，可测 | 但可测的是记录而非决策 | 无法验证"未选择"是否符合用户意图 |
| Cognitive Boundary Safety | 结构上不可能越界 | — | 低 |
| Future Extensibility | 新 primitive 只需增加一个可选动作 | 选项增多提高用户认知负担 | 候选过多时用户实质放弃选择 |
| Authority Transparency | 最高，权威即用户本人 | — | 无 |

### Model C — Resolver Policy Authority

| Criteria | Strength | Tension | Open Risk |
|---|---|---|---|
| Ownership Alignment | 仍是 read-side，未改 ownership | 但 judge 角色实质由系统承担 | 与 §1 红线最接近 |
| User Agency | — | 用户影响力仅间接体现于 metadata | 用户可能无法推翻系统判断 |
| Deterministic Validation | metadata 驱动，原则上可测 | 依赖 metadata 语义稳定 | 策略演化后旧测试语义漂移 |
| Cognitive Boundary Safety | — | **需证明 policy ≠ cognitive evaluation** | 从 resolve continuity 滑向 evaluate thought importance |
| Future Extensibility | 自动化能力最高，可综合多 primitive | 每新增 primitive 都需扩展策略语义 | 策略层持续膨胀直至成为隐性 memory system |
| Authority Transparency | 可输出机制轨迹 | 但无法自证"为何 Resolver 有资格决定" | **authority ambiguity** |

### Model D — Hybrid Authority

| Criteria | Strength | Tension | Open Risk |
|---|---|---|---|
| Ownership Alignment | 可按层分配 judge 角色 | 分层边界若模糊则 alignment 不可断言 | 边界未显式定义时退化为 Model C |
| User Agency | 用户意图可置于最高层 | 需定义用户不表达时的兜底 | 兜底路径长期生效则实为 A 或 C |
| Deterministic Validation | 各层单独可测 | 层间切换条件必须可测才整体可测 | 切换条件隐式化则不可验证 |
| Cognitive Boundary Safety | 可把系统限制在低优先层 | 取决于分界是否机制性 | 依赖实现自律则不安全 |
| Future Extensibility | 新 primitive 可挂载到相应层 | 层数与规则同时增长 | 复杂度最高 |
| Authority Transparency | 可回答"本次由哪一层裁决" | 前提是"何时由谁裁决"已显式定义 | 未定义则权威归属不可追溯 |

### 横向观察（不构成推荐）

- Constraint A/B 红线只对 **Model C** 构成结构性挑战；A/B 在此维度是安全的，D 取决于分界是否机制性。
- **User Agency** 与 **自动连续体验** 在 A 与 B 之间构成直接对立，这是本决策的核心张力，无法由工程手段消解。
- **Authority Transparency** 上 B 最高、C 最低；A 与 D 均落在"机制可述、权威来源未命名"的中间状态。
- 若 §3.1（Representation Precondition）的 single-primary 假设被推翻，各模型的 User Agency 与 Authority Transparency 评估**均需重估**——这正是本文先冻结 §4 Decision 的原因（见 §3.1.0）。

---

## §4 Decision

> §3.1 Representation 已于 2026-08-04 冻结（ACCEPTED）。本 §4 在重构后的问题下完成 authority 决策。本文仍不进入 Policy/Implementation 层（Phase C/D 不在本 ADR 范围）。

**Open Question (reframed)**

```
Who defines the generation authority of a continuation entry?

即：continuation entry 的生成规则由谁定义、谁拥有修改权与解释权？
```

原 Q1 措辞 "Who decides what is worth continuing?" 已废弃——它隐含价值判断，与 §3.1 冻结约束冲突。重构后的问题不再讨论"什么思想更值得继续"，而讨论生成规则的归属。

### Decision

**选 Model D（Shared / Hybrid Authority）**——但将 Hybrid 从"系统与用户共同判断思想价值"重新定义为：

> **Continuity Policy owns generation authority; User owns final acceptance authority.**

即：系统负责生成一个可能的继续入口，用户决定是否接受这个入口。不是"系统和用户一起决定哪个思想更重要"。

**Authority 分层（冻结）**

| 层 | 权限 |
|---|---|
| Primitive | 提供事实材料（唯一事实源，ADR-0021） |
| Continuity Policy | 定义 entry 的生成规则（generation authority） |
| Resolver | 执行规则并生成 ContinueContext（read-side，无认知评价权，Constraint A） |
| User | 决定是否继续（final acceptance authority：accept / modify / ignore） |

**Why not A / B / C**

- **Model A（System Authority）不选**：系统规则决定 entry 出现，易滑向"我认为你应该继续这个"——认知判断风险。
- **Model B（User Authority）不选**：用户自指定继续什么，失去 Thought OS 核心价值，退化为历史记录/搜索/笔记导航。
- **Model C（Runtime Context Authority）不选**：Runtime 依上下文自动决定，最易触碰 ADR-0021 Constraint A/B（`System decides what matters about user's thought`）。

**最终架构语义（与 §3.1 组合）**

```
Primitive
   ↓
Continuity Policy (Model D generation authority)
   ↓
Resolver
   ↓
ContinueContext (possible entry — 见 §3.1.8)
   ↓
User choice (accept / modify / ignore)
```

**约束保持**：本决策不违反 §3.1 五约束（entry≠最重要思想 / primary≠认知判断 / projection≠事实源 / Resolver≠evaluator / context projection≠hidden memory authority）；User 的 final agency 不赋予 Resolver 任何认知评价权。

```
Decision:

Model D — Shared Authority
  Generation authority: Continuity Policy
  Final acceptance authority: User

Decision owner:
Product philosophy decision
Decision date:
2026-08-04
```

---

## §5 Consequences

**正向后果**
- Authority 边界显式化：generation 在 Continuity Policy，acceptance 在 User，Resolver 仍是无认知权的 read-side 执行者（Constraint A 保持）。
- 与 §3.1 组合后，`Continuation entry` 既有表达模型（R1 entry）又有生成机制（R4 contextual projection）与权威归属（Model D），三层闭合。
- 不引入新的事实源：Primitive 仍为唯一事实源，ContinueContext 仍为 projection（Constraint C 保持）。

**需后续解决的后果（不在本 ADR）**
- Continuity Policy 的"生成规则"具体由谁书写、如何修订、如何向用户解释（关联 §3 Criteria #6 Authority Transparency 与 Q2 rationale）。
- Resolver 执行规则时的确定性验证边界（关联 §3 Criteria #3 Deterministic Validation）。
- User final agency 的界面表达（accept / modify / ignore）与 Q2 表达层 ADR-0023 衔接。
- 本决策触发 Q3 Knowledge lifecycle（ADR-0024）：Knowledge 是否可贡献 entry、以何种角色（supporting？）进入生成。

**未改变项**
- 不进入 Phase C Proof Scope 与 Phase D Implementation；
- 不涉及 ranking / scoring / freshness / LLM 决策；
- v0.1 Resolver 实现线不动。

---

## §6 Out of scope（本 ADR 不解决）

- 任何 ranking / scoring / weighting 算法
- freshness 或衰减函数
- Q2 rationale 语义（→ ADR-0023）
- Q3 Knowledge 生命周期（→ ADR-0024）
- Phase C proof scope 与任何实现

---

*Decision record, Phase 4 v0.2 Phase A / Q1. Candidate space complete; §4 Decision frozen until §3.1 Representation Precondition is resolved — authority depends on representation prerequisite.*
