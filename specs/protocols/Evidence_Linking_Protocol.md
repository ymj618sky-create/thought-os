# Protocol: Evidence Linking

**所属层**: `specs/protocols/`
**调用方**: `Thought_Extraction_Protocol`、`Confirmation_Protocol`，以及任何创建 Observation / Interpretation / Thought / Question 的路径

---


> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

## 流程

```
Input: 一个候选内容（Observation/Interpretation 草稿，或用户直接创作的 Thought/Question）
       + 声称依据的原始文本片段（可能显式指定，也可能需要系统定位）
  ↓
Step 1 — Locate Evidence
  在 Evidence 表中查找对应记录；若候选来自尚未被存储为 Evidence 的文本，
  先按 Evidence.schema.json 创建 Evidence 记录（原文、hash、来源类型），再继续
  ↓
Step 2 — Integrity Check
  重新计算目标 Evidence 的 raw_content 哈希，与存储的 content_hash 比对
  不一致 → 视为完整性异常，中止流程并报警，不得静默继续（遵循 S-3.3）
  ↓
Step 3 — Attach evidence_ids
  将确认无误的 evidence_id（可多个）写入候选的 evidence_ids 字段
  ↓
Step 4 — Minimum Requirement Check（按节点类型分流）
  Thought        → evidence_ids 长度必须 ≥ 1，否则拒绝创建
  Observation    → evidence_ids 长度必须 ≥ 1，否则拒绝创建
  Interpretation → evidence_ids 与 observation_ids 至少一项非空，否则拒绝创建
  Question       → 仅当 origin_type=ai_suggested 时要求 ≥ 1；user_authored 时可为空，直接放行
  ↓
Output: 携带合法 evidence_ids 的候选记录，或一个明确的拒绝错误（附带具体原因）
```

## 关键约束

- **禁止占位符**：任何环节都不允许用空字符串、虚构 id 或"待补充"之类的占位值满足"必填"校验——这类做法表面通过检查，实质上破坏了 S-3.1 的核心意图（可追溯）。校验失败就应该是明确的失败，而不是被静默绕过。
- **多对多是常态**：一条 Evidence 可以被多条 Thought/Observation/Interpretation 引用，这是正常设计，不是异常，本协议不对"重复引用"做去重限制。
- **反向不适用**：本协议只负责"候选→Evidence"的正向关联校验，不处理 Evidence 被删除时的级联行为——那属于 `(private policy)` 的范围。

---

*本文档遵循 Specification S-3.1（Thought 必须有 Evidence 链接）与 S-3.3（禁止静默改写/破坏 Evidence 完整性）。*
