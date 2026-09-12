# Thought OS — Open Specification & Reference Kernel

Thought OS is a specification-driven personal cognitive operating system. This
repository publishes the **Open Specification** and a **reference kernel** — not
the proprietary Mirror product.

## What is released (open)

| Path            | Content                                              | License        |
| --------------- | ---------------------------------------------------- | -------------- |
| `constitution/` | Constitution & Mission (highest authority layer)    | CC BY 4.0      |
| `specs/`        | concepts, schemas, protocols, architecture, evaluation | CC BY 4.0    |
| `adr/`          | published Architecture Decision Records (curated)    | CC BY 4.0      |
| `kernel/`       | reference implementation (the Thought OS kernel)    | MIT            |
| `tests/`        | OSS self-validation (Mirror-independent)             | MIT            |

## What is NOT released (proprietary)

The Mirror product code (`mirror/`), agent prompts (`agents/`), reference product
(`reference/`), mobile/desktop apps (`apps/`), website (`site/`), and any SaaS /
billing layers remain private and are not part of this repository.

## License

- Documentation & Specifications → **Creative Commons Attribution 4.0** — see
  `LICENSE-DOCS`. You may read, implement, reference, and extend them, and build
  your own Thought OS-compatible or derivative systems, provided you attribute
  Thought OS and do not imply endorsement.
- Software Code → **MIT License** — see `LICENSE-CODE`.

Open Specification, not Open Source Engineering: the value is in the reusable
specification assets, not in forking the product.

Copyright © 2026 Mingjie Ye (叶明杰).
