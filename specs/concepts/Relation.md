# Concept: Relation

**所属层**: `specs/concepts/`
**关联 Schema**: `specs/schemas/Relation.schema.json`
**关联 Constitution 条款**: Article 10-12（演化原则，尤其 Article 12：用户成长的证据是关系的演化）

---


> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

## Definition

两个节点之间的一条关系记录，独立于两端节点本身存在，拥有自己的生命周期（建立、确认、修正、否定）。常规情况下是 Thought-Thought / Thought-Question；**唯一例外**是 `relation_type=challenges`，起点可以是 Interpretation（见"未化解张力"一节），端点范围不止 Thought/Question 这一句话，本节先给出常规定义，例外的完整理由和生命周期在下方专门展开，不在这里重复。

Relation 是系统里唯一专门用来回答"用户的思想是怎么连起来的、这种连接是怎么变化的"这个问题的实体。Thought 和 Question 节点上的反向索引字段（`related_thought_ids` 等）只是为了查询方便的缓存，Relation 才是权威数据源。

## Purpose

落实 Article 12："用户成长的重要证据，不是思想数量，而是思想之间关系的演化。" 如果关系只是节点上的一个静态字段，就无法回答"这两个想法是从什么时候开始被认为矛盾的""这个连接是 AI 先注意到、用户后来确认的，还是用户自己建立的"——而这些问题恰恰是 Thought OS 用来展示成长轨迹的核心素材（S-4.3）。

## Fields

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 唯一标识 |
| `user_id` | string | 是 | 所属用户 |
| `from_id` / `from_type` | string / enum | 是 | 起点节点 id 与类型（`thought` / `question` / `interpretation`） |
| `to_id` / `to_type` | string / enum | 是 | 终点节点 id 与类型（`thought` / `question`） |
| `relation_type` | enum | 是 | `supports` / `contradicts` / `refines` / `merged_from` / `answers` / `raises` / `decomposes` / `challenges`（见下方"未化解张力"说明） |
| `origin_type` | enum | 是 | `user_authored`（用户明确建立）/ `ai_suggested`（AI 建议，需确认） |
| `status` | enum | 是 | `pending`（AI 建议、待用户确认）/ `confirmed`（用户确认）/ `rejected`（用户驳回）/ `superseded`（被新的关系判断取代，如"曾经矛盾，现在其中一条已修正、不再矛盾"） |
| `confidence` | number \| null | 条件必填 | 当 `origin_type=ai_suggested` 且 `status=pending` 时必须提供（0-1），遵循 S-6.1；一旦被用户 `confirmed`，该字段不再具有实际意义，可保留作历史记录但不影响展示 |
| `evidence_ids` | array[string] | 否 | AI 建议此关系时依据的证据，供用户核验"AI 为什么觉得这两者矛盾"，遵循 S-9.3 |
| `superseded_by` | string \| null | 否 | 指向取代它的新 Relation |
| `created_at` / `confirmed_at` | timestamp | 是 / 否 | |

## Examples

**示例 1（AI 建议的矛盾关系，待确认）**
> from: Thought "我认为稳定的工作最重要"
> to: Thought "我认为自由比稳定更重要"
> relation_type: contradicts
> origin_type: ai_suggested
> status: pending
> confidence: 0.7
> → 呈现给用户："这两个想法看起来有些矛盾，你觉得是吗？" 用户可以确认、驳回，或说"其实不矛盾，因为…"（后者应触发用户重新表述，可能生成新的 Thought 或 Relation）。

**示例 2（用户自己建立的支持关系）**
> from: Thought A
> to: Thought B
> relation_type: supports
> origin_type: user_authored
> status: confirmed
> confidence: null（用户自己建立的关系不需要置信度，因为不是推测）

## Relationships

Relation 连接的核心是 Thought 与 Question——这是常规情况，`from_type`/`to_type` 均为 `thought` 或 `question`。**唯一例外**：`relation_type=challenges` 允许 `from_type=interpretation`（`to_type` 仍固定为 `thought`），用于承载"未化解张力"（见下一节）。除此之外，Relation 不连接 Evidence 或 Observation——证据链路由各节点自身的 `evidence_ids` 字段处理，不通过 Relation；这条例外没有被进一步放宽，Evidence 本身依然不能作为任何 Relation 的端点（理由见下一节"为什么是 Interpretation 而不是 Evidence"）。

## 未化解张力（Unresolved Tension）

**问题**：一条新的 Evidence 可能促使 Extractor 生成一条 Interpretation，其内容与用户已确认的某条 Thought 相冲突——但在用户对这条 Interpretation 做出确认/驳回之前，它还不是一个正式的 Thought，无法用 `contradicts` 关系连接两条 Thought。这个"尚未化解的认知摩擦"是 Article 12 最看重的信号之一（关系的演化，而不是节点数量），但此前的模型里没有地方承载它。

**为什么端点是 Interpretation 而不是 Evidence**：新证据本身不构成"张力"——一段原文放在那里，不冲突不矛盾，它只是数据。"这段新证据似乎和你之前的某条 Thought 冲突"这个判断，本身就是一次推断（需要判断语义上是否真的构成矛盾，而不只是表面相似），这正是 `Interpretation` 存在的意义。Interpretation 已经天然具备张力所需的全部要素：`confidence`（这个冲突有多大把握成立）、`evidence_ids`/`observation_ids`（依据是什么）、`pending/confirmed/rejected` 生命周期（用户还没表态前，张力本身也是待定的）。如果让 Evidence 直接作为 Relation 端点，等于绕过"这是否真的矛盾"这个推断判断，让原始数据未经解释就直接进入结构化的关系图——这正是 Article 8（区分 Evidence/Observation/Interpretation）想要避免的层级混淆。因此这里不需要、也不应该给"Relation 不连 Evidence"开例外；需要开例外的只是"Relation 是否只能连 Thought/Question"这一条，答案是"再加一个 Interpretation 作为 challenges 关系的起点"，两者是不同的规则，不要混为一谈。

**解法（按 Article 0 检验：不加会丢失什么？——会丢失"用户还没决定怎么办的那个矛盾时刻"本身，这是可描述的思想现象，值得建模）**：不新建一个 `Tension` 概念/schema，而是复用 `Relation`——新增 `relation_type=challenges`，允许 `from_type=interpretation`、`to_type=thought`。生命周期（按状态机精确定义，避免实现歧义）：

1. **产生**：系统中独立于 Extractor 的冲突检测逻辑（**注意：不是 Extractor 本身**——Extractor 的能力边界明确排除"判断两个已有节点之间的关系"，见 `(private agent capability)` 与 `(private agent capability)`；Extractor 只负责生成 Interpretation I1 本身，冲突判定是消费 I1 的下一道独立步骤）判定某条新 Interpretation 与用户已确认的某条 Thought 冲突时，创建一条 `origin_type=ai_suggested`、`status=pending`、`relation_type=challenges` 的 Relation，`from_id` 指向该 Interpretation，`to_id` 指向被冲击的 Thought。这道冲突检测逻辑已收口于专门的 `specs/protocols/Conflict_Detection_Protocol.md`——它既不属于 `Thought_Extraction_Protocol`（该协议明确终止于 Interpretation 草稿，不处理关系），也没有被写进 `Confirmation_Protocol`（该协议处理的是用户对已存在候选的响应，不负责主动发现新的冲突），故此前作为"已知缺口"诚实标注、现已由独立协议补齐，不再以"系统"这个模糊说法停留在文档里。
2. **驳回 → 张力消失但留痕**：若用户驳回该 Interpretation，这条 challenges 关系应被更新为 `status=rejected`——**是状态变更，不是物理删除**，与 S-4.1 的精神一致，保留"曾经存在过这个张力判断、但被用户否定了"的审计轨迹。
3. **确认且存为 Thought → 升级为 contradicts（新建记录，不是原地改类型）**：新 Thought 创建后，系统应**新建**一条独立的 `contradicts` 关系，`from_id`/`to_id` 分别指向两条 Thought；原本的 `challenges` 关系则被更新为 `status=superseded`，其 `superseded_by` 字段指向这条新建的 `contradicts` 记录。**明确禁止**直接原地修改原记录的 `relation_type` 字段（把 `challenges` 改成 `contradicts`）——那样会丢失"这段关系曾经是一次未确认的张力、后来才升级为确立的矛盾"这条演化轨迹本身，而这条轨迹正是 Article 12 要求被保留的核心信号。
4. **确认但不存为 Thought → 长期一等信号，不是 pending 的延续**：若用户确认该 Interpretation、但选择不将其固化为新 Thought，这条 `challenges` 关系应更新为 `status=confirmed` 并长期保留。**这个状态需要被明确当作一等公民对待，而不是被误认为"还没处理完的临时态"随手清理**：`pending` 代表"AI 猜的，用户还没表态"，`confirmed` 代表"用户已经明确认同这个张力真实存在"——两者的可信度和展示优先级完全不同，任何清理/归档逻辑都不得把 `challenges + status=confirmed` 当作可安全删除或降权的候选。这类"已核实但未固化为新思想的张力"，很可能正是 Article 12 想要捕捉的、比节点数量更有价值的成长信号。

不新建独立实体，是因为 `challenges` 完全复用了 Relation 已有的状态机（pending/confirmed/rejected/superseded）和置信度机制，额外建一个 Tension 概念只是把同一套状态流程复制一份，不符合 Article 0 对"删掉会不会丢失可描述现象"的检验标准——现在丢失的是关系类型的覆盖面，不是缺一个新实体。

## 缓存一致性策略

`Thought.related_thought_ids` 等反向索引字段与 Relation 权威表之间存在写入时序问题——若二者不同步更新，图谱展示会出现"看得到的关系"和"真实存在的关系"不一致。约定：

- **写入路径**：任何创建/更新 Relation 的操作，必须在同一个事务内同步更新其 `from_id`/`to_id` 两端节点的反向索引字段，两者不允许分离提交。
- **读取路径**：任何涉及矛盾检测、关系计数、演化图谱渲染等**判断类**逻辑，必须直接查询 Relation 表，不得信任节点上的反向索引缓存做判断依据；反向索引字段仅供列表页快速展示"这条 Thought 大致关联了哪些节点"这种低风险场景使用。
- **失效兜底**：若检测到反向索引与 Relation 表不一致（如索引指向的 Relation 已被删除或状态已变更），以 Relation 表为准，并触发一次异步重建该节点反向索引的任务，不阻塞当前请求。
- **`challenges` 关系不在反向索引覆盖范围内**：上述写入路径同步更新的是 `Thought.related_thought_ids` / `Thought.related_question_ids` / `Question.related_*`，这些字段的设计前提是"两端都是 Thought 或 Question"。但 `challenges` 关系的起点是 Interpretation，Interpretation 概念本身没有定义任何反向索引字段，且现有的 `related_thought_ids` 语义上也不适合塞进"被哪些 Interpretation 挑战"这种异构来源的边。结果是：某条 Thought 正被某条 Interpretation 挑战这件事，**不会出现在任何列表缓存里**，只能通过直接查询 Relation 表（`to_id=该Thought` 且 `relation_type=challenges`）获得。这不影响正确性——读取路径本来就规定判断类逻辑必须直查 Relation 表，不依赖缓存——但意味着任何想在 Thought 详情页"顺手"展示"当前有几条未决张力"的列表型 UI，不能像展示 `related_thought_ids` 那样走缓存字段，必须专门发起一次 Relation 查询。这是已知的覆盖缺口，不是遗漏，暂不需要为此单独加一个 `challenged_by_interpretation_ids` 字段——按 Article 0 检验，这只是"列表展示更方便"，不是"某种思想现象无法被描述"（缓存缺失时，真实数据仍完整存在于 Relation 表中，只是不在快速路径里）。

- 一条 Thought 内部对同一事的两个版本（v1 和 v2）—— 这是版本演化，由 Thought 自身的 `version` / `superseded_by` 字段处理，不建 Relation。
- Evidence 与 Thought 之间的引用关系 —— 由 Thought 的 `evidence_ids` 直接处理，不通过 Relation（避免为溯源关系这种简单的一对多引用增加不必要的间接层）。
- AI 尚未提出、纯属系统内部候选计算过程中的中间结果 —— 未呈现给用户确认前，不应写入 Relation 表，只能存在于临时计算层。

---

*本文档遵循 `specs/specifications/v0.1.md` 中的 S-6.1（推断必须标注置信度）与 S-4.3（优先展示关系变化）。*
