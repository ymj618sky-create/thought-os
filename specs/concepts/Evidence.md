# Concept: Evidence

**所属层**: `specs/concepts/`
**关联 Schema**: `specs/schemas/Evidence.schema.json`
**关联 Constitution 条款**: Article 7-9（证据原则）

---


> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

## Definition

用户的原始表达，未经任何改写、压缩或润色，原文存储。Evidence 是整个系统里唯一"不可再加工"的层——一旦写入，内容本身永久不变。

## Purpose

作为 Thought / Observation / Interpretation 的可追溯来源，保证系统里的每一个结论都能被用户或第三方审计回"最初到底是怎么说的"，落实 Article 9（保存来源，而不仅仅保存结论）。

## Fields

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 唯一标识 |
| `user_id` | string | 是 | 所属用户 |
| `raw_content` | string | 是 | 原文，逐字存储，写入后不可修改 |
| `content_hash` | string | 是 | `raw_content` 的哈希值，用于校验未被静默篡改，遵循 S-3.3 |
| `source_type` | enum | 是 | `chat_message` / `voice_transcript` / `uploaded_text` / `uploaded_file` |
| `captured_at` | timestamp | 是 | 原始内容产生的时间，不是写入数据库的时间（两者可能不同，如语音转写有延迟） |
| `created_at` | timestamp | 是 | 写入数据库时间 |

**明确不包含的字段**：不存在任何"摘要""标签""分类"字段——这些都属于 Observation，Evidence 本身只负责如实存储。

## Examples

**示例 1**
> raw_content: "我最近老是在想要不要换工作，但每次想到要跟我爸妈解释，就觉得特别累。"
> source_type: chat_message

**示例 2（语音转写）**
> raw_content: "呃…就是…我觉得吧，其实我一直都知道自己想做什么，只是不敢说。"
> source_type: voice_transcript
> captured_at: 早于 created_at（转写处理耗时）

## Relationships

- **← 被引用**：Thought / Observation / Interpretation 均通过 `evidence_ids` 反向引用 Evidence，Evidence 本身不持有指向它们的正向字段（避免一条 Evidence 被多处引用时需要不断更新自身，保持 Evidence 层的稳定不变）。

## Non Examples

以下**不是** Evidence，不应写入 Evidence 表：

- AI 对用户发言的总结或改写 —— 这是 `Observation`，即便看起来"忠实",只要经过语言重组就不再是原文。
- 系统自动生成的元数据（如"用户在深夜发送此消息"）—— 这是系统日志，不是用户表达，若要保留，应作为独立的行为日志，不得混入 Evidence 表。
- 用户上传文件后，AI 提取的关键段落 —— 若是逐字提取且标明出处，可以作为 Evidence；若经过任何压缩或改写，则只能是 Observation。

---

*本文档遵循 Specification S-3.1（Thought 必须有 Evidence 链接）与 S-3.3（禁止静默改写 Evidence）。*
