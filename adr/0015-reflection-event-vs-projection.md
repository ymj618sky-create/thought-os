# ADR-0015: 区分 Reflection Event 与 Reflection Projection

> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: Accepted
**Date**: 2026-08-02
**领域**: 认知实体语义 / 展示聚合层
**关联文档**: `specs/concepts/Reflection.md`（规范实体）、`src/storage/SqliteStorage.ts`（`reflection` 实体表，8 个受 ajv 校验的 `TABLES` 之一）、`src/models/SpaceStore.ts`（`reflections` 聚合表，UI 反思流）、`specs/specifications/v0.1.md`（Schema 即权威原则）、Runtime v0.1 设计审查结论

## Context

在 Runtime v0.1 设计审查中，发现代码库中存在两个都被称作 "reflection" 的结构，但语义层次不同：

**规范层 —— Reflection Event（认知实体）**
```
reflection
{
  id,
  initial_question,
  generated_thought_ids,   // 本次反思事件产生的 Thought 列表（事件溯源）
  created_at
}
```
含义：一次认知反思**事件**。它是规范实体，位于 `SqliteStorage` 的 `TABLES`（受 ajv 校验、进同步信封、具 Schema 权威地位），对应 `specs/concepts/Reflection.md`。

**Runtime 聚合层 —— Reflection Projection（UI 反思流）**
```
reflections (表, SpaceStore)
{
  summary,            // 给用户/空间展示的反思摘要
  session_id,
  interpretation_id
}
```
含义：空间/对话展示所需的反思**流**。它落在聚合表，不经 ajv 校验管线，不进同步信封，本质是给 UI 消费的轻量记录。

两者当前都叫 "reflection"。短期无功能冲突——聚合表只被展示逻辑读取，规范实体只被反思流程写入。但长期存在明确的领域语义风险：

- 同步时不知道哪个是真相源；
- API 命名容易混乱（同名异义）；
- Agent / Memory 系统可能误将 projection 当作事实源；
- 未来若有人把 `reflections.summary` 当作 `reflection` 事件回灌，会污染认知溯源链。

这一歧义在冻结前消除成本最低，且属于"非显然架构权衡"，符合 ADR 收录标准。

## Decision

**Reflection Entity（`reflection`）是认知反思的 canonical source。** 它是规范定义的一次反思事件，具有事件溯源语义（`generated_thought_ids`）。

**任何 summary / feed / UI-oriented 的反思记录都是 derived projection，不得被当作 source data。** 具体约束：

1. 来源唯一性：`reflection` 规范实体是反思真相的唯一权威；`reflections` 聚合表（及未来任何同义结构）只能作为它的**投影缓存**存在。
2. 写入方向单向：projection 只可由 `reflection` 事件衍生生成，反向（projection → entity）写入被禁止。
3. 命名纪律：对外 API / 文档中，规范实体称 `reflection`；聚合展示记录称 `reflection projection` / `reflection feed` / `reflection summary`（概念上冻结，不强制立即改表名）。
4. 评估纪律：Memory / Agent 读取反思时，必须消费 `reflection` 实体，不得消费 `reflections` 聚合表作为事实依据。

```
reflection (Entity, canonical)
        │
        │ derived view
        ▼
reflection projection (feed/summary, derived)
        │
        │ render
        ▼
UI
```

**本 ADR 只冻结概念语义，不要求立即改表名或改代码。** 聚合表 `reflections` 可保留原名，但其语义定位自本 ADR 起被锁定为 projection。

## 备选方案（被否决的）

- **立即将 `reflections` 表改名为 `reflection_projection`**：能消除命名歧义，但属于非必要代码改动，且当前无功能冲突。在 v0.1.0-web-runtime 冻结前引入重命名会增加 churn，故推迟至有实际同步/API 冲突时再做。
- **将 `reflections` 聚合表直接删除，UI 改为实时查询 `reflection` 实体**：聚合表提供空间维度的轻量摘要流，实时查询规范实体会增加展示层负担且混入展示关注点，违背聚合层职责，否决。
- **把 `reflections` 提升为第二个 canonical 源（双写）**：直接制造两个真相源，违背 Schema 即权威与单一真相原则，否决。

## Consequences

- **正面**：未来同步、API、Agent/Memory 读取反思时有明确真相源，不会重新讨论该语义；与 ADR 中"Schema 即权威 / 单一真相"原则一致。
- **正面**：Tauri Runtime 阶段若引入跨设备同步，可直接套用"实体为源、投影可重建"的模型。
- **负面（可接受）**：代码中存在同名异义结构直至下次主动清理；需靠本 ADR + 代码注释维持纪律。
- **纪律要求**：任何新增消费 `reflections` 表的代码，注释须声明其为 `reflection` 事件的投影缓存，不得宣称其规范地位。
