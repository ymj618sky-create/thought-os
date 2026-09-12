# Continuity Resolution Layer v0.1 — Review Notes

> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。

**Status**: CLOSED (architecture review concluded; outcomes carried into `adr/0021`, ACCEPTED)
**Date**: 2026-08-03
**Reviews**: `specs/architecture/Continuity_Resolution_Layer_v0.1.md` (DRAFT)
**Governing**: Phase 3 Closure (`specs/Phase3_Closure_Report.md`)

---

## 1. Architecture Review — is the Resolver necessary or overengineering?

**Verdict: necessary missing layer, not overengineering.**

Phase 3 established the Continuity Adoption Map:

| Primitive | Exists | Persisted | Connected | User-visible |
|-----------|--------|-----------|-----------|--------------|
| Reflection Event | ✅ | ✅ | ✅ | ✅ |
| PendingSlot | ✅ | ✅ | ❌ | ❌ |
| Knowledge Context | ✅ | ❌ | ❌ | ❌ |

The root problem is **not missing data**. It is the absence of a layer that decides, on user return, *what should be continued*. Today:
- PendingSlot exists but has no unified entry into continuation.
- Knowledge has a lifecycle but no continuation projection.
- StalledPrompt has a concept but no recovery entry.

If the Resolver merely *moved data*, it would be unnecessary. The v0.1 definition instead makes it own the **continuity transition** (resolve → continue), which is precisely the missing layer. This matches the "missing layer" criterion, not the "over-abstracted" one.

---

## 2. Evaluation of the three proposed Architecture Constraints

### Constraint A — Read-side Decision Layer
**Accepted.** The `Storage → Primitive → Resolver → ContinueContext → UX` flow is explicit, and the forbidden `Resolver → Agent → LLM → mutates user state` path is named. This preserves the Thought OS boundary: the Resolver resolves transitions, it does not act on the user. No objection.

### Constraint B — Primary Selection ≠ Cognitive Judgment
**Accepted and important.** `primary` is a policy-driven recovery entry, explicitly NOT a judgment of a thought's value. The rule "The Resolver performs continuity resolution, not cognitive evaluation" prevents future priority/freshness logic from being misread as AI evaluating the user's thinking. Strongly endorse freezing this.

### Constraint C — ContinueContext is Projection, not a fact source
**Accepted.** ContinueContext lifecycle (generated → consumed → discarded/regenerated) prevents a fourth persistent state source. Without this, a future `Gap-005: Continuation Projection Drift` is likely. Endorse.

All three constraints are binding and should carry into the ADR and any implementation.

---

## 3. What the Resolver must NOT become

- Not an Agent / LLM judge of user state.
- Not a creator or mutator of primitives.
- Not a new persistent source of truth (Constraint C).
- Not a priority/ranking/embedding engine in v0.1 (those are implementation decisions, explicitly out of scope).

---

## 4. Open items before freeze

- The three constraints are added to v0.1 §6 and should be frozen with it.
- ADR-0020 should freeze ONLY: Resolver exists / input primitives / output ContinueContext / no ownership change / no schema change. It must NOT freeze priority algorithm, ranking, embedding, or LLM involvement.
- First implementation scope (if approved later) is strictly: Resolver service + `GET /api/continue` migration + existing-data projection. NOT Knowledge persistence, new tables, ranking engine, user-intent model, or memory rewrite.

---

## 5. Initial verification matrix (for the future implementation phase)

| Primitive | Source | Resolver Output | Expected |
|-----------|--------|-----------------|----------|
| Reflection | Reflection Event | primary | PASS |
| PendingSlot | Pending Slot | supporting | PASS |
| Knowledge | existing knowledge | supporting / empty | observe |
| StalledPrompt | existing state | observe | pending decision |

The first build should prove: **one resolver can unify three continuation sources**.

---

## 6. Review conclusion

The v0.1 abstraction correctly reframes the three Phase 3 gaps from "three missing features" into "one missing continuation-transition boundary". If frozen correctly (with Constraints A/B/C and a narrowly-scoped ADR-0020), Gap-002/003/004 will not degenerate into three independent patches.

**Recommendation: proceed to ADR-0020 freeze; do NOT enter resolver implementation yet.**

---

*Review notes for Phase 4 design entry. No code, no schema change. Next artifact: ADR-0020.*
