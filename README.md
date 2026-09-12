# Thought OS — Open Specification & Reference Kernel

> [English](README.md) · [中文](README.zh-CN.md)

**Thought OS exists to augment human thinking, never replace it.**

Thought OS is a personal cognitive operating system. It is not a knowledge base,
not a chatbot, not a search engine, and not therapy. It is infrastructure for
helping a person discover, organize, connect, test, and evolve their own
thinking — continuously, over time.

This repository publishes the **Open Specification** and a **reference kernel**
(the Thought OS kernel). It does not publish the proprietary Mirror product.

## Why Thought OS exists

Everyone is capable of forming their own system of thought. The role of AI is not
to supply answers, but to help a person observe, structure, examine, and evolve
their thinking. Everything in Thought OS is built around one hard boundary
between *capability* and *authority*:

> **Capability is open. Cognition is not ownership.**
> **Characterization is not identity. Recommendation is not decision.**
> **Thought belongs to the human.**

AI may observe, explain, model, judge, critique, predict, and suggest. It may
not own, define, or decide for the user. The entire system — prompts, agents,
APIs, schemas, UI, and business model — is measured against this boundary.

## What Thought OS models

Thought OS does not store "notes". It models thinking as distinct, traceable
objects with explicit relationships:

| Concept          | What it is                                                          |
| ---------------- | ------------------------------------------------------------------- |
| **Evidence**     | The user's raw expression. Immutable; hashed; never overwritten.    |
| **Observation**  | An objective description of evidence (verifiable as true or false). |
| **Interpretation** | An inference about the user; must carry a 0–1 confidence + rationale. |
| **Thought**      | A thought the user has confirmed as their own. Requires ≥ 1 evidence. |
| **Question**     | A first-class question; may exist with no answer.                   |
| **Relation**     | A typed link between objects (supports / contradicts / refines / …), with its own lifecycle. |

Two invariants matter most: **Evidence is immutable**, and **contradictory
thoughts may coexist** — the system never silently merges a tension away.

## How it stays honest

The authority chain is strict and one-directional:

```
Constitution → Specification → Concept/Schema → Protocol → ADR → Prompt → Implementation
```

If a prompt conflicts with the specification, the prompt is a bug. If code
conflicts with the specification, the code is a bug. The `specs/conformance/`
suite encodes the core invariants as executable tests (candidate ≠ thought,
proposal ≠ mutation, human authority, provenance, thought ownership).
**C-005 / C-006 / C-007 are intentionally red** — they mark real,
deliberately-visible gaps in how thought ownership is enforced at the storage
layer, not passing behavior.

## What is in this repository (open)

| Path            | Content                                                | License     |
| --------------- | ------------------------------------------------------ | ----------- |
| `constitution/` | Constitution & Mission (highest authority layer)       | CC BY 4.0   |
| `specs/`        | concepts, schemas, protocols, architecture, evaluation | CC BY 4.0   |
| `adr/`          | published Architecture Decision Records (curated)      | CC BY 4.0   |
| `kernel/`       | reference implementation (the Thought OS kernel)       | MIT         |

The conformance suite above lives in `specs/conformance/`; there is no top-level
`tests/` directory in the published tree (mirror-coupled tests are excluded by
the release gate).

## What is NOT released (proprietary)

The Mirror product (`mirror/`), agent prompts (`agents/`), reference product
(`reference/`), mobile/desktop apps (`apps/`), website (`site/`), and any SaaS /
billing layers remain private and are not part of this repository.

## Where to start

1. `constitution/Constitution.md` and `Mission.md` — what Thought OS believes.
2. `specs/specifications/v0.1.md` — the behavioral rules (testable `S-x.x`).
3. `specs/concepts/` — the data model behind the table above.
4. `adr/` — the architecture decisions and why they were made.
5. `kernel/` — the reference implementation.

## License

- Documentation & Specifications → **Creative Commons Attribution 4.0** — see
  `LICENSE-DOCS`. You may read, implement, reference, and extend them, and build
  your own Thought OS-compatible or derivative systems, provided you attribute
  Thought OS and do not imply endorsement.
- Software Code → **MIT License** — see `LICENSE-CODE`.

Open Specification, not Open Source Engineering: the value is in the reusable
specification assets, not in forking the product.

Copyright © 2026 Mingjie Ye.
