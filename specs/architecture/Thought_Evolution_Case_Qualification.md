# Thought Evolution — Case Qualification Reference

> Status: REFERENCE (verification / qualification only)
> Independent of: CRQR main document, ADR series, Case Log, current Evolution implementation.
> Sibling: `.obs-verify/thought-evolution-design-freeze.md` (capability boundary / minimal closed-loop design).
> This file does NOT design new capabilities. It only says when a real observation is allowed to be called a Thought Evolution Case.

---

## 0. Purpose & Non-Purpose

This file answers exactly one question:

> After observing a candidate change in a user's thinking, what evidence conditions must hold before we are allowed to call it **Thought Evolution**?

It does **not**:
- define a new architecture layer
- prescribe schema changes
- prescribe aggregation / projection / distribution-delta computation
- prescribe any automatic proposal mechanism
- replace or extend the minimal closed-loop implementation (design-freeze v0.1)

Its only job is **anti-drift protection**: prevent a future implementer from seeing a clean structural signal like `L1 24% → 0%` and calling it Evolution.

---

## 1. Four-Level Qualification Gate

A candidate phenomenon earns the name **Thought Evolution Case** only by passing all four gates in order. Failure at any gate routes it to an exclusion category (§2), never to "Evolution".

The four gates are **not a one-way filter** where the system decides ①–③ and the user only ratifies at ④. They are an **evidence chain** in which the user confers meaning at two distinct points (see Gate ④, two Authority Boundaries). Critically, the two AI actions in this chain are *Discovery* actions of **two different natures** — and neither may cross the fact layer into conferring relational meaning.

```
① Raw-word candidate discovery (AI = Discovery, nature A)
     AI: surfaces visible neighboring features between raw words A and B
         (a word recurs · similar hesitation phrasing · same time anchor ·
          similar question form · a concept appears in both stretches)
         ↓ STOP. Present the two stretches + the neighboring feature. Say nothing else.
     User Recognition: "yes, this is the same question I keep thinking about"
         ↓ ⇒ Object Continuity ESTABLISHED (by user, not system)
② Object claim (User)
③ Change discovery (AI = Discovery, nature B)
     AI: shows the observable structural difference BETWEEN the two stretches
         (only after user claimed ② — never before)
         ↓ STOP. Show the difference. Say nothing else.
     User Recognition: "right, this does describe my thinking change"
         ↓ ⇒ Evolution ESTABLISHED (by user, not system)
④ Evolution claim (User)
```

Both AI actions obey one principle:
> **AI may point out "there is something here", but may not decide for the user "what that thing is".**

- Nature A — may say: *"these two stretches show a visible connection."*  Must NOT say: *"they belong to the same question."*
- Nature B — may say (only after ②): *"given they are the same question, here is an observable difference."*  Must NOT say: *"your thinking therefore evolved in some way."*

So the real flow is NOT `AI judges object → AI judges change → user clicks confirm`. It is:
```
AI → finds visible neighboring feature (no semantic conclusion)
      ↓
User → claims object continuity
      ↓
AI → shows observable structural difference (no evolutionary conclusion)
      ↓
User → claims this is my thinking change
      ↓
Evolution holds
```
This matches the Constitution: **AI may discover relations, but cannot confer the meaning of relations on the user.**

### Gate ① — Object Continuity (a user-conferred semantic relation, NOT a system fact)
Must be the **same discussed object** — and "same object" is established by the **user's recognition**, not by the system's topic similarity.

> **Similar words ≠ same object; different words ≠ different object.**

Counter-example A (different words, SAME object — system must not break continuity on vocabulary):
> "quit" / "switch to another way of living" / "leave my current job" / "how to restart in the next phase"
> The system cannot judge the object broken merely because the words differ.

Counter-example B (same keyword, DIFFERENT object — system must not assume continuity on vocabulary):
> "Thought OS" (discussed as product positioning) → "Thought OS" (discussed as technical implementation)
> Identical keyword does not establish object continuity.

Therefore what we seek is **User-recognized object continuity**, never Topic similarity.

First principle for any real Case:
> **Do not ask "did the center shift" before asking "are these two stretches of raw words the same object."**
> Only if the object is continuous does "center migration" have any semantic ground. Otherwise: `object changed + distribution changed = Topic Shift`, not Evolution.

Example (same object):
> "Should I quit?" → "What do I do after quitting?"
> Object remains: the question of leaving / career exit. (User recognizes continuity.)

Non-example (Topic Shift, fails ①):
> "Should I quit?" → "How should Thought OS be designed?"
> Even if the Thought Space distribution changes dramatically, this is NOT Evolution of the first question.

**Topic Shift ≠ Thought Evolution.**

### Visible Neighboring Feature vs Semantic Conclusion (the fact-layer line)
Discovery (nature A) may surface **visible neighboring features** between two raw stretches, but must not cross into **conferring relational meaning**. The line:

**May point out (observable, pre-semantic):**
- a word recurs across both stretches
- similar hesitation phrasing appears in both
- both point to the same time anchor
- similar question form appears in both
- a concept appears in both stretches

**Must NOT assert (these are no longer Discovery — they confer meaning):**
- "they are discussing the same question"
- "you have been thinking about X"
- "this is your process from A to B"
- "this shows your focus migrated"

The same line repeats at Discovery (nature B): after the user claims object continuity, AI may show the *observable structural difference* between the two stretches, but must NOT assert "your thinking therefore evolved." Showing the difference is Discovery; calling it evolution is meaning-conferring.

### Gate ② — Center-of-Gravity Shift
Only after the object is stable, check whether the **dominant question inside that same object** moved.

Example:
```
Phase A — core: "Should I leave?"
Phase B — core: "If I leave, how do I carry the next phase?"
```
This is not merely "one more Thought added". What happened is: within the same question, the leading problematic moved. That is the Structural Change we track.

Minimum qualification for a second/third case:
> **Object unchanged + Cognitive Center changed.**

Note on ②: "center-of-gravity" is a *trigger condition* (signal appearance), not a self-standing fact. A Mirror-computed distribution (e.g. L1/L2/L7/L8/L11 weights) can **surface** a candidate, but it does not by itself confirm ②. Confirmation requires ③ + ④. A system-computed "center" must never be announced as a user cognitive fact.

### Gate ③ — Evidence Downshift
The structural signal must drill down to user expressions:

```
Structural signal
       ↓
Which old Thoughts are losing central position?
       ↓
Which new Thoughts are taking over?
       ↓
What were those Thoughts' original expressions?
       ↓
What exactly did they change?
```

> **Distribution change can only be a signal, never a meaning.**
> Meaning must return to the user's own words.

This blocks the trap we nearly walked into:
> mistaking "the Thought Space Mirror computed" for "the user's real cognitive structure".

Today we may only say:
> *Mirror observed a representation-level structural shift.*

We may **not** say:
> *Mirror observed the user's cognitive structure changed.*

Between the two, there must be an evidence chain.

### Gate ④ — User Recognition (carries TWO Authority Boundaries, not one)
Gate ④ is not a single click. It carries two distinct semantic conferrings:

- **Boundary 1 — Object Continuity confirmation:** the user asserts "these stretches of words are the same question I keep thinking about." This is what *establishes* Gate ① (object continuity is user-conferred, see Gate ①). The system may surface candidate words; it may not declare the object continuous.
- **Boundary 2 — Evolution confirmation:** *given* object continuity, the user asserts "this center-of-gravity migration is genuinely my thinking change." This is what *establishes* Evolution.

Even if ①–③ all appear to hold, if the user withholds either boundary, it is **not** Evolution.

This is the final and non-delegable semantic ownership: "I changed" stays with the user. The system may discover relations and propose; it may not confer their meaning.

### Observation Baseline (current)
> Valuable change lives not in the replacement between Thoughts, but in the **structural change of the Thought Space**.

With one standing qualification:
> Such structural change qualifies as an Evolution candidate **only when** it occurs *inside a user-confirmed continuous object* and can be drilled down to raw words.

This keeps us from both (a) reading a statistical chart as cognitive structure, and (b) missing real evolution merely because the object changed surface words.

---

## 2. Exclusion Categories

| Failed gate | Classification | Meaning |
|---|---|---|
| ① No | **Topic Shift** | Object changed. Not Evolution. |
| ② No | **State Change / Noise** | Same object, no center migration. May be a swing, a rephrase, or noise. |
| ③ No | **Statistical Signal** | A representation-level shift with no drill-down to specific expressions. Observation only, never meaning. |
| ④ No | **AI Interpretation Candidate** | All structural conditions met, but user does not recognize it. Stays an AI interpretation, never promoted to Evolution. |

The fourth category is the most important: **even when ①–③ hold, absence of user recognition forbids calling it Evolution.**

---

## 3. Representation vs. Cognition Boundary (must be stated)

```
Mirror observes a representation-level structural shift.   ← allowed
Mirror observes the user's cognitive structure changed.    ← NOT allowed without evidence chain
```

The gap between the two lines is exactly the evidence chain of Gate ③ + the recognition of Gate ④. Nothing in Mirror may collapse that gap.

---

## 4. Hard Prohibitions (reverse-derivation forbidden)

This reference must **not** be used to justify any of the following. If a future need appears, it requires its own design cycle / ADR, not inference from this file:

- ❌ Adding schema fields for `topic`, `center-of-gravity`, or distribution state to `EvolutionTrace`.
- ❌ Building aggregation / distribution-delta projection that auto-generates Evolution candidates from `Lx %` shifts.
- ❌ Any automatic proposal mechanism triggered by statistical signal.
- ❌ Treating a computed Thought Space distribution as the user's cognitive structure.
- ❌ Promoting any candidate past Gate ④ without explicit user recognition.

This file protects what is already converged. It does not authorize building more.

---

## 5. Relationship to Current Implementation

The current minimal closed-loop (design-freeze v0.1) implements propose → user confirm/reject as a paired `from_thought_id → to_thought_id` Trace. That is one valid *carrier* of an Evolution Case once the four gates are passed. But passing the gates is a prerequisite, not a consequence, of using that carrier.

A representation-level distribution shift (e.g. L1 24% → 0% spreading to L2/L7/L8/L11) is, by this reference, at most a **Statistical Signal** (fails ③ until drilled down, and unconfirmed at ④). It must NOT be auto-promoted.

---

## 6. Evidence Chain (internal) ≠ Interaction Chain (external)

The strict four-gate chain must NOT be confused with the user-facing interaction. They are two different layers and must be kept separate.

### Research layer — may be very fine-grained
When analyzing a Case post-hoc, we still retain the full breakdown:
```
Discovery → Object Continuity → Structural Change → User Recognition
```
This is what lets us know *how* an Evolution was established, and *where* a misjudgment could have entered.

### Product layer — must be compressed into ONE light claim
A real conversation must NOT make the user walk the gates:
> "Is this the same object?" → "Did its center shift?" → "Do you recognize this change?"
That is making the user work for the system. Instead:
> **Two raw stretches + one very restrained visible connection → one light claim.**

Example phrasing:
> *"Both these stretches show the expression '…'. Do you feel this is the same thing you've been thinking about, and that your thinking later changed?"*

The user may:
- **Yes** → becomes the user-confirmed Evolution candidate
- **No** → discarded
- **No feeling / skip** → nothing is produced

Most important: **do not ask why.** No follow-up probing.

### The real optimization target
The function to optimize is NOT "fewer claims":
> claim_count → min   ✗

It is:
> **perceived_user_value ÷ claim_friction**   ✓

Consequences:
- A low-quality candidate → even one claim is too many.
- A high-quality candidate → one claim may be the moment of being "seen".

Therefore the core UX of Thought Evolution is NOT "reduce confirmation" — it is **raise the quality of candidates that reach the user's claim surface.** This is exactly why Discovery must stay restrained (§1): if AI names "this is the same question" at candidate stage, it has already spent the one precious claim opportunity.

### Two chains, not in conflict
- **Evidence Chain is internal.** It can be strict: `AI discovery → raw-word evidence → object continuity → structural change → user claim`.
- **Interaction Chain is external.** It should be only: `candidate → one light claim → holds / dropped`.

The two do not contradict. They are what make Thought Evolution a **low-intrusion, high-value feedback** rather than a workflow that keeps asking the user to confirm AI's judgments.

### Governing principle (keep this)
> **Verification may be strict; interaction must be light. The system needs to prove internally; the user need not participate in the proof.**

---

## 7. Next Step — Observation Protocol

No code. No schema change. No model change. No new projection.

The remaining action is empirical: observe real Mirror usage and wait for a phenomenon that naturally satisfies all four gates.

When the next real candidate appears, **do NOT first watch whether the AI's final statement is accurate.** Watch the very first action:

> **Can the AI find a valuable, explainable neighboring relation — without attaching a semantic conclusion?**

Then place the two raw stretches and that neighboring feature, and stop. If you naturally produce:
> "yes, this has actually been the same question all along."
→ Discovery → Recognition (gate ①) holds.

If you do NOT get that feeling — even if the AI's neighboring feature is statistically beautiful — judge it:
> **Candidate failed.**

This is a strong product standard, because it requires Mirror to **discover continuity, not induce continuity.**

If and when a Case passes all four gates, it becomes the first genuine Thought Evolution evidence chain — and only then may a Case Log entry be written.

### What to observe next time (one thing only)
When the next real candidate appears, watch exactly one thing:
> **Is it good enough that one light claim happens naturally?**

Not "did the AI get the conclusion right" — that is the internal Evidence Chain's job. The external signal is whether the candidate, presented as two raw stretches + one restrained connection, makes a single yes/no/skip feel obvious rather than burdensome.
