# ADR-0004: 冲突检测作为独立于 Extractor 的协议



> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: Accepted
**Date**: 2026-07-27
**领域**: 协议分层 / 职责边界
**关联文档**: `specs/protocols/Conflict_Detection_Protocol.md`、`(private agent capability)`（第 33 行「不合并/不判断 Relation」）、`specs/concepts/Relation.md`（第 66 行原「已知缺口」已指向本协议）、`specs/evaluation/cases/batch002-relation-evolution.md`（REL-CHALLENGES-001）

## Context

ADR-0001/0002 把张力建模为 `challenges` Relation，但"当一条新 Interpretation 与既有 Thought 冲突时，由谁、在哪一步创建这条 `pending` challenges"此前没有归属——它既不在 `Thought_Extraction_Protocol`（该协议止于 Interpretation 草稿），也不在 `Confirmation_Protocol`（只处理用户对已有候选的响应）。`Relation.md` 第 66 行曾诚实标注此为"已知缺口"，只含糊说"系统判定"。

需决定这段"系统"说法落在哪个组件/协议里。

## Decision

冲突检测收口为独立协议 `Conflict_Detection_Protocol.md`，作为 Extractor 产出 Interpretation 候选之后的**下游消费步骤**运行。执行者明确为"独立于 Extractor 的冲突检测逻辑"（可以是独立组件或另一 agent 能力），**不得是 Extractor 自身**。它只负责：比对新 Interpretation 与 `status=active` 的 Thought 集合，对构成冲突的对创建 `ai_suggested`/`pending` 的 `challenges` Relation。

## 备选方案（被否决的）

- **塞进 Extractor**：直接违反 `capability.md` 第 33 行"不合并/不判断 Relation"，并破坏 ADR-0003 的边界。否决。
- **塞进 Confirmation_Protocol**：该协议处理的是"用户对已存在候选的响应"，是被动触发；而冲突发现是"主动比对新候选与全部既有 Thought"，是主动扫描，语义不符。否决。
- **继续留作模糊的"系统"说法**：违反 Article 0 精神（把模糊的"系统"暴露为可审查的步骤）。否决。

## Consequences

- **正向**：消除 `Relation.md` 第 66 行的"已知缺口"，文档自洽。
- **正向**：与 `batch002` 的 `REL-CHALLENGES-001` 断言对齐，可自动化测试。
- **负向/后续**：该逻辑需要语义推断能力（判断"是否真矛盾"），实现上可能仍需模型参与；但其输出始终停留在 `ai_suggested`/`pending`，不越权定论（呼应 Article 5）。
