# Concept: ThoughtMaturitySnapshot

**所属层**: `specs/concepts/`
**关联 Schema**: `specs/schemas/ThoughtMaturitySnapshot.schema.json`
**关联重构方案**: `specs/Rethink_Refactor_Plan.md` §1.3、§2.3、§4
**关联 Constitution 条款**: 重构方案宪法红线（Mirror 从不产生 Judgment）、Article 12（演化原则）

---


> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

## Definition

Thought 在某一时刻的**成熟度快照**——一个四维向量加时间戳的不可变记录。四维分别是 `clarity`（清晰度）、`stability`（稳定性）、`recurrence`（复现度）、`connection`（连接度），每维取值 `[0, 1]`。

Snapshot 本身**不判定** Thought 的资格，只*描述*它在被计算那一刻"有多成形"。它等价于思想演化轨迹上的一个采样点。

## Purpose

人的思想不是 RPG 升级，不能用单一标量表达"成熟程度"：一个 Thought 可能很稳定但影响范围小（高 stability、低 connection），另一个经常出现但仍模糊（高 recurrence、低 clarity）。因此底层用**多维向量**而非等级。

但多维向量本身不便展示与过滤，于是从向量派生出 `maturity_stage`（emerging / developing / stable / core）作为 UI 投影。这也带来一个保存问题：同一条 Thought 在 2026 与 2027 的向量很可能不同。**Snapshot 的存在就是为了不覆盖历史**——每次重算都追加一条新快照，从而能够呈现 **Thought Evolution Timeline**，让用户在数月后回看"这条想法是怎么一步步成形的"。这是 Thought OS 长期价值的直接载体，也是"系统观察思想如何形成"的具体落点。

## Fields

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 唯一标识 (UUID v4) |
| `user_id` | string | 是 | 快照归属用户（存储层统一索引需要） |
| `thought_id` | string | 是 | 所属 Thought id |
| `clarity` | number [0,1] | 是 | 清晰度：思想表述是否明确 |
| `stability` | number [0,1] | 是 | 稳定性：思想是否反复一致、不漂移 |
| `recurrence` | number [0,1] | 是 | 复现度：在对话中出现的频率 |
| `connection` | number [0,1] | 是 | 连接度：与其他 Thought / 经历的关联广度 |
| `calculated_at` | timestamp | 是 | 计算时间戳（采样时刻，不是 Thought 创建时刻） |

**明确不包含的字段**：
- 不存在 `stage` 字段——stage 是**派生/冗余展示字段**，只缓存在 `Thought.maturity_stage` 上（由最新快照向量计算），绝不在此作为权威事实存储。
- 不存在 `score` / `grade` / `valid`（任何暗示"AI 给 Thought 打分定级"的字段）——这违反宪法红线。Snapshot 只描述，不判定。

## Vector → Stage（派生公式，非存储权威）

```
avg = (clarity + stability + recurrence + connection) / 4
if avg < 0.4:                          stage = 'emerging'
elif avg < 0.7:                        stage = 'developing'
elif connection >= 0.7 and avg >= 0.7: stage = 'core'
else:                                  stage = 'stable'
```

该公式的纯函数实现见 `src/services/maturity.ts` 的 `computeStage`。`Thought.maturity_stage` 由**最新**一张快照计算而得；历史快照保留全部采样点，不受最新值覆盖。

## Examples

**示例 1（冷启动 emerging 快照）**
> thought_id: T001
> clarity: 0.30, stability: 0.25, recurrence: 0.55, connection: 0.20
> calculated_at: 2026-08-01T10:00:00Z
> → avg = 0.325 < 0.4 → stage = emerging。系统在"观察/线索"区低调提示"这条线索出现了 N 次"。

**示例 2（三个月后 stable 快照，历史保留）**
> thought_id: T001
> clarity: 0.78, stability: 0.80, recurrence: 0.60, connection: 0.55
> calculated_at: 2026-11-01T10:00:00Z
> → avg = 0.6825，未达 core（connection < 0.7）→ stage = stable。
> 示例 1 的 emerging 快照仍保留在库中，Timeline 上可见从 emerging → stable 的轨迹。

## Relationships

- **→ Thought**（必须，1）：每张快照属于且仅属于一条 Thought；`thought_id` 为外键引用。
- **← Thought.maturity_stage**（派生只读）：`Thought.maturity_stage` 由本表最新快照经 `computeStage` 计算，是冗余缓存；Snapshot 表本身才是向量真相来源。两者不一致时以 Snapshot 表为准。
- **由 Reflector 顺带产出，无独立 Evaluator**：Snapshot 是 Reflector 单次输出的结构之一（见重构方案 §3），不存在独立的 Maturation Evaluator Agent 来"审批"它。
- **不阻断**：Snapshot 被计算、被存储、被展示，但**绝不**决定 Thought 能否进入长期区。哪怕一条 Thought 永远停留在 emerging，它依然合法存在于长期认知对象区，只是 UI 呈现强度更低。

## Non Examples

- 把 Snapshot 当作"Thought 是否合格"的判据 —— 违反宪法红线，系统不阻断任何 Thought。
- 用单标量 `score` 代替四维向量 —— 丢失了"稳定但孤立""频繁但模糊"等真实差异，回到被拒绝的 RPG 升级模型。
- 覆盖旧快照而非追加 —— 会抹除演化轨迹，使 Thought Evolution Timeline 无法呈现，违反 Article 12 的演化原则。
- 在 Snapshot 上存储 `personality` / `psychological` 类字段 —— 与 Reflection 同理，属 Article 5 红线，本概念不涉及用户画像。

---

*本文档与 `specs/schemas/ThoughtMaturitySnapshot.schema.json` 同步；任何字段变更须先修改本文档，Schema 与文档不一致视为 Schema bug。本文档遵循重构方案 v2 的宪法红线：系统观察思想如何形成，而非决定什么思想应该成立。*
