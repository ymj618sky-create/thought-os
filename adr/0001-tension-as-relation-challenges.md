# ADR-0001: 未化解张力复用 Relation（challenges 类型），不新建 Tension 实体



> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: Accepted
**Date**: 2026-07-27
**领域**: 概念建模 / 关系层
**关联文档**: `specs/concepts/Relation.md`（「未化解张力」一节）、`specs/schemas/Relation.schema.json`、`specs/specifications/v0.1.md`（Article 0）、`specs/protocols/Confirmation_Protocol.md`、`specs/evaluation/cases/batch002-relation-evolution.md`

## Context

一条新的 Evidence 促使 Extractor 生成一条与用户已确认 Thought 相冲突的 Interpretation。在用户对该 Interpretation 做出确认/驳回之前，它还不是正式 Thought，无法用 `contradicts` 连接两条 Thought。这个"尚未化解的认知摩擦"是 Article 12 最看重的成长信号之一，但彼时模型里没有地方承载它。

需要决定：张力应当被建模为一个**新的独立概念 `Tension`**，还是**复用已有的 `Relation`**。

## Decision

不新建 `Tension` 实体 / schema。复用 `Relation`，新增 `relation_type=challenges`，允许 `from_type=interpretation`、`to_type=thought`。张力的完整生命周期（产生 / 驳回 / 升级 / 确认不存）全部跑在 `Relation` 已有的状态机（`pending` / `confirmed` / `rejected` / `superseded`）之上。

## 备选方案（被否决的）

- **新建独立 `Tension` 实体**：经 Article 0 剃刀检验——"删掉它系统会失去什么"——答案是"会丢失用户还没决定怎么办的那个矛盾时刻本身"，这确实是可描述的思想现象，值得建模。**但**进一步检验发现，要支撑这个现象，`Tension` 必须自带一套状态机（待确认/已确认/已驳回/升级）和置信度机制——而这套东西 `Relation` 已经有了。新建 `Tension` 只是把 `Relation` 的状态流程复制一份，得到的不是"新能力"而是"重复的状态机"，不符合 Article 0 的准入标准（答案若只是"表达更方便/换个名字"，不得新增概念）。故否决。

## Consequences

- **正向**：零新实体、零新状态机，仅新增一个关系类型；张力天然复用 Relation 的审计、缓存一致性、演化追踪整套基础设施。
- **正向**：张力的演化轨迹（曾以 `challenges`/`pending` 存在、后升级为 `contradicts`/`confirmed`）可被完整保留，直接服务 Article 12。
- **正向**：与 `batch002-relation-evolution.md` 的 `REL-CHALLENGES-001~004` 断言逐字对齐，可自动化回归测试。
- **负向/后续**：冲突检测逻辑此前无 protocol 归属，已通过 ADR-0004 / `Conflict_Detection_Protocol.md` 收口。
