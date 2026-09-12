# Concept: Observation

**所属层**: `specs/concepts/`
**关联 Schema**: `specs/schemas/Observation.schema.json`
**关联 Constitution 条款**: Article 5（AI 只能观察/提问/建议/总结，不能定义/判定/宣布）、Article 8（区分 Evidence/Observation/Interpretation）

---


> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

## Definition

AI 对一条或多条 Evidence 的客观描述，不添加意义解释、不做价值判断，只陈述"发生了什么/说了什么"。

Observation 与 Interpretation 的分界线是：**是否可以被直接核验为真假**。"你在过去三次对话里都提到了辞职"是 Observation，因为可以直接数出来、查证；"你反复提到辞职，可能是因为你对现在的工作感到不安"是 Interpretation，因为"感到不安"是一个无法被直接核验的意义赋予。

## Purpose

作为 Evidence 与 Interpretation/Thought 之间的桥梁，让"AI 注意到了什么"本身可见、可追溯、可被用户直接反驳——而不是让 AI 的观察和解释混在一段话里，用户无从分辨哪部分是事实、哪部分是推测。

## Fields

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 唯一标识 |
| `user_id` | string | 是 | 所属用户 |
| `content` | string | 是 | 客观描述文本，不含解释性措辞 |
| `evidence_ids` | array[string] | 是，长度 ≥ 1 | 支撑此 Observation 的证据 |
| `pattern_type` | enum | 否 | `single_mention`（单次提及）/ `recurring_pattern`（重复模式）/ `explicit_contradiction`（用户自己表达了矛盾）/ `lattice_synthesis`（晶格合成漂移旁注，由 `latticeSynthesis` 后台服务产出，引用 Evidence id，不进收件箱）|
| `status` | enum | 是 | `active` / `dismissed`。用户可随时驳回，遵循 S-2.3 |
| `dismissed_at` | timestamp \| null | 否 | 用户驳回的时间 |
| `created_at` | timestamp | 是 | |

**明确不包含的字段**：不存在 `confidence`。因为 Observation 按定义必须是可直接核验的客观描述——如果某个描述需要置信度才能表达，说明它已经越界成为 Interpretation，应该重新分类，而不是给 Observation 加一个置信度字段来"容忍"这种越界。

## Examples

**示例 1（单次提及）**
> content: "你提到你正在考虑换工作。"
> evidence_ids: [E001]
> pattern_type: single_mention

**示例 2（重复模式，仍是客观陈述）**
> content: "在过去两周的三次对话中，你都提到了'不想让父母失望'这句话。"
> evidence_ids: [E003, E007, E012]
> pattern_type: recurring_pattern

**反例（越界成为 Interpretation，不应作为 Observation 呈现）**
> ~~"你反复提到父母，说明你可能还没有真正为自己做决定。"~~ —— 含有无法直接核验的意义赋予，应归类为 Interpretation 并附带置信度。

## Relationships

- **← Evidence**（必须，≥1）：Observation 的存在必须能指回具体是哪几条 Evidence 支撑了这个描述。
- **→ Interpretation**：一条或多条 Observation 可以作为某个 Interpretation 的依据；Interpretation 应引用其所基于的 Observation，而不是绕过 Observation 直接跳到结论。
- **→ Thought**：Observation 不直接晋升为 Thought。用户若认可某条 Observation 本身值得记录，应作为 `origin_type=user_authored` 的 Thought 重新确认（即用户自己确认这件事，而不是 AI 单方面把观察固化）。

## Non Examples

- 未经拆分、观察和解释混在一起的一段话 —— 应拆成独立的 Observation 和 Interpretation 两条记录。
- 未关联任何 Evidence 的"观察" —— 无从核验，不得存在。
- 带有明确判定性措辞的描述，如"这说明你就是…" —— 违反 Article 5，属于禁止的"宣布"行为，即便包装成 Observation 也不允许。

---

*本文档遵循 Specification S-3.2（三层输出必须可区分）与 S-6.2（禁止伪装理解）。*
