# Continuity Policy Resolution v0.2 (Design Cycle Entry)

> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。

**Status**: DESIGN CYCLE OPEN — Phase A (Policy Question Resolution). No ADR decided. No implementation.
**Date**: 2026-08-03
**Phase**: Phase 4 v0.2 (Policy Boundary), entered from the closed v0.1 checkpoint
**Upstream (frozen, not reopened)**: `specs/Phase4_Resolver_Readside_Skeleton_Validation_Report.md` (ACCEPTED) + `adr/0021` (ACCEPTED)
**Discipline**: same as v0.1 — freeze the question before touching the runtime.

> This document opens a **new cycle**. It does not extend the v0.1 implementation line.
> It contains **no** ranking, freshness, priority algorithm, scoring formula, or code.

---

## 0. Position in the evolution path

```
Phase 3        Data Boundary            DONE
Phase 4 v0.1   Transition Boundary      DONE
Phase 4 v0.2   Policy Boundary          IN DESIGN  ← this document
Phase 4 v1.0   Continuity Intelligence  FUTURE
```

v0.1 proved the connection layer exists. v0.2 answers a different kind of question.

> **路线调整（2026-08-04, 剃刀原则）**：ADR-0022 已闭合 Representation + Authority 两层，构成足够架构基础。继续在 Q2/Q3 文档层收敛的边际收益低于一次真实体验验证。故 v0.2 的 Q2/Q3 文档决策**暂停**，优先进入 **Phase 4 Experience Prototype**（最小可体验闭环），据用户验证结果回填 ADR-0023/0024 与 Policy v0.2。详见文末 §7。

---

## 1. Problem Statement

v0.1 established:

```
Primitive → Resolver → ContinueContext
```

v0.2 must establish:

```
Candidate Primitives
        ↓
Continuity Policy
        ↓
Resolved ContinueContext
```

The question is **not** "how to sort candidates". It is:

> **On what authority does the system decide what is worth continuing?**

Today `Reflection = primary` is a validation baseline, not a policy. It was chosen to prove the channel, and carries no claim of correctness.

This is not an algorithm problem. It starts at the **policy boundary**, and the boundary starts with the question of authority.

> The most important thing right now is not making Mirror *smarter*. It is defining **who holds the power to decide what continues** — this is what separates Thought OS from a generic AI memory product.

---

## 2. Inherited constraints (frozen by v0.1 — NOT reopened here)

These are not up for redesign in this cycle:

| Constraint | Source |
|---|---|
| Primitive is the only source of truth | ADR-0021 |
| Resolver is a read-side transition layer and holds **no cognitive judgment authority** | ADR-0021 Constraint A |
| `ContinueContext` is a projection, not state (`generated → consumed → discarded/regenerated`) | ADR-0021 Constraint C |
| No new fourth state source may be introduced | ADR-0021 Constraint C |

Policy work happens **inside** these constraints. Any candidate model that violates one is disqualified without further evaluation.

---

## 3. Decision Framework — Q1 / Q2 / Q3

Three prerequisites, three separate layers, three separate ADRs. **They must not be merged.**

| Question | Domain | Target ADR |
|---|---|---|
| Q1 Primary | authority (决策权) | ADR-0022 Continuity Primary Resolution Authority → **ACCEPTED (Model D, 2026-08-04)** |
| Q1-repr | representation (表达模型前提) | ADR-0022 §3.1 Representation Precondition → **ACCEPTED (frozen 2026-08-04)** |
| Q2 rationale | expression (表达层) | ADR-0023 ContinueContext Explanation Semantics → **ACCEPTED (2026-08-04)** |
| Q3 Knowledge | lifecycle (生命周期) | ADR-0024 Knowledge Continuity Lifecycle |

---

### Q1 — Who owns the choice of `primary`? (highest priority)

This determines the philosophy of the whole continuation system. Candidate models, recorded for evaluation — **no selection made here**:

**Model A — Runtime Rule**
Fixed precedence, e.g. `latest Reflection > PendingSlot > Knowledge > StalledPrompt`.
*Pro*: deterministic, testable, no AI dependency. *Con*: weak on explicit user intent.

**Model B — User Explicit Action**
The user chooses: Continue Reflection / Resume Pending Task / Revisit Knowledge.
*Pro*: respects user control. *Con*: reduces automatic continuity experience.

**Model C — Resolver Policy**
System decides from primitive metadata (freshness, recurrence, connection, user interaction).
*Pro*: strong automation. *Con*: prone to sliding into AI judgment — highest risk against Constraint A.

**Model D — Hybrid** (likely the better fit for Thought OS)
e.g. `explicit user intent > active unfinished thread > recent reflection > long-term knowledge`.
Requires careful definition; the ordering above is an illustration, not a proposal.

Real difficulty: not "how to rank", but **who is entitled to decide what continues** — a matter of product philosophy and system strategy, not algorithm detail.

> **Prerequisite (re presentation, not authority)** — Q1 的 authority 问题依赖一个更底层前提：系统是否必须产出单一 primary。该前提已在 ADR-0022 §3.1 **Representation Precondition** 中**冻结（ACCEPTED, 2026-08-04）**：`ContinueContext represents a possible continuation entry generated from available continuity primitives and current context projection.`（见 ADR-0022 §3.1.8）。Representation 层已关闭。
>
> **Authority（§4）已于 2026-08-04 决出 Model D**：
> ```
> Representation:  ACCEPTED (frozen)
> Authority:       ACCEPTED (Model D — Shared Authority)
> ```
>
> 状态同步（不重复 R 模型内容，避免第二份 representation decision source）：
> ```
> Phase A
>   Q1-repr
>     ADR-0022 §3.1   ACCEPTED (frozen 2026-08-04)
>         ↓
>     Representation Decision        ("ContinueContext = continuation entry")
>         ↓
>     Q1 Authority Decision          (Model D, 2026-08-04)
>         "Who defines the generation authority of a continuation entry?"
>           → Continuity Policy (generation) + User (final acceptance)
>         ↓
>     ADR-0022 ACCEPTED
> ```
>
> **最终架构语义（Representation + Authority 组合）**：
> ```
> Primitive → Continuity Policy (Model D generation authority)
>         → Resolver → ContinueContext (possible entry)
>         → User choice (accept / modify / ignore)
> ```
> ADR-0022 两决策层均闭合，进入 ACCEPTED。Q2/Q3 与 Phase C/D 不在本 ADR 范围。

---

### Q2 — What does `rationale` mean?

Currently `rationale?: string` is interface-only, with no committed semantics. Three distinct directions — **must not be conflated**:

- **A. UI Explanation** — product-experience copy, e.g. "你上次留下了一个未完成的问题。"
- **B. Reason Trace** — developer observability, e.g. `{ rule: "reflection_latest", score: null }`
- **C. User Continuity Explanation** — cognitive experience; explains the *thought*, not the algorithm: "我们之前停留在这个思考节点。" Closest to Thought OS's intent.

A possible outcome is a split rather than a choice:

```ts
ContinueContext {
  material
  resolutionTrace   // internal
  userExplanation   // optional
}
```

Recorded as a possibility only. **Not to be implemented in this cycle.**

> **Q2 design cycle CLOSED (2026-08-04)** — ADR-0023 已 ACCEPTED。Decision：`rationale` 主语义 = Model C（User Continuity Explanation，表达用户与入口的连续关系），可选内部 trace = Model B（Reason Trace，系统验证，默认不呈现），Model A 不进入 rationale 字段。冻结句：`ContinueContext rationale represents continuity relationship, not system's judgment of importance.` 核心红线守住：rationale 不得变成隐藏的认知判断理由。此决策为 Q3 Knowledge Lifecycle 提供了表达边界（Knowledge 进入 continuation 时须沿用 Model C 风格，不得呈现为"推荐"）。具体候选与矩阵见 ADR-0023，不在此重复。

---

### Q3 — How does Knowledge enter continuity?

The largest open question. The failure mode to avoid:

```
Knowledge = memory      ← leads to a generic AI memory product
```

Knowledge likely needs to be re-typed before any read path is designed:

- **Type 1 — Passive Knowledge**: long-term thought asset; never surfaces automatically.
- **Type 2 — Connected Knowledge**: has a connection to the current Reflection; may serve as *supporting*.
- **Type 3 — Promoted Continuity Material**: becomes a long-term continuation candidate through some rule. **This requires its own ADR.**

Gap-004's real uncertainty was always lifecycle, never reading.

---

## 4. Non-goals (this cycle)

Out of scope until a policy scope is frozen:

- ranking / scoring / weighting algorithms
- freshness or decay functions
- priority tables and conflict-resolution mechanics
- embedding, similarity, retrieval
- LLM-based judgment of what matters
- any write path, memory creation, or primitive mutation
- schema change, data migration, UI change
- modification of the v0.1 resolver implementation line

Also explicitly not a goal: making the system *smarter*.

---

## 5. Cycle plan

> **2026-08-04 调整**：原 Phase A→B→C→D 线性链在 ADR-0022 闭合后暂停于 Q2/Q3 文档决策，插入体验验证前置。

```
Phase A   Policy Question Resolution   Q1 ACCEPTED (ADR-0022); Q2/Q3 暂停
Phase B   Policy ADRs                   ADR-0023 Q2 已记录假设 (待体验回填); ADR-0024 不新建
Phase 4★  Continuity Experience Prototype   ← CURRENT: 验证前不锁死 Q2/Q3
Phase C   Freeze `Continuity Policy Proof Scope v0.1`   (体验后)
Phase D   Implementation
```

**Phase 4★ 体验验证优先于文档决策的原因**：用户回来看到一个 continuation entry 是否觉得"这就是我之前想的，我可以继续"，不能靠 ADR 推导，必须运行。验证结果决定 Q2 rationale 设计、Knowledge 是否进入、primary 是否需要复杂 policy。

**Phase C proof target** (recorded now so implementation cannot drift):

> Policy can change the resolution outcome **without** changing primitive ownership.

Illustrative shape:
```
input:  [ Reflection A, PendingSlot B ]
output: primary = B, supporting = A
```
Proving the outcome moved while the Resolver boundary held.

**Phase D target shape**, from:
```
Primitive → Resolver → ContinueContext
```
to:
```
Primitive Readers → Candidate Set → Continuity Policy → ContinueContext
```
with the §4 prohibitions still in force.

---

## 6. Exit condition for Phase A

Phase A 的 Q1（ADR-0022）已 ACCEPTED。Q2/Q3 不再要求先完成文档决策才进验证——改为：先完成 Phase 4 Experience Prototype 的用户验证，再据结果回填 ADR-0023/0024，然后冻结 Policy Proof Scope（Phase C）。

---

## 7. Phase 4 Continuity Experience Validation Scope (CURRENT)

> 触发：2026-08-04 剃刀原则复核。目标不是完善 Policy 文档，而是验证一句话：*一个简单 continuation entry 是否能让用户恢复思考连续性？*

### Step 1 — 冻结已实现决策（不改）
- `Primitive → Resolver → ContinueContext` 不变，Resolver v0.1 不动。
- 暂定接口：`ContinueContext { primary: ContinuationMaterial; supporting: ContinuationMaterial[] }`。

### Step 2 — Baseline Continuity Policy（非智能，仅验证 UX）
```
Primary:   latest unresolved Reflection
Supporting: related PendingSlot
Knowledge: ignored
StalledPrompt: ignored
```
理由：非最佳规则，仅验证 UX 假设。

### Step 3 — Home Continue Experience
用户打开 Mirror 看到 `Continue Thinking` 区块：呈现上次 Reflection 主题 + 留下的未完成问题 + `Continue` / `Not now`。
点击 `Continue` 后恢复 Conversation。

### Step 4 — 记录验证结果（看算法之外）
1. 用户是否理解为什么出现？
2. 是否愿意继续？
3. 是否感觉被理解？
4. 是否感觉被评价？

**验证结果决定**：Q2 rationale 是否采用 ADR-0023 假设（Model C 连续关系）；Knowledge 是否进入（Q3）；primary 是否需要复杂 policy。

### 纪律
- 不新建 ADR-0024；
- 不进 ranking/scoring/LLM 决策；
- Resolver v0.1 实现线不回扩；
- 体验验证前 Q2/Q3 保持"假设待回填"状态。

---

*Design cycle entry document. Problem statement and decision framework only — Q1 decision frozen (ADR-0022), Q2/Q3 recorded as hypotheses pending Experience Prototype validation, no scope frozen, no implementation authorized beyond Phase 4★.*
