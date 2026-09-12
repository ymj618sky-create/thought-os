# Continuity Invitation Layer v0.1 (Design Decision)

> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。

**Status**: ACCEPTED DESIGN (capability model accepted; conclusions frozen by `adr/0021` + `adr/0022`. Design decision only — NOT implementation; NOT a Constitution-level change)
**Date**: 2026-08-06
**Phase**: Continuity Layer extension (follows Phase 4 v0.1 CLOSURE + Phase 4★ Experience Reachability CLOSURE)
**Input constraint**: `specs/architecture/Continuity_Resolution_Layer_v0.1.md` (ACCEPTED DESIGN) + code-fact verification of `ReflectionCapability.buildReflection()` / `ReflectionPayload` / `Reflection` schema / `ContinueContext`.
**Governing**: `adr/0021` + `adr/0022` (Representation + Authority COMPLETE) + Stage 1 Private Alpha Deployment Plan.

**Accepted scope:**
- Design only
- No implementation started
- No Kernel / Schema / Runtime Boundary changes

> This document solves design questions only. No Kernel / Schema / Runtime Boundary change is implied. It adds one Projection Layer that consumes existing read-only material.

---

## 1. Purpose

Mirror today can **understand the user** and **preserve continuity**, but the system waits for the user to return:

```
理解用户 → 保存连续性 → 等待用户回来
```

This leaves a discontinuity: Mirror knows, but the user does not know Mirror knows. The Continuity Invitation Layer closes that gap by, at a suitable time, re-presenting an existing continuity thread as a single user-facing question:

```
理解用户 → 保存连续性 → 在合适时间把连续性照回来
```

It is **not** an AI that wants to chat. It is a previously-unfinished user-internal question resurfacing. The source of initiative is the user's own unresolved past, not the system's desire to speak.

---

## 2. Design Principles

1. **No new fact source.** `ReflectionPrompt` is a Projection of Projection (Reflection Event → ReflectionPayload → ReflectionPrompt). It never becomes a fourth source of truth (Constraint C: prevent Continuation Projection Drift).
2. **No cognitive authority.** The Invitation Layer does not decide meaning, does not rank, does not resolve. It only re-presents (Constraint A: Resolver holds no cognitive authority; this layer holds even less).
3. **No Agent / no new chat system / no Memory system.** It reuses `Conversation` + `ContinueContext` entry when the user responds.
4. **Frequency is policy, not timer.** 3–5 days is a product decision expressed as an evaluation policy, not a hard-coded `setInterval`.
5. **User controls visibility.** Every prompt is dismissible; dismissal is a persisted user preference, not a silent expiry.

---

## 3. Architectural Boundary

```
Reflection Event (= 用户认知事实, canonical source, unchanged)
        │
        ↓ buildReflection()  [READ-ONLY projection, unchanged]
        │
ReflectionPayload (= 认知事实解释投影, unchanged)
        │
        ├───────────────────────────────┐
        ↓                               ↓
ContinueContext                  Continuity Invitation Projection
(恢复入口: 用户回来后继续什么？)     (主动邀请: 用户回来前什么值得被看见？)
        │                               ↓
        │                        ReflectionPrompt (面向用户的交互投影)
        │                               │
        │               GET /api/reflection-prompts/pending
        │                               │
        └────────── shared source, NOT upstream/downstream ──┘
```

`ContinueContext` and `ReflectionPrompt` share `ReflectionPayload` as source but are **siblings, not a pipeline**. ContinueContext answers "what to continue when the user returns"; ReflectionPrompt answers "what is worth resurfacing before the user returns".

**Protected invariants (from frozen architecture):**
- Kernel: No Change
- Reflection Event model: No Change
- Resolver / ContinueContext: No Change
- Runtime Boundary: No Change (scheduler lives inside Runtime, not Host)
- Tauri Host: No Change

---

## 4. Input Contract (CODE-FACT VERIFIED)

Verified against `src/runtime/ReflectionCapability.ts`, `src/continuity/*`, `src/services/reflection.ts`, `src/schema/index.ts`.

### 4.1 Primary input: `ReflectionPayload` (from `buildReflection()`)

| Field | Type | Invitation use |
|-------|------|----------------|
| `theme` | `string \| null` | Main topic anchor |
| `tensions` | `ReflectionTension[]` | Unresolved conflicts (`from`/`to`/`status`) |
| `questions` | `ReflectionQuestion[]` | Unfinished questions (`id`/`content`/`status`) |
| `focus` | `ReflectionFocus[]` | Auxiliary context (lattice level + label + count) |

### 4.2 Supplementary input: `Reflection` entity

| Field | Invitation use |
|-------|----------------|
| `initial_question` | Original entry question (context) |
| `triggers` | Situational cues |
| `emotional_context` | Tone anchoring |
| `space_id` | Attribution (written into `sourceRef`) |
| `id` | `sourceReflectionEventId` (hard link, enables rebuild) |

### 4.3 Explicitly NOT used

- `ContinueContext.summary` (too thin — text only; would degrade to `text: string` prompt)
- `Reflection` schema `recurrence` / `stability` — **do not exist on Reflection**; they live on `ThoughtMaturitySnapshot` (Thought-level, out of scope for v0.1)
- `Reflection.status` field — **does not exist** in schema; "unfinished" is derived, never written back

---

## 5. ReflectionPrompt Model

A user-facing interaction projection. Persisted as Runtime state, not as cognitive fact.

```ts
interface ReflectionPrompt {
  id: UUID;
  userId: UUID;
  sourceReflectionEventId: UUID;   // hard link to Reflection Event (enables rebuild)
  sourceThemeSnapshot?: string;    // display snapshot ONLY — no semantic authority;
                                   // does NOT define the prompt's topic; rebuild uses sourceReflectionEventId

  question: string;                // structured-template generated, no free LLM
  context?: string;                // optional tension/question excerpt

  status:
    | 'pending'    // created, not yet shown
    | 'shown'      // delivered to UI
    | 'answered'   // user responded via /respond (closure signal, MUST persist)
    | 'dismissed'  // user permanently closed
    | 'expired';   // cooldown policy exceeded before shown/answered

  createdAt: Date;
  shownAt?: Date;
  answeredAt?: Date;
  expiresAt?: Date;                // pending + cooldown > now
}
```

**Five states retained (per design correction):** `answered` is NOT merged into `dismissed` — it is the core validation-metric signal (Prompt → user answered).

**Hard constraints:**
- Cannot modify Reflection
- Cannot create Thought
- Cannot update Knowledge
- Cannot participate in Identity Resolution
- Only re-presents existing continuity as a question

---

## 6. Unfinished Topic Derivation

Redefined away from the incorrect `recurrence + stability + unresolved` assumption.

```
unfinished =
  unanswered questions (ReflectionPayload.questions[].status !== 'answered')
  +
  unconfirmed tensions (ReflectionPayload.tensions[].status !== 'confirmed')
  +
  continuity relevance (existing reflection continuity signal:
    theme exists AND has open questions/tensions)

NOTE: recency / time-window is a Scheduler Policy concern, not a cognitive-judgment
input. v0.1 derives relevance from structure (open questions/tensions), never from
"created recently". A three-months-unresolved conflict may outrank a yesterday's
offhand question. Time gates only at evaluation-trigger stage (Section 8).
```

Selection priority (v0.1, deterministic, no ranking system):
1. Reflection with the most `open` questions + `open` tensions
2. Most recent `theme`
3. Not already having an active (pending/shown) prompt

Example input:
```json
{
  "theme": "职业选择",
  "questions": [{ "content": "我要不要离开现在的工作？", "status": "open" }],
  "tensions": [{ "from": "自由", "to": "稳定", "status": "open" }]
}
```
Generated prompt:
> 关于职业选择的问题，你之前一直停留在自由和稳定之间的拉扯。最近这个矛盾有没有发生变化？

This is structurally derived, not frequency-based ("this topic appears often → remind").

---

## 7. Invitation Generation Policy

First version: **structured template, no free LLM call.** Reuses `ReflectionPayload` fields directly.

```
Template:
  关于 {theme} 的问题，
  你之前一直停留在 {tension.from} 和 {tension.to} 之间的拉扯。
  最近这个矛盾有没有发生变化？

Fallback (no tension, only question):
  关于 {theme}，你之前问过："{question.content}"。
  最近这件事有没有新的感觉？
```

`context` field carries the raw tension/question excerpt for UI display. No new LLM adapter, no `createLLM` extension, no credential change.

---

## 8. Scheduler Policy

**Not** a hard-coded `setInterval(3 days)`. It is an **Invitation Evaluation Policy** triggered by Runtime heartbeat.

```
Runtime heartbeat (existing synthetic service pattern in app.ts)
        ↓
InvitationService.evaluate()
        ↓
derive candidates from existing ReflectionPayload
        ↓
create prompt (status: pending)
```

**Boundary (critical):** Scheduler does NOT decide cognitive relevance. It only
triggers evaluation. The candidate derivation reads existing ReflectionPayload
structure (open questions/tensions) — it never lets an AI decide "who needs
reflection". The chain is:

```
Heartbeat → InvitationService.evaluate() → derive candidates from ReflectionPayload → create prompt
```

NOT:

```
Heartbeat → AI decides who needs reflection
```

Product policy (configurable, not coded as constant):
- `enabled`: from `ReflectionPreference` (new user setting, stored in `THOUGHT_OS_DATA_DIR/config/`)
- `frequency`: `"3_days"` / `"5_days"` (policy value)
- `quietHours`: `["23:00","08:00"]` (no delivery inside)

This keeps Web / Desktop / Mobile convergent — none re-implements scheduling.

---

## 9. Persistence

New SQLite table `reflection_prompts` (Runtime persistence, User Interaction State — sibling of `pending_slots` / `stalled_prompts`).

```sql
CREATE TABLE reflection_prompts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_reflection_event_id TEXT NOT NULL,
  source_theme_snapshot TEXT,
  question TEXT NOT NULL,
  context TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  shown_at TEXT,
  answered_at TEXT,
  expires_at TEXT
);
```

`ReflectionPreference` stored as `config/reflection-preference.json` (same pattern as `llm-provider.json`, validated by ADR-0022 deployment contract). No schema migration on Thought / Reflection tables.

---

## 10. API Contract

```
GET  /api/reflection-prompts/pending
     → { id, question, context, sourceReflectionEventId }
     (returns current pending/shown prompt, or 204 if none)

POST /api/reflection-prompts/:id/dismiss
     → persists status = 'dismissed', updates ReflectionPreference if "never again"

POST /api/reflection-prompts/:id/respond
     → persists status = 'answered' (explicit closure; chat alone cannot infer)
     → returns ContinueContext seed for Conversation entry

POST /api/reflection-prompts/:id/snooze
     → does NOT change status (stays pending/shown); only updates expires_at
     → re-evaluated after cooldown; distinct from dismissed (dismissed = terminal)
```

"聊聊" button → enters normal `Conversation` with `ContinueContext` (existing channel, unchanged). "稍后" → `snooze` (expires_at pushed, status unchanged). "关闭" → `dismissed` (terminal).

---

## 11. UI Integration

Home page, beside existing Continue card:

```
小镜想继续问你一个问题

「关于职业选择的问题，你之前一直停留在自由和稳定之间的拉扯。
  最近这个矛盾有没有发生变化？」

[聊聊]  [稍后]  [关闭这类提醒]
```

Three outcomes:
- **聊聊** → Conversation + ContinueContext (existing)
- **稍后** → snooze (re-evaluate after cooldown)
- **关闭** → `reflectionEnabled = false` persisted

No notification center, no AI interruption pattern.

---

## 12. MVP Scope

**Include:**
- `reflection_prompts` persistence (5-state)
- `ReflectionPreference` config
- `InvitationService.evaluate()` on heartbeat
- Structured-template `PromptGenerator` (no LLM)
- 3 APIs (`/pending`, `/dismiss`, `/respond`)
- Home card UI (3 buttons)

**Exclude (explicit non-goals):**
- LLM free-form question generation
- Ranking / scoring of reflections
- Multi-prompt queue or daily digest
- Cross-device sync of prompt state
- `answered` → auto-thought creation

---

## 13. Non-goals

- Not a proactive chat Agent
- Not a daily reminder system
- Not a Memory / Knowledge layer
- Not a change to Reflection Event, Thought, or Resolver
- Does not touch ADR-0023 (Q2 Explanation Semantics) or ADR-0024 (Q3 Knowledge Lifecycle) — both remain DEFERRED, driven by Experience Observation

---

## 14. ADR Impact

| ADR | Impact |
|-----|--------|
| 0021 | No impact (continuity boundary preserved) |
| 0022 | No impact (Representation + Authority unchanged) |
| 0023 | Not triggered (no new explanation semantics) |
| 0024 | Not triggered (no Knowledge lifecycle change) |

**New Layer summary:**
```
Kernel:        No Change
Reflection:     No Change (read-only buildReflection)
Resolver:       No Change (ContinueContext unaffected)
New Layer:      Continuity Invitation Projection (src/continuity/invitation/)
Input Contract: ReflectionPayload (theme/tensions/questions) + Reflection.initial_question
```

This is the final segment of the Continuity architecture: understanding the user → preserving continuity → resurfacing continuity at a suitable time, without violating any frozen boundary.

---

## 15. Acceptance Criteria

The implementation is accepted **only if** all of the following hold:

1. **Regenerability**: A `ReflectionPrompt` can be fully regenerated from existing Reflection data (via `sourceReflectionEventId` → `buildReflection()`). No prompt-specific cognitive state is required to rebuild it.
2. **No new cognitive fact**: The Invitation Layer stores zero cognitive facts. It writes only user-interaction state (`reflection_prompts` table + `reflection-preference.json`). It never writes to Reflection / Thought / Knowledge.
3. **Dismissal honored**: A user `dismiss` (and `reflectionEnabled = false`) prevents future invitations according to `ReflectionPreference`. No prompt is created while disabled.
4. **Answered is measurable**: `answered` prompts are independently queryable (distinct from `dismissed` / `expired`), enabling the Stage 1 validation metric (Prompt → user answered).
5. **No LLM for generation**: Prompt text is produced by structured template over `ReflectionPayload` fields. No `createLLM` call, no adapter extension, no credential change.
6. **ContinueContext untouched**: Existing `/api/home` → `continue.reflection` behavior is unchanged. `ReflectionPrompt` and `ContinueContext` remain sibling projections.
7. **Scheduler has no cognitive authority**: `InvitationService.evaluate()` derives candidates from existing `ReflectionPayload` structure only. No AI decides relevance; time-gating is policy applied at trigger stage.
8. **Snooze is non-terminal**: `snooze` updates `expires_at` without changing `status`; it is distinguishable from `dismissed` at the API and storage layer.

---

## Freeze Note

```
Continuity Invitation Layer v0.1
Status:   ACCEPTED DESIGN
Boundary: New Projection Layer Only
Kernel:   No Change
Reflection: No Change
Resolver:  No Change
Runtime:  No Boundary Change
Implementation: Approved to enter src/continuity/invitation/
```

