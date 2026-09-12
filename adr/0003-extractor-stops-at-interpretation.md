# ADR-0003: Extractor 输出止于 Observation / Interpretation，不产出 Thought



> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: Accepted
**Date**: 2026-07-27
**领域**: Agent 能力边界 / 流水线分层
**关联文档**: `(private agent capability)`（「与早期草稿的一处修正」「不属于本职责范围」）、`specs/protocols/Thought_Extraction_Protocol.md`、`specs/specifications/v0.1.md`（Article 5、S-2.2）、`specs/protocols/Confirmation_Protocol.md`

## Context

早期草稿曾设想 `Conversation → Extractor → Thought Draft` 的直线流程。但 `Thought.origin_type` 只能是 `user_authored` 或 `derived_from_interpretation`，后者必须经用户对 Interpretation 的 `confirmed` 动作。若 Extractor 直接产出"Thought Draft"，等于 AI 越过确认环节直接生成正式思想节点。

需明确 Extractor 的合法输出终点，防止职责蔓延。

## Decision

Extractor 的合法输出终点是 `Observation` 草稿（`status=active`）与 `Interpretation` 草稿（`status=pending`，须带 `confidence`），**止步于此**。是否成为 Thought，是用户在 `Confirmation_Protocol.md` 中触发的独立动作，不属于 Extractor 职责。

## 备选方案（被否决的）

- **Extractor 直接产出 Thought 草稿**：违反 Article 5（AI 可以形成判断，但 Thought 的所有权归用户，不得未经认领写成用户 Thought）与 S-2.2（AI 不得单方面定案）。Thought 是用户的长期思想节点，其产生必须由用户确认，AI 只能"观察/解释/建议/总结"。否决。
- **Extractor 顺带判断 Relation（矛盾/支持）**：违反其能力边界（"不合并/不判断 Relation"，见 `capability.md`），且会把关系发现混入提取职责——该职责已拆给 ADR-0004 的冲突检测逻辑。否决。

## Consequences

- **正向**：思想主权清晰——AI 只负责"看到什么/想到什么"，用户负责"记下来什么"，与 Article 6（用户最终决定权）一致。
- **正向**：为下游的 `Confirmation_Protocol`（派生 Thought）与 `Conflict_Detection_Protocol`（发现张力）留出干净的消费边界。
- **负向/后续**：Extractor 与冲突检测之间需明确的接口契约（新 Interpretation 候选如何被下游消费），已在 `Conflict_Detection_Protocol.md` 的调用时机段定义。
