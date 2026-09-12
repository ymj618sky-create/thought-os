# ADR-0012: 对话编排采用"先回复、后台抽取 + 意图驱动 PendingSlot 确认"模式



> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: Accepted
**Date**: 2026-07-30
**领域**: 对话引擎 / 用户体验
**关联文档**: `src/conversation/Orchestrator.ts`（编排核心）、`src/conversation/types.ts`（类型定义）、`src/conversation/IntentResolver.ts`、`src/conversation/ResponseComposer.ts`、`src/conversation/LatticeClassifier.ts`、`src/conversation/PendingSlotStore.ts`、`src/conversation/StalledPromptStore.ts`、`src/services/questioner.ts`（问题生成器）、`adr/0009-cognitive-runtime-and-thinking-protocol.md`（Runtime 与 Protocol）、Constitution Article 2（"帮助用户发现、整理、连接、检验、演化思想"）、Article 6（用户最终决定权）

## Context

镜像期的对话引擎面临一个根本张力：AI 抽取（Extraction + ConflictDetection + Questioner）需要时间与 token 预算，但用户发完消息后期望**立即得到人性化的回复**——不是"处理中，请稍候..."的旋转图标。

更具体的交互问题链：
1. 用户在聊天框写了一段话 → AI 抽取了一条 Interpretation → **怎么让用户知道、怎么让用户确认？**
2. 早期的 `public/app.js` 用"三个按钮"硬编码确认（store/skip/reject），但**对话模式下没有按钮**——用户是用自然语言回应的
3. AI 不能每轮都追问"你觉得这条解读对吗"——这会破坏对话的自然流畅感
4. 用户不想回答时不能无限次追问——要有出口（"多次追问不清 → 沉底 → Review 再面对"）

需要决定：对话模式下的确认机制应该如何设计——不是"CRUD 管理面板"的确认，而是"像一个人在陪你聊天时轻轻问了一句"。

## Decision

### 1. 核心模式："先回复、后台抽取"

```
用户发消息
  │
  ├─→ 同步：handleTurn() 先解决挂起的 PendingSlot（如果当前有待确认的东西）
  │         ↓
  │      ResponseComposer.compose() 生成回复
  │         ↓
  │      返回 reply（用户立刻看到）  ←──── 用户感知的延迟边界
  │
  └─→ 异步：runBackground() 后台执行
           ├─ locateOrCreate Evidence
           ├─ extract Observations + Interpretations
           ├─ detect conflicts for each Interpretation
           ├─ 选一条 pending Interpretation → 创建 interpretation_confirm slot
           └─ 若无 Interpretation → 尝试 Questioner.run() → 创建 question slot
```

**这个模式的关键保证**：用户**从不等待**抽取。回复响应在 `runBackground` 之前就已返回。后台抽取与下一轮对话并行——用户接着聊，小镜接着想。

如果后台产出了新的 PendingSlot，会**在下一轮回复中自然浮现**（不是本轮、不是异步回调弹出的 toast）。

### 2. PendingSlot 状态机：从"解读确认"到"措辞确认"

PendingSlot 不是简单的"待确认列表"——它有一个两阶段状态机：

```
interpretation_confirm  （AI："我注意到你好像有点回避这个话题，对吗？"）
  │
  ├─ confirm_and_store_intent → thought_wording_confirm  （进入措辞确认）
  │       │
  │       ├─ wording_ok / wording_edit → Thought 落库，slot 释放
  │       └─ unclear → clarify_retry（追问升级）
  │
  ├─ confirm_no_store → 释放 slot（用户认同但不存 ← 这也是确认，不是忽略）
  ├─ reject → 释放 slot（"不是这样"）
  └─ unclear → clarify_retry
```

**`thought_wording_confirm` 是关键的中间阶段**——用户说"对，我认同这条解读"后，AI 不是直接用 Interpretation 原文存 Thought，而是：

1. `rewriteToDeclarative()`：把 AI 推测语气改写为第一人称陈述句（"我回避了声称想要的东西" vs "这个人可能正在回避..."）
2. `LatticeClassifier.classify()`：静默判定晶格坐标（1-12）

然后呈现改写后的措辞给用户："我帮你记成这个意思——'我回避了声称想要的东西'。这样可以吗？"

**为什么不做成一步到位**：如果用户在"确认解读"的同时还要考虑措辞和晶格坐标，认知负担太重。把"我认同这条观察"和"我同意这个措辞"分开，每步只是一个 yes/no/改措辞 的决策——符合"帮助用户思考"而非"让用户填表单"的精神。

### 3. 意图识别：LLM 解析自然语言而非正则堆砌

用户不会说 `action=confirm_and_store_intent`。用户说"对""认同""嗯好像是这样""算了吧不是这样""改成'我在回避自己'"。

`LLMIntentResolver` 用一次 LLM 调用解析意图，而非堆关键词匹配。`IntentResolver.ts` 中的 `parseAction()` 是第一层（快速路径：正则兜底），LLM 调用是第二层（深层语义：语气、犹豫、委婉）。两层叠加以防模型调用失败——LLM 失败时正则仍能覆盖大部分确认/驳回场景，不会让对话断裂。

**为什么依赖 LLM 而不是纯规则**：用户可能说"我想承认你说得对，但我不确定是不是全部...先记下吧"——这需要模型理解"部分认同、愿意记录的意图"。正则做不到这一点。但正则作为**兜底**可以防止模型调用失败时对话完全无法推进。

### 4. ResponseComposer：候选只在与话题相关时浮现

`LLMResponseComposer` 的核心判断：**在回复里自然带过还是推迟到更合适的时机？**

它不是"有候选就塞进回复"——而是把 `candidateSlot` 描述给模型，让模型判断这条候选与**本轮用户说的内容**是否相关：
- 相关 → `presentSlot: true` → 在回复末尾轻轻带一句（"……这一点我先帮你记下了"）
- 不相关 → `presentSlot: false` → 推迟，保留在队列中等下一轮

这是一个"自然时机"判断，而不是消息队列的 FIFO。"不相关就闭嘴"是对话的自然感的关键——没人喜欢一个每轮都追问"你觉得这条解读对吗"的 AI。

### 5. 追问升级与沉底机制（Clarify Escalation）

当用户回应 `unclear`（"嗯""再说吧""不知道"——不明确的模糊回应）：

```
第一轮 unclear → clarify_retry (追问一次："我想确认一下……")
第二轮 unclear → clarify_retry count=2
第三轮 unclear → clarify_retry count=3
超过 CLARIFY_MAX(3) → 释放 slot，记入 stalled_prompts
```

**StalledPrompt 不是"丢进垃圾堆"**——它是一个显式的 Review 列表。用户可以在"思想空间 Review"面板看到所有因多次追问不清而沉底的 Interpretation/Question，手动决定怎么处理。沉底的入口是"面对"而非"忽略"。

这与 Article 6（用户最终决定权）一致：AI 反复追问是侵犯，但 AI 把"我没弄明白的东西"整理好放在那里等用户回来看——这是尊重。

### 6. Questioner 的"队列深度=1"约束

有 pending Question 时不生成第二个。**理由**：如果用户面前同时浮着两个问题（"最近什么让你焦虑？""工作和自由你怎么看？"），哪个都不会被认真对待。一个问题是对话；两个问题是审问。

`force=true` 模式（"AI 你问一个问题"的手动触发）忽略 Evidence 累计阈值（`QUESTIONER_TRIGGER_MIN_EVIDENCE`），但仍受队列深度约束。

### 7. PendingSlot / StalledPrompt 持久化（不是内存 Map）

两个 Store 都用真实 SQLite 表（`pending_slots`、`stalled_prompts`）存储，不是内存 `Map`。**理由**：

- 对话可能跨数天——用户晚上写了一段、第二天早上打开接着聊，昨天的 PendingSlot 必须还在
- 服务重启（CLI 或 Web 服务器）不应丢失待确认候选
- `mirror.db` 备份时顺带备份了所有未决对话状态

注意：`pending_slots` 和 `stalled_prompts` 表不走 6 实体 Schema 校验——它们是编排层的内部状态，不是思想数据。`SqliteStorage.getDb()` 暴露原生 `DatabaseSync` 句柄就是为了这两个 Store 能直接建表而无需通过 `Storage` 接口。

### 8. 防御性已处置检查

Orchestrator 的 `applyAction` 在每个分支都先检查目标实体是否**已被外部消解**：

```typescript
// interpretation_confirm 分支
const interp0 = this.repos.interpretation.get(slot.interpretationId);
if (!interp0 || interp0.status !== 'pending') {
  // 已被 Review 面板 / 收件箱直接确认/驳回 → 静默释放 slot
  return null;
}
```

**理由**：PendingSlot 和"收件箱确认（旧版三按钮 UI）"是两条并行的确认路径。用户可能在聊天里看到了候选、没有回应，然后切到 Review 面板手动点了"不是这样"——此时 Interpretation 已变为 `rejected`。下轮对话的 Orchestrator 如果再对它做 `confirmInterpretation` 会触发 `ConstraintViolationError`（非 pending → 拒绝操作），导致整个 `/api/chat` 500。防御性检查防止了这种"跨路径冲突"。

### 9. 与 Cognitive Runtime 的组合关系（非重写）

`ConversationOrchestrator` 被 `CognitiveRuntime`（ADR-0009）以**组合**方式持有——Runtime 在 `Generate` 阶段注入 Thinking Protocol 的行为约束（`protocolHint`/`protocolBehavior`），Orchestrator 把这些注入透传给 Extractor、ResponseComposer、Questioner。Orchestrator 本身的对话机制不变。这是"不重写、只增强"的最小侵入设计。

## 备选方案（被否决的）

### A. 按钮式确认（`public/app.js` 的三按钮模式）

在聊天界面下方固定三个按钮（store/skip/reject），每轮抽取后让用户点。**否决理由**：

- 破坏了"对话"的沉浸感——用户是在聊天，不是在 CRUD 管理面板
- 按钮与用户刚发的消息没有语义关联——"我刚说了很长一段话，为什么问我要不要存这条 AI 推测？"
- 按钮无法处理"认同但措辞需要改"——要么加第四个按钮、要么加输入框，交互复杂度爆炸

注意：三按钮在 Review/收件箱面板中**仍然可用**——那是"管理我的思想"而非"和朋友聊天"的场景。对话和管理的交互模式分开是正确的。

### B. 所有确认推迟到对话结束（批量确认）

在用户关闭对话时一次性列出所有 Interpretation 让用户逐条确认。**否决理由**：

- 对话过程中用户就会提到新信息——这条新信息可能直接否定之前的一条 Interpretation。等到对话结束时确认已过时的 Interpretation 是浪费用户时间
- 本质上是把"对话"和"审核"强行分成两个阶段——用户的思想不是"先聊、后审"，而是在聊的过程中就在演化

### C. 纯规则意图识别（不用 LLM）

用正则 + 关键词堆砌代替 LLM 调用。**否决理由**：

- 用户说"我想承认你说得对，但我不确定是不是全部...先记下吧"这种复合语气，正则无法准确映射到"confirm_and_store_intent"
- 但我们**保留了两层叠加**：正则作为快速路径兜底（LLM 调用失败时仍能处理常见确认/驳回），LLM 负责处理深层语义。这种"渐进增强"比"纯 LLM"或"纯正则"都更健壮

### D. 每轮自动呈现最新 slot（不做自然时机判断）

不管话题是否相关，每轮都弹出 "Hey，你看这条解读……"。**否决理由**：

- 生硬——用户在想离婚的事，AI 却在问"你觉得上周那条关于咖啡偏好的推测对吗"
- 违反了"帮助用户思考"（Article 2）的精神——打断思考流不是帮助，是干扰

## Consequences

### 正向

- **用户感知延迟 = 回复生成的延迟，不是抽取的延迟**。这个设计选择是"对话体验"和"AI 能力"之间的最优切分点：回复快 → 用户愿意聊 → 聊得越多 → 后台抽取越有料 → 候选质量越高
- **两阶段确认降低认知负担**：先确认"我认同这个方向"→ 再确认"这个措辞是我说的"——每步独立、每步简单
- **自然时机判断让 AI 不烦人**："不相关就闭嘴"是对话礼仪。这个系统级约束通过 System Prompt 而非代码逻辑执行，意味着它是**可演化的**（换 Prompt 就能改判断标准，不需要改代码）
- **追问升级 + 沉底是有尊严的放弃**：AI 追问 3 次后不再纠缠，把东西放在 Review 面板等用户回来看。这比"无限追问"或"直接丢弃"都好——既尊重了用户的注意力，又尊重了"这个可能是值得想的东西"的可能性
- **跨路径防御**：同一个 Interpretation 可以通过对话确认、也可以通过 Review 面板确认。Orchestrator 的防御性检查保证这两条路径不会互斥

### 负向 / 风险

- **后台异步抽取是"fire-and-forget"**：`void this.runBackground(input)`——抽取过程中的异常只记日志、不通知用户。如果后台抽取连续失败（LLM 调用超时、API Key 失效），用户会一直看不到新的 Interpretation——但服务不会崩溃、不会有错误提示。需要"后台抽取健康检查"（如最近 N 轮 runBackground 全部 failed → 在回复中提一句"小镜最近感觉脑子有点慢"或由 `mirror doctor` 检测）
- **LLMIntentResolver + LLMResponseComposer + LLLatticeClassifier + Extraction + ConflictDetection + Questioner——一对话轮可能触发 6 次 LLM 调用**（虽然其中 4 次在后台异步）。Phase 1 的 DeepSeek 便宜，但将来换高价模型（如 Claude Opus）时成本可观。Phase 2 应考虑引入**更小更便宜的意图识别/晶格分类模型**（如 Haiku 或其他 1B-3B 模型）
- **`rewriteToDeclarative` 的兜底是原文**：如果改写 LLM 调用失败，`rewriteToDeclarative` 返回 `interp.content` 原文（AI 推测语气）。用户看到的是"AI 的推测被当成我的陈述"——比如"这个人可能正在回避"被存成 Thought 措辞。虽然用户还有 `wording_edit` 的机会，但这个兜底语义上不够安全
- **Questioner 游标是文件级状态**：`questioner.cursor.json` 是独立于 `mirror.db` 的文件。如果数据库被备份/恢复而游标文件没跟，Questioner 会重新扫描全部 Evidence 并可能生成重复问题（但 `pending_question_exists` 队列深度检查会阻止第二个 pending Question，所以最多浪费一次 LLM 调用，不会对用户可见产生重复问题）
- **`StalledPromptStore.unresolvedInterpretationIds` 用了 `json_extract`**：这是 SQLite 的 JSON 函数，与 `node:sqlite` 的内置 SQLite 版本有关——需确认 Node 24 的内置 SQLite 编译时包含 JSON1 扩展。若不含，`json_extract` 会静默失败返回 NULL，导致所有沉底 ID 都查不到、沉底的 Interpretation 反复弹出（被 pickNextSlot 误认为未沉底）
- **PendingSlot 的 `data` 列是明文 JSON**：SLOT 不通过 `DataCodec` 加密——即使 `MIRROR_ENCRYPTION=1` 开启，`pending_slots` 和 `stalled_prompts` 表中的 preview/draftContent 仍是明文。理由是这两个表不走 `Storage` 接口的 `put()`（不调用 `encode`），直接通过 `getDb()` 裸写。对于"思想属于用户"的承诺，这意味着**对话编排的内部状态（待确认解读原文、改写草案）在 at-rest 加密开启时仍为明文**——应在 Encryption_Policy 实现状态中注明
- **`companionFallback` 的语气一致性**：当 LLM 响应解析失败时，兜底回复是硬编码的中文——"我在听。关于「...」我先把它记下了"。这个回复的语言质量（emoji、口语化程度）与 LLM 生成的回复有差距，用户能感觉到"AI 突然变得机械"

### 后续行动

1. **Sentinel 模型替换**（Phase 2）：IntentResolver 和 LatticeClassifier 的 LLM 调用替换为更便宜的小模型（降低单轮成本）
2. **后台抽取健康监控**：最近 N 轮 runBackground 连续失败 → 在回复中温和提示或记日志告警
3. **`rewriteToDeclarative` 兜底改进**：LLM 调用失败时不返回 Interpretation 原文，而是返回带标记的版本（如 `[AI 推测改写失败，原文：...]`），让用户明确知道这不是自己的措辞
4. **验证 `node:sqlite` JSON1 扩展**：运行 `SELECT json_extract('{"a":1}', '$.a')`，若返回 NULL 则改为手动 JSON.parse 过滤（替代 `json_extract`）
5. **PendingSlot at-rest 加密**（Phase 2）：`pending_slots` 和 `stalled_prompts` 表纳入 `DataCodec` 覆盖范围，或至少对 `preview`/`draftContent`/`content` 字段加密
6. **Questioner 游标入 DB**：`questioner.cursor.json` 改为写入 `__sync_meta` 表（与 Sync 游标同位置），消除数据库备份/恢复时游标文件遗漏的风险
