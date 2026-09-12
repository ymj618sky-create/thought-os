# ADR-0014: 张力地图采用只读展示服务聚合 challenges + contradicts，不做写入



> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: Accepted
**Date**: 2026-07-30
**领域**: 展示层 / 张力可视化
**关联文档**: `src/services/tensionMap.ts`（实现）、`src/cache/tensionQuery.ts`（互补的低层查询）、`adr/0001-tension-as-relation-challenges.md`（张力建模决策）、`adr/0002-tension-endpoint-is-interpretation.md`（窄例外端点）、`adr/0004-conflict-detection-as-independent-protocol.md`（冲突检测独立）、`adr/0005-relation-table-authoritative-reverse-index-cache.md`（查询路径）、`specs/concepts/Relation.md`（张力生命周期）、Constitution Article 6（用户最终决定权）、Article 12（帮助用户看到张力）

## Context

张力（未化解的认知冲突）是整个 Relation 层最精密的设计——6 条 ADR 中有 4 条与之相关（ADR-0001/0002/0004/0005）。它的生命周期跨多种状态流转：

```
Extractor 产出 Interpretation
  → ConflictDetection 发现与某 Thought 冲突 → 创建 challenges(pending)
  → 用户确认并存为 Thought → challenges 被 superseded，新建 contradicts(confirmed)
  → 用户确认但不存 → challenges(confirmed) 保留为一等信号
  → 用户驳回 → challenges(rejected)
```

这过程中产生了多种 Relation 类型和状态。当用户打开"张力"面板时，需要的是一个**统一视图**——不是"去看 challenges 表再看 contradicts 表"，而是"这是我思想中的张力全貌"。

同时，`tensionQuery.ts`（ADR-0005 的低层查询）已经提供了"某 Thought 被哪些 challenges 挑战"的原始查询——但这是供 ConflictDetectionService 等后端逻辑消费的，不适合直接渲染给前端。需要决定：张力展示是一个新的 Service，还是复用 tensionQuery 的返回值再在前端组装。

## Decision

### 1. 只读展示服务，零写入

`TensionMapService` **不做任何写入操作**。它只读 Relation 表，把 challenges 和 contradicts 聚合成统一的张力视图。张力的创建（ConflictDetectionService）和状态变更（ConfirmationService）发生在别处。

这是对 ADR-0004 的尊重——冲突检测是一个独立协议，TensionMap 是它的"报告层"，不应掺入创建/修改逻辑。

### 2. 统一 challenges + contradicts 为一个列表

```typescript
list(userId):
  challenges(pending/confirmed)  ← 未化解的挑战
  + contradicts(confirmed)        ← 已确认的矛盾（成对的 Thought）
  → 按 created_at 排序，统一呈现
```

**为什么同时包含 challenges 和 contradicts**：
- `challenges(pending)` = 刚检测到、用户还没确认。用户需要在面板看到"有一条新张力待处理"
- `challenges(confirmed)` = 用户确认了矛盾存在但没存成 Thought——这个信号必须持久展示（ADR-0001：`challenges+status=confirmed` 是一等信号，不得被清理误删）
- `contradicts(confirmed)` = 两条 Thought 已经被确认为矛盾。这是"已确立的张力"——用户已经看到并承认这对矛盾

**为什么 contradicts 只取 confirmed**：`contradicts(pending)` 不存在——contradicts 是确认阶段才创建的，不会以 pending 状态出现。`contradicts(rejected)` 是用户明确否定的矛盾，不展示。

### 3. TensionMap vs tensionQuery 的分工

| | `tensionQuery.ts` | `TensionMapService` |
|---|---|---|
| 定位 | 低层查询（ADR-0005） | 展示聚合 |
| 输出 | 原始 Relation + interpretationId | 结构化 TensionViewEntry（含端点标题、历史、置信度） |
| 消费者 | ConflictDetectionService、ConfirmationService | 前端 `/api/tensions` |
| 查了什么 | challenges only | challenges + contradicts |
| 历史重建 | 无 | 有（buildHistory） |

**tensionQuery 是权威查询路径**（直查 Relation 表，不走反向索引缓存——ADR-0005）。**TensionMap 是展示增强层**——在 tensionQuery 的结果上附加了端点实体名称、演变历史和 resume 能力。两者不冲突：后端逻辑（冲突检测、确认服务）走 tensionQuery；前端展示走 TensionMap。

### 4. 端点（Endpoint）的演变历史：沿 superseded_by 反向回溯

当一条 Thought 经历了多次 supersede（被新的更准确的思想取代），它的张力也随着演变。`buildHistory()` 沿 `superseded_by` 链反向回溯，重建"旧版本 → 新版本"的演变轨迹：

```
Thought v1（"我认为稳定最重要"）
  → superseded_by = v2
Thought v2（"我其实更看重自由"）  ←─ 当前 active
```

张力面板展示的是最新的内容，但用户可以展开看到"这个想法之前是怎么说的"——这就是 Article 12 的"看到思想如何演化"。

**技术实现**：`buildHistory` 做一次全量查询（`repos.thought.query({user_id})`），建立 `predecessorOf` 映射表（`superseded_by → 前驱 thought id`），然后沿链逆向回溯。O(n) 全量扫描——Phase 1 几十条 thought 中可以接受。Phase 2 可以优化为 SELECT ... WHERE superseded_by = ? 的逐级查询。

**为什么是"旧→新"（reverse）而非"新→旧"（forward）**：superseded_by 是指针——旧 thought 的 `superseded_by` 指向新 thought。要找到"旧的"，需要从指针的目标反过来找来源。这就是 `predecessorOf` 映射表的作用。

### 5. "回到对话"（resumeFromTension）

用户看到面板里一条张力（"自由 vs 稳定"），想知道"当时 AI 是怎么发现这条张力的"。`resumeFromTension` 提供了**回到张力诞生时刻**的载荷：

1. 找到张力的来源 Interpretation（`from.type === 'interpretation'` → 直接取；否则查 `origin_interpretation_id`）
2. 用该 Interpretation 的 evidence_ids 重建对话片段（最近 4 条 Evidence 原文 + 2 条 Observation）
3. 生成自然语言开场白："你之前在想「自由」和「稳定」之间的张力——这两件事你现在怎么看？"
4. 前端接收后跳转到 `/chat` 并预填开场白

**这不是"AI 给你分析矛盾"**——是"帮你回忆起这个矛盾是什么时候出现的、当时说了什么"。AI 不负责解决张力——它只负责帮用户回到起点重新审视。

### 6. 防御：已删除实体不崩溃

```typescript
function emptyEndpoint(type, id): TensionEndpoint {
  return { type, id, title: '（已删除）', history: [] };
}
```

如果一条 Relation 的端点（Interpretation / Thought）已被删除——`get()` 返回 null，`buildEndpoint` 返回一个占位端点而不是抛错。这在物理删除（用户显式请求删除一个实体）后仍然能展示"这条张力曾经存在过"。

## 备选方案（被否决的）

### A. 前端直接调 tensionQuery + 自己组装端点信息

把 `tensionQuery.getTensionsForThought` 暴露给前端，前端逐条查实体名称、拼接展示。**否决理由**：

- 前端要多发 N+1 个请求（张力列表 N 条 → 每条查两个端点的实体名称）
- "演变历史"的重建逻辑在前端无法做（需要全量 thought 的 superseded_by 图——前端没有）
- TensionMap 把"查什么、怎么拼、防御什么"封装为一个 Service，降低前端的认知负担

### B. challenges 和 contradicts 分开展示（两个面板）

**否决理由**：

- 用户的认知模型是"张力是什么"，不是"数据库里这是什么 Relation 类型"
- "未化解的挑战"和"已确认的矛盾"是时间线的前后阶段，但在展示上是一张图（conceptually one thing: tension）
- 两个面板会导致"这条张力在哪？"的迷失

### C. TensionMap 做写入——"resume 后自动创建新对话记录"

在 `resumeFromTension` 同时创建一个"对话继续"事件。**否决理由**：

- 写入不属于展示层——这是 Orchestrator 的职责
- resume 只是"返回一段上下文"，用户可能只是看看、不一定会继续对话
- "创建新对话"是一个有副作用的操作——应在前端 `/api/chat` 的第一轮显式发起

## Consequences

### 正向

- **只读语义 = 无副作用**。前端可以反复刷新 `/api/tensions` 而不触发任何状态变更或 LLM 调用。数据一致性问题局限在"某个实体被删了导致占位符出现"，不是"重复请求导致重复创建"
- **tensionQuery 保持为后端权威路径**。TensionMap 没有试图取代 tensionQuery——后端逻辑（冲突检测、确认）继续走 tensionQuery 直查 Relation 表
- **resumeFromTension 是 Article 12 精神的实现**："帮你看到矛盾在哪、怎么来的"——不是"帮你怎么解决"
- **空端点占位**：物理删除一条 Thought 后，引用它的 Relation 不会导致整条张力记录崩溃——用户仍能看到"这里曾经有一条张力"

### 负向 / 风险

- **`buildHistory` 的 O(n) 全量扫描**：每次调用 `list()` → 每条 entry 的 endpoint → 如果是 Thought → `buildHistory` → 全量查询 thought.query({user_id}) → 建立 byId + predecessorOf 映射表。如果列表中 N 条张力且每条两端都是 Thought，复杂度 O(N × M)，其中 M 是全部 Thought 数量。Phase 1 可接受，但 Phase 2 应优化为"一次全量查询、一次建图、所有历史重建共享同一张图"
- **`tensionQuery` 和 `TensionMap.list()` 的功能重叠**：`/api/tensions` 现在走 `TensionMap.list()`（返回结构化 entry），但 CLI 的 `mirror tensions` 可能走 `getAllTensions`（返回原始 Relation）。两者的输出格式不同——前端得到的是 `TensionViewEntry`（含 title/history），CLI 得到的是 `TensionEntry`（纯 relation+interpretationId）。这是正确的分层，但维护两套查询语义容易导致"修改一处忘记另一处"
- **`origin_interpretation_id` 只在 `derived_from_interpretation` 的 Thought 上有**：如果一个 Thought 是 `user_authored`（用户手写的），它没有 `origin_interpretation_id`。这时 `resumeFromTension` 找不到来源 Interpretation，history 和 prompt 会退化（返回空历史和通用开场白）。这不是 bug——用户手写的思想确实没有"AI 发现它的那一刻"——但用户可能不理解为什么有些张力能"回到对话"、有些不能
- **`resumeFromTension` 的 history 是简化的**：只用最近 4 条 Evidence + 2 条 Observation 作为对话上下文。如果张力诞生的时刻在很久以前的证据中（而 `evidence_ids` 可能很多），`slice(-4)` 不一定抓到最相关的那段对话。更理想的做法是用 Interpretation 的 `evidence_quotes`（如果可解析）精确定位
- **`buildResumeHistory` 没有走 `ConversationTurn` 格式**：它把 Evidence 原文和 Observation 内容混在一维数组里，没有区分"用户说了什么"和"AI 说了什么"的时间交织。这在给 `LLMResponseComposer` 做上下文时不如完整的 ConversationTurn 格式有效

### 后续行动

1. **性能优化**（Phase 2）：`buildHistory` 的共享建图——一次全量查询，所有 entry 共用同一张 superseded_by 映射表
2. **`resumeFromTension` 的 evidence_quotes 定位**（Phase 2）：如果 `evidence_quotes` 字段可解析，用它来精确定位最相关的对话片段而非 `slice(-4)`
3. **origin 标注**：在 TensionViewEntry 中标注"来源：AI 发现（可回溯对话）"或"来源：用户自建（无回溯）"，让用户理解为什么有些张力能 resume、有些不能
4. **API 一致性**：确认 CLI `mirror tensions` 是否走 TensionMap 还是 tensionQuery——统一为 TensionMap，避免两套输出格式的分叉维护
