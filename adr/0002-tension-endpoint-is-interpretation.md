# ADR-0002: 张力关系的发起端点用 Interpretation，而非 Evidence



> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: Accepted
**Date**: 2026-07-27
**领域**: 概念建模 / 三层模型边界
**关联文档**: `specs/concepts/Relation.md`（「未化解张力 · 为什么是 Interpretation 而不是 Evidence」）、`specs/concepts/Interpretation.md`、`specs/schemas/Interpretation.schema.json`、`specs/specifications/v0.1.md`（Article 8）

## Context

ADR-0001 决定用 `Relation` 承载张力，但 `Relation` 的端点在常规情况下只能是 `thought` / `question`（Article 8 分层下 Evidence 明确不能作为 Relation 端点）。张力需要有一个"冲突发起方"作为 `from`。可选方有两类候选：

- (a) 让 `Evidence` 作为 `from` 端点（即放宽"Relation 不连 Evidence"）；
- (b) 让 `Interpretation` 作为 `from` 端点。

## Decision

采用 (b)：`challenges` 关系的 `from_type=interpretation`、`to_type=thought`。**不**为张力放宽"Relation 不连 Evidence"这条硬规则。Evidence 仍不能作为任何 Relation 的端点。

## 备选方案（被否决的）

- **Evidence 作发起端点**：一段原文放在那里，不冲突不矛盾，它只是数据。"这段新证据似乎和你之前的某条 Thought 冲突"这个判断，本身是一次推断（需判断语义上是否真的构成矛盾，而非表面相似），这正是 `Interpretation` 存在的意义。让 Evidence 直接作为 Relation 端点，等于绕过"这是否真的矛盾"这个推断判断，让原始数据未经解释就进入结构化的关系图——正是 Article 8（区分 Evidence / Observation / Interpretation）想要避免的层级混淆。否决。

## Consequences

- **正向**：`Interpretation` 已天然具备张力所需全部要素——`confidence`（冲突把握）、`evidence_ids`/`observation_ids`（依据）、`pending/confirmed/rejected` 生命周期（用户未表态前张力也是待定的），无需为张力发明任何新字段。
- **正向**：守住 Article 8 分层，Evidence 继续作为被动溯源源，不被拖入关系图。
- **负向/后续**：因 `from` 是 Interpretation，它无反向索引字段，张力不入 Thought 的反向索引缓存（见 ADR-0005）——读取"某 Thought 正被哪些 Interpretation 挑战"须直查 Relation 表。
