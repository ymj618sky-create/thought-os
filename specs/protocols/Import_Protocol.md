# Protocol: Import

**所属层**: `specs/protocols/`
**状态**: 仅定义协议（Phase 1 不实现）；实现留待后续 Phase
**范围**: 把用户已有的外部数据（Day One 日记、Roam / Obsidian 图谱、Apple Notes 等）迁入 Thought OS，成为可追溯的 Evidence，并接入既有提取流水线。**绝不**在导入时直接生成 Thought。

---


> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

## Article 0 检验

删掉 Import 会失去什么？——已有思想积累的用户面临巨大迁移成本，只能"从零开始"，实质剥夺了他们把既有思想纳入主权管理的能力（Article 4）。Import **不是新思想现象**，而是让既有思想资产进入 Thought OS 主权范围的入口，属工程协议层。

## 核心规则

1. **导入产物只有 Evidence**：所有外部内容先被规整为 `Evidence` 记录（`raw_content` 原文、`content_hash`、`source_type=uploaded_file`/`uploaded_text`、`captured_at` 取源时间戳）。
2. **绝不自动标为 Thought**：导入内容未经用户确认，不得成为 `Thought`（Article 5：AI 不可宣布；S-2.2：禁止单方面定案）。**导入 ≠ 确认**。
3. **导入后走标准流水线**：新 Evidence → `ExtractionService` 重新扫描 → Observation / Interpretation → `Confirmation_Protocol` 由用户决定是否固化为 Thought。导入只是"把原料放到流水线起点"，之后每一步与日常对话产生的 Evidence 完全一致，不为导入单开旁路。
4. **可追溯**：每条导入 Evidence 的 `captured_at` 保留源时间；来源系统信息以"导入批次元数据"标注，**不污染** Evidence 的不可变原文。

## 标准导入格式（Import Envelope）

定义一个中立 JSON 信封；各来源适配器先把外部格式映射为信封，再由导入器统一转 Evidence：

```json
{
  "source": "dayone | obsidian | roam | apple_notes | ...",
  "exported_at": "<iso8601>",
  "items": [
    { "raw_content": "...", "captured_at": "<iso8601>", "source_ref": "<原文在源系统中的定位，可选>" }
  ]
}
```

- 适配器（Day One JSON 导出 / Obsidian·Roam Markdown / Apple Notes 导出）**只负责"外部格式 → 信封"**，不做任何内容理解或归类。
- 去重按 `content_hash`（与 `Evidence_Linking_Protocol` 一致），重复导入不产生重复 Evidence。

## 明确排除

- 不解析 / 不理解内容：不打标签、不归类、不直接建 Thought / Question / Relation。
- 不做"导入即拥有"的自动确认。
- 不处理外部系统的私有链接语义（如 Roam 的 `[[link]]`）：仅作为原文文本进入 Evidence，结构关系由后续 Extractor / 用户重建，导入时不猜测。

---

*本文档遵循 Article 4（思想属于用户）、Article 5/6（不可宣布、用户确认）、Article 7（无 Evidence 不成 Thought）、S-2.2（AI 不得单方面定案）。*
