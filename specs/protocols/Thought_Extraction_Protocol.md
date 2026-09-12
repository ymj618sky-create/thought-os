# Protocol: Thought Extraction

**所属层**: `specs/protocols/`
**执行者**: `(private agent capability)`
**范围声明**: 本协议止步于 Observation / Interpretation 草稿，**不包含 Thought 的生成**——Thought 的产生属于 `Confirmation_Protocol.md` 的范围，两者是两个独立的协议，不得合并成一步。

---


> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

## 流程

```
Input: Conversation（一段或多段 Evidence）
  ↓
Step 1 — Candidate Scan
  Extractor 扫描 Conversation，识别潜在的模式或值得注意的表达
  ↓
Step 2 — Classification
  每个候选被归类为：
    (a) 客观可核验 → Observation 候选
    (b) 需要推断才能表达 → Interpretation 候选
  不确定时，强制归为 (b)（保守原则，见 Extractor Capability 的失败行为）
  ↓
Step 3 — Evidence Linking
  每个候选必须调用 Evidence_Linking_Protocol，取得合法的 evidence_ids
  无法关联到具体 Evidence 的候选 → 直接丢弃，不进入下一步
  ↓
Step 4a（Observation 分支）           Step 4b（Interpretation 分支）
  写入 status=active                    计算 confidence + confidence_rationale
  无需置信度                            缺失置信度 → 丢弃该候选，不得用默认值代替
                                         写入 status=pending
  ↓                                     ↓
Output: Observation 草稿数组 + Interpretation 草稿数组（呈现给用户，等待 Confirmation_Protocol 处理）
```

## 终止条件

- 若 Step 1 未发现任何候选，整个流程在此终止，返回空数组，**不得为了产出而降低筛选标准**。
- 若某次运行的候选与已有的 `existing_context`（用户此前已见过的候选）高度重复，应跳过重复项，不重复打扰用户。

## 明确排除的步骤

- **不生成 Question**：即便某个候选更适合表达为一个问题而非观察/解释，本协议也不负责这一步，需转交未来的 `Question_Generation_Protocol`（Phase 2 定义）。
- **不判断 Relation**：本协议只处理"新证据里发现了什么"，不处理"这个新发现和用户已有的哪条 Thought 有关系"。
- **不生成 Thought**：见文档开头范围声明。

---

*本文档遵循 Specification S-3.2（三层输出必须可区分）。*
