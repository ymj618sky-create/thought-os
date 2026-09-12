# Concept: Question

**所属层**: `specs/concepts/`
**关联 Schema**: `specs/schemas/Question.schema.json`
**关联 Constitution 条款**: Article 13-15（问题原则）

---


> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

## Definition

一个独立存在的开放性问题节点，不要求已有答案即可长期存在，与 `Thought` 地位平等，是系统的一等公民。

## Purpose

承载思考过程中尚未解决、但值得被记住的困惑本身。Thought OS 认为一个好问题的价值不低于一个好答案（Article 14），所以 Question 不是 Thought 的附属品或占位符，而是可以独立创建、独立追踪、独立演化的节点。

## Fields

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 唯一标识 |
| `user_id` | string | 是 | 所属用户 |
| `content` | string | 是 | 问题的表述 |
| `status` | enum | 是 | `pending`（AI 建议、待用户确认，不计入正式列表）/ `open`（已确认、仍然开放）/ `archived`（用户主动收起，非删除，可恢复） |
| `origin_type` | enum | 是 | `user_authored`（用户自己提出）/ `ai_suggested`（AI 建议，需用户确认后才计入正式列表，遵循 S-2.3） |
| `evidence_ids` | array[string] | 条件必填 | 当 `origin_type=ai_suggested` 时必须 ≥1（保证可解释性，遵循 S-9.3）；当 `origin_type=user_authored` 时可为空数组，因为用户提出问题不需要先有 Evidence 佐证 |
| `parent_question_id` | string \| null | 否 | 若此问题是从更大的问题拆分而来 |
| `created_at` / `updated_at` | timestamp | 是 | |

**明确不包含的字段**：不存在 `answer` 或 `is_answered` 字段——Question 不以"是否有答案"为存在依据，一个问题即便从未被回答，只要用户仍然认为它值得留着，就应该继续存在。与某个 Question 相关的 Thought 通过 `Relation` 实体关联（见 Relation.md），不在 Question 自身记录"标准答案"。

## Examples

**示例 1（用户直接提出）**
> content: "我到底是想要稳定，还是只是害怕改变？"
> origin_type: user_authored
> evidence_ids: []
> status: open

**示例 2（AI 建议，待确认 → 确认）**
> AI 观察到用户在多次对话中提到"责任"但从未定义这个词对自己意味着什么，于是提出："'责任'这个词，对你来说具体是指什么？"
> → 系统创建 Question，`origin_type=ai_suggested`，`status=pending`，`evidence_ids` 指向促成这个问题的相关 Evidence。此时它不计入正式列表，等待用户确认。
> 用户回复："这个问题问得好，帮我记下来。"
> → `status` 流转为 `open`，正式计入用户的问题列表。

## Relationships

- **↔ Thought**（通过独立的 `Relation` 实体）：一个 Question 可以被一条或多条 Thought 阶段性回应，一条 Thought 也可能反过来催生新的 Question。这类关系及其演化历史由 `Relation` 实体持有，Question 自身不直接存储"谁回答了我"。
- **→ Question**（`parent_question_id`）：支持问题的拆分（一个大问题拆成几个更具体的子问题），但不支持问题之间的"矛盾"关系——矛盾是 Thought 之间的概念，Question 之间只有分解/关联，没有对立。
- **→ Evidence**（条件性）：见 Fields 表说明。

## Non Examples

- 修辞性反问，不代表用户真实的困惑（如对话中随口一句"这谁能想得清楚啊"）—— 不应被系统当真识别为 Question。
- 已经被用户认为"想清楚了、不想再留着"的问题 —— 应转为 `archived`，而不是继续留在 `open` 列表里制造噪音；但仍然不物理删除，允许用户未来重新翻出。
- 单纯的信息查询（如"今天天气怎么样"）—— 这类问题不涉及自我认知或思想演化，不属于 Thought OS 的 Question 概念，应在会话层直接处理，不写入 Question 表。

---

*本文档遵循 Specification S-5.1（Question 是一等公民）与 S-5.2（澄清优先于作答）。*
