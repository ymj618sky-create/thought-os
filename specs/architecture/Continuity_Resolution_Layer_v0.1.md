# Continuity Resolution Layer v0.1 (Design Decision)

> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。

**Status**: ACCEPTED DESIGN (capability model accepted; conclusions frozen by `adr/0021`. Design decision only — NOT implementation; NOT a Constitution-level change)
**Date**: 2026-08-03
**Phase**: Phase 4 (design entry point, following Phase 3 CLOSURE)
**Input constraint**: `specs/Phase3_Closure_Report.md` — the Continuity Adoption Map and the three lifecycle-transition gaps.
**Governing**: `specs/Phase3_Validation_Thesis.md` v1.0 (§7 discipline carries forward)

> This document solves design questions only. No Runtime / Schema / Telemetry change is implied. Phase 4 must not start by coding; it starts by resolving the questions below.

---

## 0. Why this document exists

Phase 3 proved Mirror has a **Reflection-centric Continuity core** and identified three gaps. Framing them as `Fix Gap-002 / Gap-003 / Gap-004` would yield three incompatible patches (an interface here, a few fields there, a table elsewhere). The correct response is a **single Continuity Resolution Layer** that owns the transition from stored primitives to a user-facing Continue experience.

Core question (not "how to show PendingSlot on the home page"):
> When the user returns, how does the system decide *what is worth continuing*?

---

## 1. Continuity Primitive definition

A **Continuity Primitive** is any cognitive object that *may* re-enter the user's awareness across a session boundary. It is characterized by the four lifecycle stages validated in Phase 3:

| Stage | Meaning |
|-------|---------|
| Exists | The object is produced by the system. |
| Persisted | It survives a session boundary (restart / day gap). |
| Connected | It enters the resolver (not merely stored). |
| User-visible | The returning user can obtain it via a Continue entry. |

Current primitives (from Phase 3 Adoption Map):

| Primitive | Exists | Persisted | Connected | User-visible | Stuck at |
|-----------|--------|-----------|-----------|--------------|----------|
| Reflection Event | ✅ | ✅ | ✅ | ✅ | fully in lifecycle (projection split = Gap-003) |
| PendingSlot | ✅ | ✅ | ❌ | ❌ | persist (Gap-002) |
| Knowledge Context | ✅ | ❌ | ❌ | ❌ | turn-scoped (Gap-004) |
| Stalled Prompt | (candidate) | (candidate) | ❌ | ❌ | candidate primitive, not yet validated |

This definition is the **reusable gate** for any future primitive: ask the four questions before claiming Continuity support.

---

## 2. Resolver input / output contract

**Input** — candidate Continuity Primitives presented to the resolver:
```
ResolutionContext {
  userId / dataRoot
  activeSpaceId?
  recentReflections:   ReflectionEvent[]
  pendingSlots:        PendingSlot[]
  stalledPrompts:      StalledPrompt[]
  knowledgeCandidates: KnowledgeContext[]   // derived per-turn, may be re-derived deterministically
  returnedAt:          timestamp
}
```

**Output** — a single `ContinueContext` the Continue entry renders:
```
ContinueContext {
  primary:      ContinuityPrimitive | null   // what the system judges most worth continuing
  supporting:   ContinuityPrimitive[]         // secondary candidates, ranked
  rationale:    ResolutionReason              // priority / freshness / user-intent signal
  freshness:    timestamp
}
```

The resolver is the **only** component that decides what Continue shows. Today `/api/home` and `/api/space-continue` read Reflection directly; under this design they call the resolver instead. (Migration path in §4.)

---

## 3. Continue Context data structure

`ContinueContext` is intentionally primitive-agnostic. Each candidate carries:
```
ContinuityPrimitive {
  kind:       'reflection' | 'pending_slot' | 'stalled_prompt' | 'knowledge'
  id:         string
  summary:    string          // user-facing continuation material
  createdAt:  timestamp
  sourceRef:  primitive-specific locator   // e.g. reflection_id, pending_slot_id
}
```

This unifies Gap-002 (PendingSlot becomes a first-class `kind`), Gap-003 (Reflection `summary` is the canonical `summary` field, not split between kv/aggregate paths), and Gap-004 (Knowledge, if promoted, enters as `kind: 'knowledge'` with deterministic re-derivation instead of per-turn memory).

---

## 4. Compatible migration from Reflection-centric Continue

Phase 3 established Reflection continuity works. Migration must not break it:

1. **Keep** Reflection storage + retrieval (T3 PASS) untouched.
2. **Introduce** `Resolution Layer` as a new read-side component; `/api/home` and `/api/space-continue` call it instead of reading Reflection directly.
3. **Initial resolver implementation** may return Reflection as `primary` (preserving today's behavior) while *also* enumerating PendingSlot / StalledPrompt as `supporting` — making Gap-002/003 visible without a behavior regression.
4. **Gap-003 fix** is then a resolver-internal decision: project `summary` (aggregate) as the Reflection `summary`, not the empty kv `content` path.
5. **Gap-004** is deferred to a later sub-decision: whether Knowledge should be (a) re-derived deterministically per Continue, or (b) persisted. The resolver contracts for it but does not require it in v0.1.

No schema change is required for steps 1–4; only a new resolver module and a change in what the Continue endpoints read.

---

## 5. Unified direction for Gap-002 / 003 / 004

| Gap | Addressed by | Mechanism |
|-----|--------------|-----------|
| Gap-002 (Intent binding) | Resolver consumes `pendingSlots` as `kind: 'pending_slot'` candidates | one resolver, not a new Continue interface |
| Gap-003 (Reflection projection) | Resolver projects aggregate `summary` as canonical continuation material | single projection path, ends kv/aggregate split |
| Gap-004 (Knowledge lifecycle) | Resolver contracts `knowledge` kind; promotion deferred to sub-decision | no premature table; deterministic re-derivation allowed |

All three are resolved by **one layer owning the transition**, not three patches.

---

## 6. Architecture Constraints (pre-freeze, binding on any implementation)

These three constraints are the reason the Resolver is a *missing layer*, not *overengineering*. They must hold in every later implementation.

### Constraint A — Resolver is a Read-side Decision Layer

```
Resolver:
    consumes existing primitives
    produces continuation projection

Resolver does NOT:
    create primitive
    mutate primitive
    judge user state
    generate thought
```

Data flow must stay:
```
Storage → Primitive → Resolver → ContinueContext → UX
```
NOT:
```
Storage → Primitive → Resolver → (Agent/LLM judges) → mutates user state
```
This protects the existing Thought OS boundary: the Resolver resolves continuity transitions, it never becomes an actor that alters the user's cognitive state.

### Constraint B — Primary Selection ≠ Cognitive Judgment

`primary: Reflection Event A` means only:
> Per current continuation policy, A is the current recovery entry.

It does NOT mean:
> The system judges A to be the most important thought.

Priority / freshness are policy signals, not evaluations of a thought's value. Documented rule:
> **The Resolver performs continuity resolution, not cognitive evaluation.**

### Constraint C — ContinueContext is a Projection, never a new fact source

`ContinueContext` lifecycle:
```
generated → consumed → discarded / regenerated
```
It must NOT become a fourth persistent state source alongside Reflection / PendingSlot / Knowledge. Forming four state sources would create a future:
```
Gap-005: Continuation Projection Drift
```
The Resolver reads primitives; it does not write a new source of truth.

---

## 7. Open sub-decisions (out of scope for v0.1)

These must be answered before implementation, but are explicitly NOT solved here:
- Priority / conflict / freshness / user-intent weighting inside the resolver.
- Whether Knowledge promotion uses persistence or deterministic re-derivation.
- Stalled Prompt lifecycle validation (candidate primitive, not yet in Adoption Map).
- UI/UX of `supporting` candidates vs `primary`.

---

## 8. Discipline (carried from Phase 3)

- This is a design decision; no code until the resolver contract is frozen and reviewed.
- No Runtime Manager / Supervisor / Plugin Loader / Cloud Sync / Auto Update introduced.
- Any schema addition (only if step 5b requires it) goes through its own ADR + review, not silently.
- The four-stage lifecycle question remains the validation gate for every primitive.

---

*Draft design entry for Phase 4. Built strictly on Phase 3 evidence. Not a Constitution change; not an implementation commit.*
