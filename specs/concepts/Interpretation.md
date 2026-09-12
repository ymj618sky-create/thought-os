# Concept: Interpretation

**所属层**: `specs/concepts/`
**关联 Schema**: `specs/schemas/Interpretation.schema.json`
**关联 Constitution 条款**: Article 5（AI 可以提出解释，不能宣布解释）、Article 8（三层区分）、Article 16-19（AI 行为规范）

---


> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

## Definition

AI 对 Evidence 和/或 Observation 的意义赋予或推断，是三层结构中唯一**无法被直接核验为真假、必须承认不确定性**的一层。

Interpretation 与 Observation 的分界线（详见 `Observation.md`）：Observation 回答"发生了什么"，Interpretation 回答"这可能意味着什么"。后者本质上是 AI 的一个猜测，因此必须显式标注置信度，且用户拥有完全的确认/驳回权——Interpretation 永远只是一个"提议"，不是结论。

## Purpose

让 AI 能够对用户的思考提供有价值的洞察和联想，同时确保这种洞察被清晰地标记为"这是 AI 的一个猜测"，而不是被用户误认为客观事实或系统判定。这是 Article 5"AI 可以提出解释，不能宣布解释"在数据层的直接落地。

## Fields

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 唯一标识 |
| `user_id` | string | 是 | 所属用户 |
| `content` | string | 是 | 解释性文本，应使用推测性措辞（"可能""看起来像""或许是"），不得使用定论性措辞 |
| `evidence_ids` | array[string] | 否 | 直接依据的 Evidence（`evidence_ids` 与 `observation_ids` 至少有一个非空，见下方约束） |
| `observation_ids` | array[string] | 否 | 直接依据的 Observation |
| `confidence` | number | 是 | 0-1，遵循 S-6.1；无法给出置信度的推断不得生成 |
| `confidence_rationale` | string | 否 | 简要说明置信度依据（如"仅一次提及，样本有限"/"三次独立对话中出现一致模式"） |
| `status` | enum | 是 | `pending`（待用户确认）/ `confirmed`（用户确认，可能已派生出 Thought）/ `rejected`（用户驳回）/ `superseded`（被新的解释取代） |
| `superseded_by` | string \| null | 否 | 指向取代它的新 Interpretation |
| `created_at` / `confirmed_at` | timestamp | 是 / 否 | |

**明确不包含的字段**：不存在固化用户身份本质的结构化字段（如 `personality_type` / `psychological_profile` / `user.core_value`）——遵循 Article 11（系统不得定义用户本质身份）；Portrait Model 解释模型的允许与字段约束见 Protocol 层。基于证据的 scientific characterization（含人格 / 行为构念）允许作为 Interpretation 内容，但须可追溯 Evidence、标置信度、列反例、不宣称固定本质、不替用户决定（S-6.3 认识论治理 / Article 18）。

## Examples

**示例 1**
> content: "你反复提到'不想让父母失望'，这或许说明你的职业选择里有一部分并不完全是你自己的偏好。"
> evidence_ids: [E003, E007]
> observation_ids: [O012]
> confidence: 0.55
> confidence_rationale: "样本来自两次独立对话，但用户从未直接确认这个联系"
> status: pending

**示例 2（用户确认后）**
> 用户回复："对，这个说法我认。"
> → status 变为 confirmed，`confirmed_at` 记录时间；系统据此可创建一条 `origin_type=derived_from_interpretation` 的 Thought（见 `Thought.md`），Thought 的 `content` 用陈述句重新表述，不直接照搬本条的推测性措辞。

**示例 3（被驳回）**
> 用户回复："不是，其实我只是单纯喜欢这份工作而已。"
> → status 变为 rejected。系统不得据此自动生成 Thought，也不得在后续对话中继续引用这条被驳回的解释作为前提。

## Relationships

- **← Evidence / Observation**：至少依据其中一类（见 Fields 约束），保证可解释性（S-9.3）。
- **→ Thought**：仅当 `status=confirmed` 时，可能派生出一条 Thought，通过 Thought 的 `origin_interpretation_id` 建立只读的溯源关系（详见 `Thought.md`）。一条 Interpretation 被确认不代表自动生成 Thought——是否固化为 Thought，仍需用户执行独立的确认动作，两者不能合并成一步，以保留用户在"我认同这个观察"和"我要把它记下来"之间的选择空间。
- **→ Relation**：如果一条 Interpretation 指出两个已存在的 Thought/Question 之间可能有关联（如矛盾），实际的关系记录应创建为 `Relation`（`origin_type=ai_suggested`），而不是把关系判断留在 Interpretation 内部。

## Non Examples

- 客观、可核验的描述（如"你提到了三次"）—— 这是 Observation，不是 Interpretation。
- 未标注置信度的推断 —— 不允许存在，任何生成 Interpretation 的流程必须同时产出 confidence，缺失视为生成失败，应重试或返回空（遵循 Agent 失败原则："失败，返回空，绝不猜测"）。
- 断言固定本质身份或替用户决定的内容（如"你本质上就是回避型的人，所以你必须…"）—— 越过主权红线（Article 5 / Article 18），无论置信度多高都不得生成。基于证据的候选性 characterization（如"从长期材料看，你似乎呈现较高的回避倾向"）属合法 Interpretation 范围，受 S-6.3 认识论治理约束。
- 用户从未回应、系统却持续在后续对话中默认其为真的 Interpretation —— `status=pending` 的解释不得被当作既定前提使用，必须停留在"待确认"状态直到用户明确回应。

---

*本文档遵循 Specification S-6.1（推断必须标注置信度）、S-6.2（禁止伪装理解）、S-6.3（characterization 认识论治理，非词汇禁用 / Article 18）。*
