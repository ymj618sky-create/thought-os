# ADR-0013: 晶格合成采用三重门控 + 余弦漂移检测 + LLM 生成自然语言观察



> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: Accepted
**Date**: 2026-07-30
**领域**: 思想空间 / 元认知
**关联文档**: `src/services/latticeSynthesis.ts`（实现）、`src/conversation/Orchestrator.ts`（消费方）、`specs/schemas/Observation.schema.json`（存在 gap——见下方"负向"）、Constitution Article 2（"帮助用户连接思想"）、Article 12（"看到自己思想的演化过程是最有价值的体验"）

## Context

用户不断落库新的 Thought。这些 Thought 分布在 12 个晶格坐标上（本体假设、认知边界、伦理边界……），形成了一种"思想空间"的地形图。随着时间推移，这个地形会漂移——用户可能从"沉迷自我解释（L7）"逐渐转向"目标与愿景（L9）"，而自己浑然不觉。

如果系统能**在漂移发生时做一条安静、中性的旁注**（不分析、不推荐、不建议），这就是 Article 12 所谓的"帮助用户看到自己思想演化轨迹"——是 Thought OS 区别于"笔记工具"和"AI 聊天"的核心价值之一。

问题是如何检测"漂移"，以及用什么形式呈现。

## Decision

### 1. 三重门控：游标 → 计数 → 显著

```
synthesize(userId):
  ├─ 游标门控：读取上次合成的 thought_id，只考察"之后新落库的 thought"
  ├─ 计数门控：新 window < SYNTHESIS_MIN_NEW_THOUGHTS(5) → 跳过（攒够再评估）
  └─ 显著门控：余弦相似度 ≥ 0.85 → 无显著漂移 → 跳过
       ↓
     通过所有门控 → LLM 生成一条自然语言 Observation
```

**游标门控的理由**：如果没有游标，每次 `synthesize` 都会评估**全部历史** Thought 的分布——用户积累 500 条 Thought 后，"最近新增 5 条"导致的漂移在整体分布中完全看不到。游标把"以前"和"最近"切成两个窗口，漂移检测在前窗口 baseline 和后窗口 new 之间进行。

**计数门控的理由**：新落库 2 条 Thought 就评估漂移，噪声太大（一条 Thought 就能把某个晶格的百分比从 10% 推到 20%）。`SYNTHESIS_MIN_NEW_THOUGHTS = 5` 是经验值——实际使用中可根据用户反馈调整。

**显著门控（余弦相似度 0.85）的理由**：

选择余弦相似度而非统计检验（卡方、KS 检验）或绝对条数差：

- 统计检验在**小样本**下不敏感——10 条 Thought 分布在 12 个晶格上，很多晶格为 0，卡方检验的期望频数假设不成立
- 绝对条数差（"如果 L1 多了 3 条就报警"）不能归一化——用户有 5 条 Thought 时 +3 是大漂移，有 100 条时 +3 是噪声
- 余弦相似度衡量**分布形状**的变化（各晶格占比的向量夹角），天然归一化，不受总条数影响

`0.85` 阈值意味着只有"明显重排晶格"时才触发合成。越接近 1 越不敏感。

**一个值得注意的边界**：如果前后两个窗口的分布完全相同但总数翻倍（用户从 5 条长到 10 条，分布比例不变），余弦相似度 = 1.0——判定为"无漂移"。这是正确的——分布没变就不需要告知用户"你还在想同样的事"。漂移检测的是**结构**变化，不是**规模**变化。

### 2. LLM 生成自然语言观察（不用模板）

找到漂移后，不是用模板生成"L1 从 30% 降到 20%，L4 从 10% 升到 25%"，而是用 LLM 把分布变化写成一句**中性、克制、描述性的人话**：

> "最近你落库的思考明显从 L1 自我观察，转向了 L4 关于关系的判断。"

约束（System Prompt）：
- 第三人称、描述语气，"像给未来用户的一句安静旁白"
- 不出现"你应该 / 你可能需要 / 建议你"（不变成建议引擎）
- 不超过 60 字（精炼 = 不被忽略）

**不用模板的理由**：模板是"冷数据报告"——用户不会读。LLM 生成的自然语言是"一句安静的旁白"——用户会在对话中不经意地看到。这两种呈现方式的心理效果完全不同。

### 3. `lattice_synthesis` 作为一种新的 Observation pattern_type

合成产物是一条 `Observation`（`pattern_type = 'lattice_synthesis'`）——不是 Thought、不是 Interpretation、不是 Question。

选择 Observation 的理由：
- Observation 不携带 confidence（它是"分布变化"这个事实的描述，不需要置信度标注）
- Observation 的状态只有 `active`/`dismissed`（没有 pending/confirmed/rejected 的确认流——合成观察不打扰用户做决策）
- Observation 可以被 `dismiss`（用户觉得这条观察没意思，不再看到它）

### 4. 不进收件箱，通过对话"轻提及"

`/api/inbox` 显式排除了 `pattern_type === 'lattice_synthesis'`。合成观察不占用用户的待处理队列——它是"背景信息"，只在对话中由 ResponseComposer 在合适时机作为 "observationToMention" 轻提一句。

`takePendingMention()` 的消费模式：
- 每次 `handleTurn()` 调用时，读取尚未被提及的合成 Observation
- 读完后标记 `last_mentioned_observation_id`——同一句观察不会被提及两次
- 这种"一次性消费"保证用户不会被反复提醒"你的晶格又漂了"

### 5. 定时器驱动（45s 间隔）+ 防重叠

`setInterval(synthesize, 45000)`——后台每 45 秒评估一次。`running` 标志防止上一次评估未完成时下一次评估启动（LLM 调用如果慢于 45 秒，不会堆积）。

选择定时器而非事件驱动（"每次 `confirmInterpretation` → store 之后触发"）的理由：
- 事件驱动的频率不可控——用户连续确认 10 条 Thought 时，每条都触发评估 = 10 次 LLM 调用
- 定时器更可预测：无论用户多活跃，最多 `3600/45 = 80` 次评估/小时
- "漂移"本身就是跨时间窗口的概念——不需要逐条实时更新

### 6. `synthesis_state` 单行游标表

游标状态（`last_synthesized_thought_id` / `last_mentioned_observation_id`）存在 `synthesis_state` 表中——单行（`id=1`），不走 `Storage` 接口，通过 `getDb()` 直接读写。与 `pending_slots` 和 `stalled_prompts` 一样，这是编排层内部状态（不在 6 实体之列），不参与 Schema 校验。

## 备选方案（被否决的）

### A. 规则驱动的"漂移报警"：if L1 下降 >20% then 通知

写死阈值和触发规则（"如果 L7 下降超过 20% 就提示"）。**否决理由**：

- 12 个晶格 × 12 个方向的规则矩阵 = 144 条规则——维护成本高、调试困难
- "20%"对不同用户意义不同：5 条 Thought 的用户 vs 100 条 Thought 的用户——相同百分比代表完全不同的信心水平
- 余弦相似度用一个数字回答了"分布变了吗"，规则矩阵用一个嵌套 if 回答——前者更简洁，后者更脆弱

### B. 用户可配置的漂移敏感度

暴露 `SYNTHESIS_SIMILARITY_THRESHOLD` 给用户调。**否决理由**：

- 用户不理解"余弦相似度 0.85 意味着什么"——这是一个需要统计背景的参数
- 如果有用户反馈"提醒太频繁"或"太不敏感"，调整阈值是开发者的决定而非用户配置。和 Argon2id 参数一样——**参数应由设计决定，不由用户承担决策负担**

### C. 在 Thought Space 面板用图表展示分布变化

用柱状图/热力图展示 12 晶格的时间序列。**否决理由**：

- 这是"数据分析仪表盘"的思维——Thought OS 不是仪表盘。用户不是分析师在监控自己的"思想 KPI"
- 自然语言观察可以自然地出现在对话流中；图表需要用户切换到另一个面板、投入注意力去"读数据"
- 图表在 Phase 2 可以考虑作为"思想空间可视化"的扩展——但它应该是自然语言观察的**补充**，不是**替代**

### D. 把合成 Observation 放入收件箱

让用户像对待 Interpretation 一样确认/驳回合成观察。**否决理由**：

- 合成观察不是"需要用户决策"的东西——它是"告诉用户一件事"。把"通知"和"待确认"混在一起，收件箱的概念就变成了"所有 AI 产出的大杂烩"
- 用户不需要"确认"自己的晶格在漂移——这只是一个事实陈述。确认的语义（"我同意这条观察是对的"）在"分布变化"上变得非常别扭

## Consequences

### 正向

- **用户在不被打扰的情况下看到自己思想的变化趋势**。这是 Article 12 精神的具体落地——"看到自己思想如何演化"
- **三重门控防止过度通知**。用户不会因为一次确认 3 条 Thought 就被"您的晶格正在变化"刷屏
- **LLM 生成的自然语言比模板更可能被读到**。"安静的旁白" vs "L1: 30%→20%"——前者是人话，后者是日志
- **`running` 标志防 LLM 调用堆积**：如果某次评估的 LLM 调用超过 45 秒，下一次 tick 会被直接跳过——不会出现"timer 越跑越快、LLM 调用越积越多"
- **消费-即丢弃**：`takePendingMention` 的语义保证同一句观察不会被提及两次

### 负向 / 风险

- **`pattern_type: 'lattice_synthesis'` 不在 JSON Schema 枚举中**——**已修复（2026-07-30）**：`specs/schemas/Observation.schema.json` 的 `pattern_type` 枚举现已包含 `'lattice_synthesis'`，TS 类型（`schema/index.ts`）与 JSON Schema 一致。`observation.put()` 不会再触发 `ajv` **SchemaViolationError**；回归测试见 `tests/m1.smoke.test.ts`。原担心"用户 Thought 数 < 5 时 bug 未暴露、≥5 时崩溃"已消除。另：`latticeSynthesis.ts` 实际写入的 `evidence_ids` 取 Thought 的 `evidence_ids`（即 Evidence id）并经 `repos.evidence.get` 过滤，`constraints.ts` 无 Observation 分支，故"在 constraints.ts 允许引用 Thought id"的改造**不必要**。
- **`synthesis_state` 表绕过 DataCodec**——与 `pending_slots` / `stalled_prompts` 一样，at-rest 加密开启时此表为明文。尽管它只存 UUID 游标（不含思想内容），但"哪些 thought_id 已合成"本身是元数据泄露
- **余弦相似度在空窗口时退化**：如果 prev window 为空（首次合成、或游标意外指向了被删除的 thought），`prevTotal === 0` → 直接返回 null（不合成）。但 new window 也可能在分布式为空（所有 thought 在游标之后被删除）——此时 `currTotal === 0` 也返回 null。这种退化是安全的（不做比做错好）
- **`synthesize()` 中的全量 `query` 性能**：`this.repos.thought.query({user_id, status:'active'})` 每次评估都拉全量 active Thought，在积累数百条后性能线性降级。Phase 2 可加 LIMIT + ORDER BY created_at DESC（只拉最近 N 条），或对游标之后的 thought 做范围查询
- **Timer 与 server 生命周期的耦合**：`setInterval` 没有对应的 `clearInterval`——如果服务器（Hono）有优雅关闭（graceful shutdown），timer 会泄漏到 Node 事件循环中阻止进程退出。应保存 `setInterval` 返回的 handle 并在 shutdown hook 中 `clearInterval`
- **合成 Observation 的 `evidence_ids` 是窗口 thought 的 evidence**——不是直接证据。这条 Observation（"你从 L1 转向了 L4"）的"证据"是那些自己作为证据的 Thought——这是**元级别的引用**（Thought 引用了 Evidence，Observation 引用了 Thought）。当用户查看"这条观察的证据是什么"时，看到的是原始对话——没有中间层"为什么这些 Thought 的分布变化是显著的"。这条信息在日志中有（`shift_lane`/`delta`）但不随 Observation 持久化——用户无法追溯"系统为什么觉得晶格漂移了"

### 后续行动

1. **~~CRITICAL：更新 `Observation.schema.json`~~ ✅ 已完成（2026-07-30）**——`pattern_type` 枚举已添加 `'lattice_synthesis'`，阻塞级崩溃已消除（回归测试 `tests/m1.smoke.test.ts`）。原"在 `constraints.ts` 允许 `evidence_ids` 引用 Thought id"的改造经验证**不必要**：`latticeSynthesis.ts` 写入的 `evidence_ids` 本就是 Evidence id（取 Thought 的 `evidence_ids` 并 `evidence.get` 过滤），且 `constraints.ts` 无 Observation 分支。
2. **timer cleanup**（Phase 2）：在 Hono 的 shutdown 或 process `SIGINT` 处理中 `clearInterval`
3. **性能优化**（Phase 2 中期）：`query` 加 LIMIT + 时间范围过滤，避免每次全表扫描
4. **`evidence_ids` 的元级追踪**（Phase 3）：合成 Observation 附加 `metadata: {shift_lane, delta, similarity}` 字段（需先改 Observation schema），使用户可以追溯"系统为什么产生这条观察"
5. **漂移通知的"暂停"选项**：如果用户觉得晶格合成观察出现得太频繁（在快速探索期可能每条都触发），可加 `MIRROR_SYNTHESIS_MIN_THOUGHTS` 环境变量或暂时禁用
