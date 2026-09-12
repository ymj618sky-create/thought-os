# ADR-0006: 矛盾 Thought 允许长期共存，禁止自动合并或强制二选一



> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: Accepted
**Date**: 2026-07-27
**领域**: 思想主权 / 演化语义
**关联文档**: `specs/specifications/v0.1.md`（S-8.2 [MUST] 支持矛盾共存）、`specs/concepts/Relation.md`（`contradicts` 关系）、`specs/protocols/Confirmation_Protocol.md`（「分支：Relation」）、`specs/evaluation/cases/batch002-relation-evolution.md`（REL-S082-001）

## Context

两条 Thought 之间存在 `contradicts` 关系（无论是用户自建还是由 `challenges` 升级而来）时，系统面临选择：是"贴心"地帮用户消弭矛盾（合并/强制选一），还是保留矛盾。

## Decision

矛盾允许长期共存。系统**不得**因为存在 `contradicts` 关系就自动将其中一条 Thought 改为 `archived`/`superseded`，**不得**自动把两条 content 拼接/改写成"折中版" Thought，**不得**弹出"这两条矛盾，请选择保留哪一条"的强制二选一交互（不选择就无法继续）。

## 备选方案（被否决的）

- **自动合并/强制二选一**：直接违反 S-8.2（[MUST] 支持矛盾共存），也侵犯 Article 6（用户最终决定权）——矛盾是否、何时、如何化解，是用户自己的成长节奏，不应由系统代劳。否决。

## Consequences

- **正向**：忠实保留用户思想的真实状态，矛盾本身就是 Article 12 看重的高价值成长信号。
- **正向**：与 `REL-S082-001` 断言对齐，可自动化回归。
- **负向/后续**：前端需设计"矛盾共存"的展示样式（如同屏并列两条 active 矛盾 Thought），而非引导用户尽快消除矛盾。
