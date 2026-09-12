# ADR-0005: Relation 表为权威源，反向索引字段仅为缓存；challenges 不入反向索引



> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: Accepted
**Date**: 2026-07-27
**领域**: 数据一致性 / 缓存策略
**关联文档**: `specs/concepts/Relation.md`（「缓存一致性策略」一节）、`specs/schemas/Thought.schema.json`

## Context

`Thought` / `Question` 节点上带有 `related_thought_ids` 等反向索引字段，方便列表页快速展示"这条节点大致关联了哪些节点"。但 Relation 是独立于两端节点存在、拥有自身生命周期的实体。若反向索引与 Relation 表不同步，图谱展示会出现"看得到的"与"真实存在的"关系不一致。

此外，ADR-0002 决定 `challenges` 的 `from` 是 `Interpretation`，而 Interpretation 概念本身没有定义任何反向索引字段。

## Decision

1. **写入路径**：任何创建/更新 Relation 的操作，必须在同一事务内同步更新其两端节点的反向索引字段，不允许分离提交。
2. **读取路径**：任何涉及矛盾检测、关系计数、演化图谱渲染等**判断类**逻辑，必须直接查询 Relation 表，不得依赖节点上的反向索引缓存做判断依据；反向索引仅供列表页低风险快速展示。
3. **失效兜底**：若检测到反向索引与 Relation 表不一致，以 Relation 表为准，并异步重建该节点反向索引，不阻塞当前请求。
4. **challenges 例外**：`challenges` 关系起点是 Interpretation，无反向索引字段，且 `related_thought_ids` 语义不适合塞异构来源边，故**不进入反向索引缓存**。某 Thought 正被某 Interpretation 挑战，只能经 `to_id=该Thought AND relation_type=challenges` 直查 Relation 表获得。

## 备选方案（被否决的）

- **为 challenges 加 `challenged_by_interpretation_ids` 字段**：经 Article 0 检验，这只是"列表展示更方便"，不是"某种思想现象无法被描述"——缓存缺失时真实数据仍完整存在于 Relation 表。加字段会增加写入复杂度和不一致面，收益不足。否决，留作未来若列表性能成为瓶颈时再评估。

## Consequences

- **正向**：判断类逻辑正确性不依赖缓存，规避缓存陈旧导致的错误演化判断。
- **正向**：challenges 不污染 Thought 的反向索引语义，保持字段含义单一。
- **负向/后续**：任何想在 Thought 详情页展示"当前几条未决张力"的列表型 UI，必须专门发起一次 Relation 查询，不能走缓存字段——这是已知覆盖缺口，非遗漏。
