# ADR-0021: Continuity Resolution as Read-side Projection

> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: ACCEPTED (Frozen 2026-08-03. Architecture decision complete; implementation deferred to Phase 4 Implementation Proposal.)
**Date**: 2026-08-03
**领域**: Continuity / 恢复入口 / 续思决策层
**关联文档**: `specs/Phase3_Closure_Report.md`（Continuity Adoption Map + Gap-002/003/004）、`specs/architecture/Continuity_Resolution_Layer_v0.1.md`（设计决策）、`adr/0015-reflection-event-vs-projection.md`（Reflection 事件/投影分离）

## Context

Phase 3 验证证明 Mirror 当前拥有 **Reflection-centric Continuity 核心**，但暴露三个 lifecycle-transition gap：
- **Gap-002 (Intent binding)**: PendingSlot 已持久化，但未进入 Continue 入口。
- **Gap-003 (Reflection projection consistency)**: Reflection 已是 primitive，但存储层（聚合 `reflections.summary`）与展示层（`/api/home` 读的 kv `reflection.content` 为空）未统一。
- **Gap-004 (Knowledge lifecycle)**: Knowledge 是 turn-scoped 能力，未持久化、未与 Reflection 关联、未被 Continue 投影。

根因不是"缺数据"，而是系统缺少一个决定「用户下次回来时，什么应该被继续」的层。若分别修补三 Gap，会产生三个互不兼容的补丁。因此需要引入 **Continuity Resolution Layer** 作为统一的续思决策层。

本 ADR 仅冻结该层的**存在性与边界**，不冻结其内部算法。

## Decision (frozen)

**Continuity Resolution Layer is introduced as a read-side projection layer.**

Frozen:
1. Resolver exists as a dedicated continuity transition boundary.
2. Resolver consumes existing continuity primitives.
3. Resolver produces ContinueContext projection.
4. Resolver does not change primitive ownership.
5. Resolver does not require schema changes.

Explicitly Not Frozen:
- priority policy
- ranking strategy
- freshness calculation
- embedding usage
- LLM involvement
- Knowledge promotion mechanism
- StalledPrompt lifecycle policy

## Constraints (carried from design v0.1 §6, binding)

- **A. Read-side Decision Layer**: Resolver 只消费 primitive、只产出投影；不创建/修改 primitive、不判断用户状态、不生成思想。`Storage → Primitive → Resolver → ContinueContext → UX`，而非 `Resolver → Agent/LLM → 修改用户状态`。
- **B. Primary Selection ≠ Cognitive Judgment**: `primary` 是 policy 驱动的恢复入口，不是系统对用户思想价值的判断。Resolver 执行 continuity resolution，不执行 cognitive evaluation。
- **C. ContinueContext 是投影而非事实源**: 其生命周期为 generated → consumed → discarded/regenerated，不得成为与 Reflection/PendingSlot/Knowledge 并列的第四状态源（否则未来产生 Gap-005: Continuation Projection Drift）。

## Non-frozen (explicitly out of scope — implementation decisions, not this ADR)

- priority / conflict / freshness / user-intent 权重算法
- ranking / ordering 机制
- embedding / vector retrieval
- 任何 LLM 参与（Resolver 不调用模型做续思判断）
- Knowledge 晋升方式（持久化 vs 确定性重算）
- StalledPrompt 生命周期验证

## Consequences

Positive:
- Future continuation sources can join through primitive contracts instead of independent UX paths.
- Gap-002 / Gap-003 / Gap-004 can converge toward one transition boundary.

Negative:
- Resolver policy complexity will become a future implementation concern.
- Additional primitives must satisfy the Continuity Primitive contract before integration.

- 现有 Reflection 连续性（T3 PASS）不受影响；迁移为 read-side 替换 `/api/home`、`/api/space-continue` 的直接读取。
- 实现前须先回答 Review Notes §4 的开放子决策，并产出 Phase 4 Implementation Proposal（独立文档，不在本 ADR 内）。

## Validation gate (forward)

任何新 primitive 加入 Continuity，须经四阶段生命周期提问（Exists / Persisted / Connected / User-visible），与 Phase 3 方法论一致。

---

*Accepted architecture decision for Phase 4 (frozen 2026-08-03). Implementation deferred to Phase 4 Implementation Proposal; no code implied.*
