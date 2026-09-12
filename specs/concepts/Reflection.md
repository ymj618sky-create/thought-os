# Concept: Reflection

**所属层**: `specs/concepts/`
**关联 Schema**: `specs/schemas/Reflection.schema.json`
**关联重构方案**: `specs/Rethink_Refactor_Plan.md` §1.2、§3
**关联 Constitution 条款**: Article 5（AI 只能观察/提问/建议/总结，不能定义/判定/宣布）、Article 8（区分三态）、重构方案宪法红线（Mirror 从不产生 Judgment）

---


> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

## Definition

一次 **Reflection Event**——认知演化历史中的一个事件，记录"某时发生的一次反思"。

它不是一段总结文本，也不是一个用来装东西的容器。它的本质是：

> **2026-08-01，发生了一次反思。**

正因如此，它有明确的 `created_at`（事件发生时刻）、`conversation_ids`（事件源自哪些对话）、`generated_thought_ids`（这次事件直接生成了哪些 Thought）。数据库里保存一条 Reflection，本质是在保存"认知演化史的一个节点"，而不是"一段 AI 写的话"。

## Purpose

在 v2 的分层模型里，Reflection 介于 `Conversation`（证据源）与 `Thought`（长期认知对象）之间，但它**不是 Thought 的草稿或候选**，而是连接两者的**事件桥梁**：

- 一次反思可能直接生成一条 Thought（state=emerging），也可能因为内容还模糊而只留下线索（不造 Thought）。这两种结局都被允许，且都已是"事件"，而非"半成品"。
- 通过 `generated_thought_ids`，可以在时间轴上把"Conversation → Reflection Event → Thought 更新 → Snapshot 新增"完整串起来，形成 Thought 的生命史。
- 冷启动阶段（用户尚无成熟 Thought）也能生成 Reflection Event（从既有 Conversation/Evidence 回溯），不依赖 Thought 已存在。

**为什么是 Event 而不是 Container：** 如果把 Reflection 设计成"装 themes/candidates 的容器"，未来 N 条 Reflection 会各自囤积一堆没人回看的子结构，数据库越来越难理解。作为 Event，它的价值不在自身内容，而在它"发生了"以及它"产出了什么"——内容只是事件的概要（`content` 语义降级为 summary）。

## Fields

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 唯一标识 (UUID v4) |
| `user_id` | string | 是 | 所属用户，遵循 S-2.1 可导出、可追溯 |
| `content` | string | 是 | 事件概要（summary）：对一段对话/经历的结构化概括（用户视角，AI 只映照不下结论）。**注意**：Reflection 的价值在于"它是一次反思事件"及其 `generated_thought_ids`，而非这段文本本身。 |
| `triggers` | array[string] | 否 | 触发事件/情境，默认空数组 |
| `emotional_context` | string | 否 | 情绪背景，可选，非必填——刻意不强制，避免系统滑向心理分析器 |
| `initial_question` | string | 否 | 初步问题（思考的起点，非定论），默认空串 |
| `related_experiences` | array[string] | 否 | 相关经历引用，默认空数组 |
| `conversation_ids` | array[string] | 否 | 本事件源自的 Conversation id 列表（证据溯源），默认空数组 |
| `generated_thought_ids` | array[string] | 否 | **事件产出**：本次反思直接生成的 Thought id 列表（事件溯源，无产出则为空数组），默认空数组 |
| `space_id` | string \| null | 否 | 所属 Thinking Space id，默认 null |
| `created_at` | timestamp | 是 | 事件发生时刻 |

**明确不包含的字段（由 `not` 约束在 Schema 层强制）**：不存在 `personality_type`、不存在 `psychological_profile`。Reflection 可以记录情绪背景，但**不得**对用户做人格/心理画像——这是 Article 5 红线在 Schema 层的物理护栏。

**无 `thought_candidate` / 无 `maturity_signal` 字段**：候选与成熟度信号是 Reflector 当次 LLM 调用的输出，已就地转化为 `Thought`（直接落库，state=emerging）+ `ThoughtMaturitySnapshot`（追加记录）。系统不保留"候选/待审核"中间态——设计原则明确"无审核、无批准"。

## Examples

**示例 1（事件直接生成 Thought）**
> created_at: 2026-08-01T10:00:00Z
> content: "你在这三次对话里反复回到同一个点——你希望自己花时间做的事，能留下长期积累。"
> triggers: ["连续提到'不想做没有积累的事'"]
> initial_question: "我到底在什么意义上重视'积累'？"
> conversation_ids: ["conv-2026-0731-a", "conv-2026-0801-b"]
> generated_thought_ids: ["T-1001"]
> → 事件发生时，T-1001（emerging）已直接落库，并写首张 Snapshot；Thought.origin_reflection_id 指回本事件。时间轴上这一事件节点清晰可查。

**示例 2（事件仅留线索，不生成 Thought）**
> created_at: 2026-08-01T11:00:00Z
> content: "你现在最频繁表达的主题，是关于时间如何被日常琐事切割。"
> triggers: ["12 次提及'没时间'/'被打断'"]
> generated_thought_ids: []
> → 内容尚模糊，Reflector 不强行造 Thought。这是一个"只记录、未产出"的 Reflection Event。

## Relationships

- **← Conversation**（0..N）：事件可溯源到一条或多条 Conversation；`conversation_ids` 持有这份溯源。事件也可不来自 Conversation 而来自 Evidence 回溯（冷启动）。
- **→ Thought**（可选，0..N 方向，经 `generated_thought_ids`）：事件可能生成一条或多条 Thought（state=emerging）。生成后，新 Thought 的 `origin_reflection_id` 指回本事件。此关系**单向、只读**——Thought 成形后，不得反向改写 Reflection Event。
- **→ ThoughtMaturitySnapshot**（随 Thought 成对产生）：每次事件生成 Thought 时，必同时追加一张 Snapshot（见 ThoughtMaturitySnapshot.md）。
- **不晋升为 Thought 的 Reflection Event**：仅是"被记录的一次反思"，不构成长期认知对象，停留在事件流中，不进入 Thought 查询/可视化主区。
- **与 Observation / Interpretation 的关系**：Reflection Event 站在它们之后一层。Observation 陈述"发生了什么"，Interpretation 赋予"可能意味着什么"，Reflection Event 则是用户视角的一次"我注意到了什么值得拎出来想想"的事件节点。三者都不取代 Thought，且都不可被 AI 单方面固化为 Thought。

## Non Examples

- 任何对用户做人格/心理定性的文本（如"你是一个回避型依恋人格"）—— 即使出现在观照语境，也因违反 Article 5 而被 Schema 的 `not` 约束拒绝落库。
- 一段 AI 直接下结论的分析（"你应该…"、"你本质上是一个…的人"）—— 这是宣布（declaration），不是映照（reflection），应退回 Observation/Interpretation 并交还用户判断。
- 把 Reflection 当成"草稿 Thought"反复编辑——Reflection 是事件，不可变；若要长期演化应直接生成 Thought（或新建另一个 Reflection Event 生成新 Thought），而非在事件上累积版本。
- 任何 `thought_candidate` / `pending_approval` 概念——违反"无审核、无批准"原则，系统不保留候选待审态。

---

*本文档与 `specs/schemas/Reflection.schema.json` 同步；任何字段变更须先修改本文档，Schema 与文档不一致视为 Schema bug。本文档遵循重构方案 v2 的宪法红线：系统观察思想如何形成，而非决定什么思想应该成立。*
