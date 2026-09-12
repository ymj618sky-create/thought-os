# Concept: Thought

**所属层**: `specs/concepts/`
**关联 Schema**: `specs/schemas/Thought.schema.json`
**关联 Constitution 条款**: Article 4（思想属于用户）、Article 7-9（证据原则）、Article 10-12（演化原则）

---


> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

## Definition

一个经过用户确认、可长期存在、且能追溯到至少一条 Evidence 的认知单元。

Thought 不是用户说过的所有话，而是用户认可为"这值得被记住"的那一部分。区分标准不是内容的深浅，而是**是否经过确认动作**——哪怕是一句简单的话，只要用户明确表示"这个我认，帮我记下来"，就可以成为 Thought；哪怕是一段很长的分析，如果只是 AI 的推测且用户从未确认，也只能停留在 `Interpretation`，不能成为 Thought。

## Purpose

用于构建用户的个人思想系统。它是整个 Thought OS 里唯一"长期存在、可被引用、可被演化"的一等内容单元，是 Question、Relation 等其他概念最终指向的落点。

Thought 存在的意义不是记录用户说过什么，而是让用户能够在几周、几个月后回来，看到自己思考的轨迹是如何一步步演化的——而不是重新从零开始想一遍。

## Coordinate System: Thought Space（思想坐标系）

思想不是平面的标签，而是锚定在**"思想空间"**中的坐标点。任何一个 Thought 都必须被定位在 5 个层级、12 个微观晶格（Micro-Lattice）中的具体位置。坐标系统回答了"这个思考处于人类意识与哲学的哪个频段"。

| 层级 (Level) | 晶格编码 (Lattice Level) | 名称 | 定义与适用场景 |
| :--- | :--- | :--- | :--- |
| **Level 1: 存在基底层** | `1` | **本体假设 (Ontological Axioms)** | 对真实、自我、时间、空间、虚无的底层公理定义。（例："生命没有预设意义"） |
| | `2` | **认知边界 (Epistemological Limits)** | 对确定性、不可知性、知识来源的边界划定。（例："我无法真正感同身受他人的痛苦"） |
| **Level 2: 价值与意义层**| `3` | **终极关切 (Ultimate Concerns)** | 人活着的驱动力、神圣感或不可妥协的命题。（例："对真理的探索高于舒适生存"） |
| | `4` | **伦理与边界 (Ethics & Boundaries)** | 人际、社会与自我的底线契约与道德直觉。（例："不将意志强加于他人"） |
| | `5` | **美学与体验 (Aesthetic Resonance)** | 对和谐、优美、粗陋、荒诞的审美判定。（例："厌恶臃肿与逻辑冗余"） |
| **Level 3: 解释层** | `6` | **外部解释 (External Interpretation)** | 对世界运转规律、因果关系的私有归因。（例："复杂系统崩塌源于微小反馈被忽视"） |
| | `7` | **自我解释 (Self Interpretation)** | 人向自己解释个人历史、伤痛与命运的剧本。（例："我习惯在绝境中被迫完成自救"） |
| | `8` | **角色解释 (Role Interpretation)** | 在特定局势中临时承载的功能定位。（例："在此合作中我仅担当推动者，而非仲裁者"） |
| **Level 4: 策略与决策层**| `9` | **目标与愿景 (Teleology & Goals)** | 指向未来的锚点，想要创造或抵达的状态。（例："三年内构建去中心化知识系统"） |
| | `10` | **权衡与路径 (Trade-offs & Strategies)** | 两难抉择时的优先级计算与取舍逻辑。（例："牺牲广度社交以换取深度思考"） |
| **Level 5: 现象与行动层**| `11` | **当下困惑/悖论 (Tensions & Paradoxes)**| 正在感知到的、尚未化解的认知摩擦力。（例："越想掌控时间，越觉得时间不够用"） |
| | `12` | **具体行动/模式 (Actions & Habits)** | 物理显现的表象应对、习惯或模式。（例："每天关闭社交软件通知深度写作 1 小时"） |

### 主坐标 / 次坐标（Primary / Secondary Lattice）

真实的思考经常同时锚定在多个晶格上——例如"三年内构建去中心化知识系统"这条目标，主要落在 `9（目标与愿景）`，但它的驱动力可能来自 `7（自我解释）`。**按 Article 0 检验**：如果强制单值，要么丢失"这个目标背后有自我解释动机"这层信息，要么被迫在两个都成立的坐标间任选一个——这属于"某种思想现象将无法被描述"，不是单纯的展示便利，因此值得建模为多值。

但完全不设主次的自由数组（`lattice_levels: []`）会稀释坐标系本身想提供的"精准定位"能力——如果每条 Thought 都挂 4-5 个坐标，图谱可视化就失去了锚点意义。因此采用**主坐标（必填，单值，驱动主要的索引/可视化/图谱聚合）+ 次坐标（可选，数组，记录确实存在但非主导的其他维度）**这一折中结构，两者共同存在于 Fields 表的 `lattice_level` 与 `lattice_levels_secondary` 字段。

## Fields

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 唯一标识 (UUID v4) |
| `user_id` | string | 是 | 所属用户，遵循 S-2.1 可导出、可追溯 |
| `content` | string | 是 | 思想的正式表述。必须是用户自己的原话，或用户明确确认过的改写 |
| `lattice_level` | integer (1-12) | 是 | 主坐标，思想在 12 微观晶格中的主导定位，驱动主要的索引/可视化/图谱聚合 |
| `lattice_levels_secondary` | array[integer (1-12)] | 否 | 次坐标，记录确实存在但非主导的其他晶格维度；不得包含与 `lattice_level` 相同的值（避免主次重复）；默认空数组，不强制每条 Thought 都填 |
| `status` | enum | 是 | `active` / `superseded` / `archived`。禁止物理删除，遵循 S-4.1 |
| `version` | integer | 是 | 从 1 开始，每次修正/深化递增（对应动力学演化） |
| `superseded_by` | string \| null | 否 | 指向替代它的新版本 Thought id，仅当 `status=superseded` 时有值 |
| `evidence_ids` | array[string] | 是，长度 ≥ 1 | 至少一条 Evidence 引用，遵循 S-3.1，不允许空数组 |
| `origin_type` | enum | 是 | `user_authored`（用户直接写下）/ `derived_from_interpretation`（源自 Interpretation） |
| `origin_interpretation_id` | string \| null | 否 | 当 `origin_type=derived_from_interpretation` 时指向来源 |
| `confirmed_at` | timestamp | 是 | 用户执行确认动作的时间，不是 AI 生成的时间 |
| `created_at` / `updated_at` | timestamp | 是 | 标准时间戳 |

**明确不包含的字段**：不存在 `confidence`（置信度只属于 Observation/Interpretation，Thought 一旦被确认就不再是"AI 的推测"）；不存在 `importance_score` 或类似排序权重（避免变相的思想分级，违反 Article 24）。

## Examples

**示例 1（用户直接写下 - 主坐标 Level 3: 自我解释，次坐标 Level 2: 终极关切）**
> content: "我意识到我对'稳定'这个词的理解其实一直在变化——二十岁时觉得稳定是一份长期工作，现在觉得稳定是我对自己判断力的信任。"
> lattice_level: 7 (Self Interpretation)
> lattice_levels_secondary: [3]（这句话同时触及"对自己判断力的信任"这一终极关切，但主线仍是自我历史的重新解释，因此 7 为主坐标）
> origin_type: user_authored
> evidence_ids: ["ev-2026-0726-001"]

**示例 2（源自被确认的 Interpretation - 锚定于 Level 2: 终极关切）**
> AI 输出的 Interpretation: "从你反复提到'不想让父母失望'这件事来看，你的职业选择里似乎有一部分不完全是你自己的偏好。（置信度：中）"
> 用户回复: "对，这个说法我认，帮我记下来。"
> → 系统据此创建一条 Thought，`lattice_level: 3` (Ultimate Concerns)，`origin_type: derived_from_interpretation`。

## Relationships

- **→ Evidence**（必须，≥1）：每条 Thought 至少关联一条原始证据，用于回答"这个想法最初是怎么来的"。
- **→ Thought / Question**（通过独立的 `Relation` 实体）：Thought 与其他 Thought、或 Thought 与 Question 之间的关系（`supports` / `contradicts` / `refines` / `merged_from` / `answers` / `challenges` 等，完整列表见 `Relation.md`），**不由 Thought 自身持有权威数据**，而由 `specs/concepts/Relation.md` 定义的独立实体承载。原因见 Article 12——用户成长的证据是"关系的演化"，这个演化过程（何时建立、是否 AI 推测、是否被用户确认、是否后来被否定）本身需要独立的时间线，不能只是 Thought 上的一个静态附属字段。Thought 上的 `related_thought_ids` / `related_question_ids` 只是为了查询效率保留的反向索引，Relation 表始终是唯一权威来源（single source of truth），两者不一致时以 Relation 为准。
- **→ Interpretation**：仅在 `origin_type=derived_from_interpretation` 时存在这条溯源关系，且只读，不可逆向从 Thought 改写回 Interpretation。
- **不建 `ThinkingSession` / `Timeline` 概念**：Thought 的创建、修正、合并事件天然由 Thought 自身的 `version` / `status` / `updated_at` 字段以及独立的 `Relation` 实体承载；用户思想演化图谱的节点与顺序，已经可以通过"Thought 版本流 + Relation 关系演化"完整还原，无需再引入一个独立的会话/时间线实体。若新增 `ThinkingSession` 或 `Timeline`，按 Article 0 内核剃刀检验，其答案是"展示更方便"而非"某种思想现象无法被描述"——因此它没有资格进入 Kernel，降级为 Tool/Extension 或永不建立。

## 成熟度与 Reflection 关联（重构 v2 新增）

本小节描述 Thought 与两个新增概念 `Reflection`（`specs/concepts/Reflection.md`）和 `ThoughtMaturitySnapshot`（`specs/concepts/ThoughtMaturitySnapshot.md`）的关系，保证分层模型（Conversation → Reflection → Thought → Evolution）在概念层与 Schema 层一致。

### 与 Reflection（Event）的桥梁关系

- **`origin_reflection_id`（字段，可空）**：当一条 Thought 由一次 Reflection Event 直接生成（state=emerging）时，指向点亮它的那个 `Reflection Event`。它只回答"这条 Thought 最初是被哪次反思事件点亮的"，是单向、只读的溯源引用——Thought 成形后不得反向改写 Reflection Event。
- **无候选/无审核语义**：系统不保留 `ThoughtCandidate` 中间态。Reflector 在一次 Reflection Event 中直接产出 Thought（emerging），因为设计原则明确"无审核、无批准"。"候选待审"的隐含语义已被消除（见 Rethink_Refactor_Plan.md v2 收敛）。
- **非用户确认路径时为空**：用户以 `user_authored` 直接写下并确认的 Thought，若不经 Reflection 事件，则 `origin_reflection_id` 为 null，与 `source_reflection_id`（Phase 1 预留的 Artifact↔Reflection 关联）互不影响。
- **冷启动一致性**：Reflection Event 可从既有 Conversation/Evidence 直接回溯生成（无需 Thought 先存在）；由此沉淀出的 emerging 态 Thought 自然带 `origin_reflection_id`，使冷启动阶段产出的 Thought 也有完整溯源链，不会产生"无源 Thought"。若事件内容尚模糊、未生成 Thought，则 `generated_thought_ids` 为空，仅留事件记录。

### 与 ThoughtMaturitySnapshot 的成熟度关系

- **`maturity_stage`（字段，派生冗余，默认 `emerging`）**：取值 `emerging` / `developing` / `stable` / `core`。它**不是权威事实**，仅由最新一张 `ThoughtMaturitySnapshot` 的四维向量经 `computeStage` 计算（公式见 ThoughtMaturitySnapshot.md），缓存在 Thought 行上以便查询/过滤。注意不叫 `status`，以免与 `active`/`superseded`/`archived` 混淆。
- **真相在 Snapshot 表**：每次 Reflector 重算成熟度都**追加**一条新 Snapshot，不覆盖历史。Thought 的演化轨迹（Timeline）由 Snapshot 序列呈现，`Thought.maturity_stage` 仅等于最新快照的派生结果；两者不一致时以 Snapshot 表为准。
- **不阻断不判定**：Snapshot 的四维向量只描述 Thought"有多成形"，绝不决定 Thought 能否进入长期区（宪法红线：Mirror 从不产生 Judgment）。哪怕一条 Thought 永远停留在 `emerging`，它依然是合法的长期认知对象，只是 UI 呈现强度更低（低调线索区 vs 主展示区）。

### 与既有字段的边界

- `maturity_stage` / `origin_reflection_id` 与既有 `status` / `version` / `confirmed_at` 正交：`status` 管"是否存活/被取代"，`version` 管"修正次数"，`maturity_stage` 管"成形程度展示"，三者不可互相替代。
- 依旧**不存在** `confidence` / `importance_score` / `grade`：成熟度是多维描述性向量，不是等级化评分，不触发 Article 24（禁止思想分级）的违规。

## Non Examples

以下内容**不是** Thought，即便被记录下来，也应停留在 `Evidence` 或临时会话层，不得未经确认直接晋升：

- "今天下雨了。" —— 事实陈述，无认知内容。
- "今天很累。" —— 短期情绪状态，遵循 S-6.4，不得自动升级为长期认知单元。
- "今天吃了火锅。" —— 生活记录，不构成思想。
- AI 主动生成的一段分析，用户从未回应或确认过 —— 无论内容多有洞察力，未确认前只能是 `Interpretation`，不能成为 Thought。
- 用户说"我觉得可能是这样，但我不确定" —— 这是一个未决的思考过程，更适合先建一条 `Question` 或保留为 `Evidence`，而不是直接固化为 Thought；除非用户之后明确表示"这个不确定的状态本身，我想记下来"。

---

*本文档遵循 `specs/specifications/v0.1.md` 中的 S-3.1（Thought 必须有 Evidence 链接）与 S-4.1（版本历史不可删除）。任何与本定义冲突的实现，视为实现层 bug，应回退至本文档，而非反向修改本文档以迁就实现。*
