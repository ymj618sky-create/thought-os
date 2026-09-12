# Cognitive Layering Review

**Status:** CONCLUDED — ADR-0025 ACCEPTED
**Scope:** Cognitive semantic layering only
**Implementation:** None (forwarded to Observation Projection implementation cycle)
**ADR:** [0025-cognitive-layering-semantic-boundaries.md](../../adr/0025-cognitive-layering-semantic-boundaries.md) (Accepted)
**Date:** 2026-08-09
**Concluded:** 2026-08-09

---

## 1. Purpose

本 Review 讨论 Thought OS 当前认知链中 `Evidence → Fact` 所产生的语义增量不足问题，并重新审视：

* Fact 的职责；
* Observation 与 Candidate Pattern 的边界；
* Evidence 如何产生可观察关系；
* Candidate Pattern 如何进入用户确认；
* 确认后的认知对象如何进入现有 Thought 生命周期。

本 Review **不修改代码、不新增 primitive、不修改 schema、不修改数据库、不修改 scheduler/runtime/UI**。

目标不是立即设计实现，而是先确定认知层语义边界。

---

# 2. Problem Statement

当前系统中的部分 Fact 本质上只是 Evidence 的语义压缩或改写。

例如：

> Evidence：
> “最近几次开会的时候，我发现自己越来越不想发言，而且会提前找借口离开。”

可能被提取为：

> Fact：
> “你最近越来越不想在会议中发言。”

这种转换存在两个问题。

### 2.1 信息增量不足

Evidence 已经包含了主要信息。

Fact 并没有告诉用户：

* 这条信息与其他 Evidence 的关系；
* 是否存在重复出现；
* 是否发生变化；
* 是否存在矛盾；
* 是否形成稳定模式。

因此：

> Evidence → Fact

容易退化成：

> 原始材料 → AI 改写

而不是：

> 原始材料 → 新的认知结构。

### 2.2 存在确定性提升风险

Evidence 中可能包含：

* 主观感受；
* 时间限定；
* 不确定性；
* 上下文；
* 自我修正。

如果 AI 将其改写为确定性的 Fact，就可能产生未经用户确认的语义升级。

例如：

> “我好像越来越不想做这个了。”

被转换成：

> “你越来越不想做这个。”

后者已经比原始 Evidence 更接近判断。

这与 Thought OS 的 Constitution 原则存在潜在冲突：

> AI 可以发现、组织和呈现材料，但不应替用户完成认知判断。

---

# 3. Proposed Semantic Layering

初步建议将认知链理解为：

```text
Evidence
   │
   ├── explicit stable information
   │          ↓
   │        Fact
   │
   └── relationships across Evidence
              ↓
        Observation Projection
              ↓
   Interpretation Candidate
   （Interpretation 的候选状态，非新层）
              ↓
       User confirmation
              ↓
           Thought
```

该模型不是增加新的事实源，而是重新定义不同层的职责。

## 3.1 反对五层链膨胀

`Candidate Pattern` 不应成为新的持久化认知层。若把它与已有 `Interpretation` 层并列，会形成：

```text
Evidence → Observation → Candidate Pattern → Interpretation → Thought
```

这个五层链没有必要，且会引入新的生命周期、provenance 与 authority 问题。

`Candidate Pattern` 更合理的定位是 **Interpretation 的生成/呈现状态**：

> Interpretation 尚未获得用户确认时的候选状态。

因此最终收敛为：

```text
Evidence
   ↓
Observation Projection
   ↓
Interpretation Candidate
   ↓
User accepts / rejects / corrects
   ↓
Thought
```

`Interpretation Candidate` 不是新的事实源，只是 Interpretation 的候选呈现。

---

# 4. Evidence

## 4.1 Definition

Evidence 是原始认知材料。

包括但不限于：

* 用户原话；
* 用户描述的经历；
* 对话中出现的陈述；
* 已存在的可追溯认知材料。

Evidence 的核心属性是：

> **provenance，而不是 interpretation。**

Evidence 不需要用户确认其“认知意义”。

---

# 5. Fact

## 5.1 Revised Definition

Fact 保留，但职责降级为：

> **Explicit Stable Fact**

即：

> Evidence 中明确表达、相对稳定、无需 AI 推断即可成立的信息。

例如：

> “公司每周一召开周会。”

> “我目前在 A 公司工作。”

> “项目预计 9 月上线。”

这些信息可以被结构化，但不需要把它们包装成“AI 发现”。

## 5.2 Non-Examples

以下不应直接成为 Fact：

> “我越来越不喜欢现在的工作。”

> “我正在逃避这个项目。”

> “我可能已经失去动力。”

这些内容包含：

* 趋势判断；
* 因果判断；
* 心理状态判断；
* 解释性判断。

它们应进入 Observation / Candidate Pattern 的处理范围，而不是 Fact。

## 5.3 Architectural Role

Fact 可以继续作为 Evidence 的结构化索引或 projection。

它不应成为新的独立认知权威。

原则：

```text
Evidence → Fact
```

不得改变原始 Evidence 的语义权威。

---

# 6. Observation

## 6.1 Definition

Observation 不是 Evidence 的改写。

Observation 描述：

> **多个 Evidence 之间出现了什么可观察关系。**

### 6.1.1 最小语义单位：relationship，不是句子

Observation 的最小语义单位**不是一句改写后的事实**，而是：

> **`relationship(Evidence₁ … Evidenceₙ)`**

即 Observation 是对多个 Evidence 之间关系的计算，而不是对单条 Evidence 的重新描述。

例如：

```text
E1：昨天开完周会后特别累
E2：今天不太想参加会议
E3：最近周会前会焦虑
```

Observation（recurrence 关系）：

> “近 30 天有 3 条 Evidence 均独立表达了‘周会前的回避/负面情绪’。”

或（trend 关系）：

> “相比此前记录，近期关于周会的负面表达明显增多。”

这里的增量来自：

> **Evidence → relationship（计算 Evidence 之间的关系）**

而不是：

> **Evidence → paraphrase（把原话改成更短的句子）**

### 6.1.2 关系类型闭集（候选）

Observation 的 relationship 类型建议取自闭集：

| 类型 | 含义 |
| ---- | ---- |
| recurrence | 重复：同类 Evidence 在不同时间重复出现 |
| trend | 变化：同一主题出现明显方向变化 |
| contrast | 对比：不同 Evidence 表达不同侧面 |
| contradiction | 矛盾：不同 Evidence 出现明显冲突 |
| correlation | 共现：多个原本不同的主题稳定共同出现 |
| absence | 缺失/长期未出现：此前频繁出现的主题持续缺席 |

### 6.1.3 relationship validity > evidence count

Evidence 数量只是**支持关系成立的证据**，不是**生成 Observation 的充分条件**。

反例：5 条 Evidence 都提到“咖啡”，不应自动产生 Observation。
正例：3 条 Evidence 都独立表达“会议前开始焦虑”，可能已形成一个有效 recurrence。

因此 Observation 的准入标准是：

> **关系本身是否可辨识、是否有认知意义（relationship validity）**

数量阈值只能作为特定关系类型（如 recurrence 需要 ≥ N 条）的辅助条件，不得作为首要标准。

## 6.2 Observation 的性质

Observation 应保持：

* 可追溯；
* 可解释；
* 可回到 Evidence（必须带 evidence provenance）；
* 不要求用户接受；
* 不直接宣称“这就是你的认知”。

## 6.3 Observation 是 Projection

第一版不建议将 Observation 定义为新的 Thought-like primitive。

Observation 应首先是 Projection：

```text
Evidence
   ↓
Observation Projection
```

它可以由系统重新计算。

因此：

* 不成为新的事实源；
* 不拥有认知权；
* 不直接进入 Thought 生命周期；
* 不覆盖或修改 Evidence；
* 不等同于用户已经接受的认知。

这复用 Thought OS 已有的 Projection boundary discipline。

---

# 7. Interpretation Candidate（非新层）

Observation 与 Interpretation Candidate 必须分开。注意：`Interpretation Candidate` **不是新 primitive**，而是已有 `Interpretation` 层在获得用户确认之前的候选状态（见 §3.1、§20.2）。

## 7.1 Observation

回答：

> **“我们观察到了什么关系？”**

例如：

> “过去 30 天有 4 条 Evidence 涉及会议回避。”

## 7.2 Interpretation Candidate

回答：

> **“这些关系是否可能构成一个值得用户判断的解释？”**

例如：

> “这些记录是否可能说明，你正在逐渐失去对当前工作方式的投入？”

Interpretation Candidate 开始具有解释性，开始携带较高的判断风险。

但它只是 Interpretation 的候选呈现——尚未成为用户拥有的认知，也尚未获得 Interpretation 层的已确认地位。

---

# 8. User Confirmation

确认动作不应该发生在普通 Fact 层。

真正有价值的确认是：

```text
Candidate Pattern
        ↓
     User action
        ↓
 ┌──────┼────────┐
 ▼      ▼        ▼
确认   修正      拒绝
```

用户可以：

### Confirm

> “对，这就是我最近的状态。”

### Correct

> “不是工作环境，是管理方式。”

### Reject

> “不是，我只是最近太忙。”

这三个动作都具有认知价值。

尤其是 Correction：

> AI 产生候选解释 → 用户修正语义 → Thought 形成

这比简单的“确认 AI 有没有正确复述”更符合 Thought OS 的核心价值。

---

# 9. Thought

Thought 保持现有 primitive 的地位。

Candidate Pattern 本身不是 Thought。

只有在用户确认或修正之后，才允许 materialize 成 Thought。

因此：

```text
Observation
    ↓
Candidate Pattern
    ↓
User confirmation / correction
    ↓
Thought
```

这一点必须保持明确。

否则系统会重新产生：

> AI inference → user-owned Thought

从而重新引入 Constitution 所禁止的认知替代。

---

# 10. Candidate Pattern Generation Boundary

这是本 Review 尚未冻结的核心问题之一。

**修正（2026-08-09）：不能现在预设“同 theme 出现 N 次即可生成 Candidate Pattern”这类数量阈值。** 数量本身不是认知价值，用数量阈值容易把“认知价值”退化成计数问题。

正确顺序应是：**先定义关系成立条件（relationship validity），再决定特定关系类型是否需要数量阈值作为辅助。**

不同关系类型可能需要不同的证据条件。例如：

### Recurrence

同类 Evidence 在不同时间重复出现。

### Change

同一主题出现明显方向变化。

```text
以前：很期待
后来：无所谓
最近：开始回避
```

### Contradiction

不同 Evidence 出现明显冲突。

```text
“我很想做这个项目。”

vs

“我一直在找理由不做这个项目。”
```

### Co-occurrence

多个原本不同的主题稳定地共同出现。

因此，Candidate Pattern 的生成条件应首先定义为：

> **relationship validity**

即“什么样的关系结构足以构成一个值得呈现给用户审视的候选”。

数量阈值（如 recurrence 需要 ≥ N 条）只能作为特定关系类型的**辅助条件**，不能作为首要准入标准。首要准入标准必须是关系本身的可辨识结构与认知意义，而非计数。

---

# 11. Candidate Pattern 与 Question

Candidate Pattern 不等同于 Question。

二者职责不同：

```text
Candidate Pattern
= AI 发现的候选认知对象

Question
= AI 为帮助用户判断该候选对象而提出的入口
```

因此：

```text
Evidence
   ↓
Observation
   ↓
Candidate Pattern
   ↓
Question
   ↓
User response
   ↓
Thought
```

Questioner 的价值因此从：

> 围绕 Evidence 逐条追问

转向：

> 帮助用户判断 Evidence 之间形成的候选关系。

例如：

### 旧模式

> “你为什么不想参加会议？”

### 新模式

> “最近几次记录里，会议都伴随着疲惫和回避。你觉得这只是最近状态不好，还是你正在对这种工作方式本身产生抗拒？”

后者才真正利用了跨 Evidence 的信息增量。

---

# 12. Inbox Role

Inbox 不应继续承担：

> AI Fact 收件箱

而应逐渐成为：

> **Cognitive Candidate Space**

即：

> 用户可能值得重新看一眼的认知候选。

因此，Inbox 中更有价值的对象是：

```text
Candidate Pattern
   ↓
相关 Evidence
   ↓
用户确认 / 修正 / 忽略
```

而不是：

```text
Fact
Fact
Fact
Fact
Fact
```

---

# 13. Relationship to Existing Architecture

本 Review 必须避免重新创造已有概念。

初步映射：

| Concept                | Role                                        |
| ---------------------- | ------------------------------------------- |
| Evidence               | 原始材料 / provenance                           |
| Fact                   | Explicit Stable Fact                        |
| Observation            | Evidence relationship projection            |
| Interpretation Candidate | Interpretation 的候选状态（非新层），待用户判断         |
| Interpretation         | AI 提出的解释（已存在层），带置信度，待用户审视              |
| Thought                | 用户确认后的认知对象                                  |
| Question               | 帮助用户判断候选对象的交互入口                             |
| Reflection             | 对已有 Thought / Reflection Event 的 projection |
| Tension                | 已存在的认知冲突结构                                  |
| Continuity             | 延续未完成思考的入口                                  |

Observation 不应替代 Reflection。

Interpretation Candidate 不是新 primitive，也不应替代 Thought（它只是 Interpretation 的候选状态）。

Question 仍然是 Question，而不是认知实体。

---

# 14. Projection Boundary

必须继承现有 Projection 纪律：

### Observation Projection 可以：

* 读取 Evidence；
* 分析 Evidence 之间关系；
* 生成临时观察结果；
* 提供 Evidence provenance；
* 作为 Interpretation Candidate 的输入。

### Observation Projection 不可以：

* 修改 Evidence；
* 修改 Thought；
* 自动创建用户认知；
* 成为独立事实源；
* 获得 Resolver-like authority；
* 把 AI inference 直接 materialize 成 Thought。

核心原则：

> **Projection 可以发现，不可以拥有。**

---

# 15. Open Questions

本 Review 暂不冻结以下问题：

### Q1

Fact 是否继续保留，以及最终的数据模型是否需要进一步调整。

### Q2

Observation 是否只保持 Projection，还是未来需要某种可缓存但非认知性的 projection artifact。

### Q3

Observation 的 relationship taxonomy 如何定义。

候选：

* recurrence
* change
* contradiction
* co-occurrence
* absence / disappearance
* escalation / decline

### Q4

Candidate Pattern 的生成条件如何定义。

重点不是简单数量阈值，而是：

> 什么关系足以值得呈现给用户？

（见 §10 修正：先 relationship validity，后数量阈值。）

### Q5

Candidate Pattern 如何避免过度解释。

尤其需要定义：

* observation 与 interpretation 的边界；
* confidence 是否必要；
* 语言如何表达不确定性；
* 什么情况下禁止生成 candidate。

### Q6

用户修正 Candidate Pattern 后如何形成 Thought。

需要与现有 Thought lifecycle 对齐，而不是创建新的生命周期。

### Q7

Questioner 如何消费 Candidate Pattern。

需要避免让 Questioner 重新直接依赖大量 Evidence 碎片。

---

# 16. Proposed Review Sequence

建议严格按以下顺序推进：

```text
Step 1
确定 Fact / Observation / Candidate Pattern / Thought 的语义边界

        ↓

Step 2
确定 Observation relationship taxonomy

        ↓

Step 3
确定 Observation → Interpretation Candidate 的生成条件

        ↓

Step 4
确定 Interpretation Candidate → User action → Thought 的确认协议

        ↓

Step 5
重新定义 Questioner 的输入

        ↓

Step 6
最后才讨论 Inbox / UI / implementation
```

禁止反向推进。

特别是：

> **不能先改 Questioner，然后倒推 Pattern 的定义。**

否则会再次形成模块驱动的语义设计。

---

# 17. Provisional Architectural Principle

当前 Review 可以暂时用以下原则作为讨论基准，但尚不作为 ADR 冻结：

> **Evidence records what happened.
> Fact records what is explicitly and stably stated.
> Observation reveals relationships among Evidence.
> Interpretation Candidate proposes an interpretation worth examining.
> Thought belongs to the user and exists only after user confirmation or correction.**

中文：

> **Evidence 记录发生过什么。**
> **Fact 记录明确且稳定表达的信息。**
> **Observation 发现 Evidence 之间的关系。**
> **Interpretation Candidate 提出值得用户审视的候选解释。**
> **Thought 属于用户，并只在用户确认或修正后形成。**

这条链是当前 Cognitive Layering Review 的核心假设。

---

# 18. Non-Goals

本 Review 不处理：

* Questioner 当前具体 bug；
* Question schema；
* Evidence schema；
* 数据迁移；
* scheduler；
* RuntimeBudget；
* cursor；
* encryption；
* Tauri runtime；
* UI 实现；
* Notification；
* Continuity Resolver 实现。

这些属于后续独立 implementation cycle。

---

# 19. Review Status

**Status: OPEN**

当前尚未形成 ADR。

当前唯一需要继续讨论的核心问题是：

> **什么样的 Evidence relationship，才足以成为一个值得用户审视的 Candidate Pattern？**

这个问题解决后，后续的数据结构、Projection、Questioner 和 Inbox 才有可靠的设计基础。

这个版本不建议急着转 ADR。真正的架构难点已经从“Fact 要不要删”转移到了 **Observation → Candidate Pattern 的准入标准**。

而且这里有一个关键的产品原则：

> **Thought OS 的价值不是帮用户记住更多事实，而是让用户看见自己原本分散、没有被看见的关系。**

如果最终做不到这一点，Fact、Observation、Pattern 再怎么设计，都只是更漂亮的数据整理器。

---

# 20. 与现有 Roadmap / Observation Spec 的关系及待决张力

本 Review 不是从零开始，必须显式对齐已有文档，避免重复造层。

## 20.1 已有相关文档

* `Cognitive_Chain_Enhancement_Roadmap.md`（Plan，2026-08-06）：已定义 `Evidence → Observation → Interpretation → Thought` 链，并明确：
  * Observation = 客观描述、可核验、不添加解释（§方向 1）；
  * Interpretation = 允许 AI 提出解释、带置信度、不宣布结论（§方向 2，对应 Constitution Article 5）；
  * 已存在分阶段路线 Phase A(Observation) → B(Domain-aware) → C(Interpretation) → D(Reflection)，且明确“不新增认知层”。
* `Observation_Enhancement_v0.1.md`（Implementation Spec，已落地 A2 Concept Tracking）：Observation 已是 `pattern_type` 闭集 + Projection，禁止越界到 Interpretation；边界纪律见 §6.3。

## 20.2 已决：Interpretation Candidate = Interpretation 层的候选状态（非新层）

本 Review 已收敛结论（2026-08-09 第二轮讨论）：`Candidate Pattern` 不应成为新 primitive，而是已有 `Interpretation` 层在获得用户确认之前的**候选状态**。

理由：

1. `Candidate Pattern` 的两项职责（提出候选解释、要求用户确认/修正/拒绝）与 Roadmap 中已定义的 `Interpretation` 层**完全重叠**：
   * Roadmap §方向 2 明确 Interpretation 才是“AI 提出解释、带置信度、值得用户审视”的位置；
   * Roadmap §兼容矩阵明确 Interpretation 层独占“意义赋予”，Observation 不越界。
2. 若另立 `Candidate Pattern` 为新层，会形成五层链 `Evidence → Observation → Candidate Pattern → Interpretation → Thought`，引入新的生命周期 / provenance / authority 问题，且违反 Roadmap “不新增认知层”总原则。

因此本 Review 采用 **(b) 方案**：

> **Interpretation Candidate = Interpretation 的候选呈现与确认协议，不是新 primitive。**

最终认知链收敛为：

```text
Evidence
   ↓
Observation Projection        （relationship detection）
   ↓
Interpretation Candidate      （meaning hypothesis，未确认）
   ↓
User accepts / rejects / corrects
   ↓
Thought                       （用户确认后才 materialize）
```

§13 映射表已补 `Interpretation` 行；全文 `Candidate Pattern` 已统一为 `Interpretation Candidate`。

## 20.3 与 Roadmap 阶段纪律的一致性

`Interpretation Candidate` 不新增认知层，属于 Roadmap 的 Phase C（Interpretation Enhancement）范畴，应在 Alpha 观察信号回来后、按 Roadmap §5 的触发条件进入，而不是现在开启：

* 它复用 Roadmap §方向 2 的 Interpretation 定义（提解释、带置信度、不宣布结论），不另起标准；
* 若未来确有超出 Interpretation 层能力的候选呈现需求，仍须先过 `DOCUMENTATION.md §4` 新能力准入检查与 Roadmap §7 的“Mapping 优先于发明”纪律，而非直接新增 primitive。

## 20.4 不改变已冻结范围

本 Review 不推翻以下已冻结内容：

* `Observation_Enhancement_v0.1.md` §10 冻结范围（Phase A/A2 收口，禁止新 pattern_type 扩展、Reflection/ContinueContext 接入、Knowledge Layer、User Modeling，直到 Alpha UX 信号回来）；
* Roadmap §5 Stage 1 Alpha 边界（专业能力深度不在 Alpha 范围）；
* Phase 4 已冻结的 Projection / Resolver 边界（不新增事实源、Resolver 不持认知权）。

本 Review 当前仅是语义层讨论稿，不触发任何实现，也不修改上述冻结文档。

---

# 21. 核心产品判断（收口）

> **Thought OS 的价值不是帮用户记住更多事实，而是让用户看见自己原本分散、没有被看见的关系。**

这要求系统从“提取事实”转向“呈现关系”，并对每一层严格区分：

* 谁在描述（Evidence）；
* 谁在发现关系（Observation）；
* 谁在提候选解释（Candidate Pattern / Interpretation）；
* 谁在做最终判断（User → Thought）。

任何一层若越权替下一层完成职责，都会重新引入 Constitution 所禁止的认知替代。这应是整个 Cognitive Layering 演化的不可逾越的红线。

---

# 22. Five Architecture Decisions（下一轮 Review 的正式决策输入）

本 Review 已收敛术语与链结构，下一步不再围绕“是否写文档”来回确认，而应直接进入以下 5 个架构判断的决策。这 5 项不是扩文档，而是把 Review 转为可落 ADR 的决策输入。

### D1 — Fact 的最终职责

* 只保留 **Explicit Stable Fact**（明确表达、相对稳定、无需 AI 推断即可成立）。
* 不承担认知模式发现；不把含趋势/因果/心理/解释判断的内容包装成 Fact。
* Fact 可作为 Evidence 的结构化索引 / projection，不成为独立认知权威。

### D2 — Observation 的最小语义单位

* **不是句子**，是 `relationship(Evidence₁ … Evidenceₙ)`。
* Observation = 对多个 Evidence 之间关系的计算，而非单条 Evidence 的改写。
* 关系类型取闭集：recurrence / trend / contrast / contradiction / correlation / absence。

### D3 — Observation 是否持久化

* **不作为 primitive 持久化**。
* 保持 Projection，可重新计算；必须带 Evidence provenance。
* 不拥有认知权、不进入 Thought 生命周期、不修改 Evidence。

### D4 — Interpretation Candidate 是什么

* **不是新层**。
* 是 `Interpretation` 的 candidate state / presentation（见 §3.1、§20.2）。
* 可被用户接受 / 拒绝 / 修正；修正语义后流入 Thought。

### D5 — 什么时候真正产生 Thought

* **只有用户确认 / 修正之后**。
* AI 永远不能因为“模式看起来很明显”自动把 Interpretation 变成 Thought。
* 这是 Constitution “AI 不替用户做判断”的硬边界。

### 收敛后的最终链

```text
RAW
Evidence
  │
  │ relationship detection
  ▼
PROJECTED
Observation
  │
  │ meaning hypothesis
  ▼
CANDIDATE
Interpretation
  │
  │ user judgment
  ▼
CONFIRMED
Thought
```

这比当前的 `Evidence → Fact → Inbox` 有本质区别：它完成了从“材料”到“认知”的计算，而非从“原话”到“改写句子”的转换。

### 推进纪律（禁止反向）

下一阶段**不应先改 Fact，也不应先改 Questioner**。先把 Observation / Interpretation 的语义与 authority 冻结（D1–D5 + §20.2 结论），再让 Inbox 与 Questioner 消费其结果。否则会再次回到“哪里空了就修哪里”的局部优化。

---

*Discussion Draft — Cognitive Layering Review. No code, no new primitive, no ADR. §20.2 已收敛为结论 (b)；剩余开放问题见 §15 与 §22 D1–D5 的细化（如需转 ADR 再展开）。*
