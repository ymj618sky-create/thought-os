# ADR-0031: Portrait Interpretation Engine — Pattern → Insight 的推理边界

> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: ACCEPTED — recorded 2026-08-22，规范层定稿；**Phase B PoC 实现已落地**（2026-08-22），前端 v0.2 UI 已补齐，用户采纳/挑战闭环已打通
**Production readiness**: PoC DONE — v0.2 设计基线已实现并可在前端验证；后台定时触发（默认 5min）待接入（见 §7），接后转 Stage 2 候选
**Date**: 2026-08-22
**领域**: Portrait / Interpretation Layer / Cognitive Inference Boundary
**Phase**: Stage 1 Private Alpha 平行扩展（不进入 Phase 5，不动 Kernel）
**关联文档**:
- `adr/0003-extractor-stops-at-interpretation.md`（Extractor 不产出 Thought，Interpretation Engine 同理——只产候选 Hypothesis）
- `adr/0021-continuity-resolution-read-side-projection.md`（Continuity 严格只读，Portrait 是其产品化扩展但不得反向写入 Kernel）
- `adr/0025-cognitive-layering-semantic-boundaries.md`（Evidence → Observation → Interpretation → Thought 四层，Insight 复用 Interpretation 层）
- `adr/0028-representation-source-epistemic-authority.md`（authority 在 Representation 与 source 之间，Hypothesis 是 source=ai 的 Representation，epistemic authority 在用户）
- `adr/0029-reflection-observation-interpretation-distinction.md`（Reflection 已区分 Observation/Interpretation，Hypothesis 落在 Interpretation 子型）
- `adr/0009-cognitive-runtime.md`（Cognitive Runtime 三态决策引擎，Interpretation Engine 是后台并行任务，不入对话循环）
- `adr/0013-lattice-synthesis-drift-observation.md`（LatticeSynthesisService 后台定时器 + 三重门控模式，Interpretation Engine 同构复用）
- `constitution/Constitution.md`（AI 增强思考不替代；Article 27 Spec 高于 Prompt；characterization 认识论治理 S-6.3 / Article 18 / Article 31）

---

## §0 Kernel Razor（强制前置）

**如果删掉 Portrait Interpretation Engine，系统会失去什么？**

- 不失去 Kernel：Evidence/Observation/Interpretation/Thought/Question/Relation 六概念无变化。
- 不失去现有 Pattern 层画像：Portrait MVP v0.1 仍可生成（recurring/tensions/evolving 三卡片）。
- 失去的是 **"从 Pattern 跨越到 Insight 的推理能力"**——Mirror 只能告诉用户"你反复说过 X"，无法回答"这些话放在一起，说明了什么"。
- 失去的是 **"把分散设计决定归并到稳定原则"** 的能力——6 个独立的 Thought 永远是 6 个，无法被识别为"同一个稳定原则的 6 个表现"。
- 失去的是 **"发现用户未明确说出的正在形成的模式"** 的能力——Portrait 只能复述用户已知，无法生成"你可能还没意识到，但行为轨迹暗示了 X"这类候选洞察。

**结论**：**保留**，但严格作为 **Interpretation 子型 + 后台推理任务**，不引入新 Kernel 实体。本 ADR 冻结的是"Mirror 如何从长期 Evidence 形成关于人的 Insight，同时不越过替人定义自己的边界"。

---

## §0.5 三立场（不可逾越）

1. **Hypothesis 是 Interpretation，不是新实体** — Insight 复用 Kernel 的 Interpretation 概念，通过 `pattern_type='portrait_insight'` 子型标记。不新增 Schema、不新增 Entity、不新增 Relation type。
2. **Interpretation Engine 是"候选器"，不是"裁判"** — 引擎只产 pending 状态的 Hypothesis，必须含支持证据 + 反证 + 置信度 + 理由。Hypothesis 是否成立由用户通过 Confirmation Protocol 决定，引擎永不 confirmed。
3. **Insight 必须可被 Challenge** — 所有 Hypothesis 必须能被用户反驳。反驳不删除 Hypothesis，状态流转为 `rejected`，并作为持久信号保留（防止 LLM 反复生成同一判断）。

---

## §1 上下文与动机

### 1.1 MVP v0.1 现状（已落地）

`src/services/portrait/` 实现了 Pattern 层画像：
- `buildPortrait()` 从 `reflectionChallengeService.recurring` + `TensionMapService.list` + `Thought.supersede` 时间线聚合
- 输出 3 类卡片：recurring / tensions / evolving
- 每张卡片含 Evidence chain + epistemicState + frequency/duration
- 严格只读，无 LLM，不写入

### 1.2 产品反馈揭示的缺层

> "你现在的 MVP 实际上在做什么？Chat → Thoughts / Tensions / Questions → 按 recurring / tensions / evolving 分类 → 卡片 → Evidence。这解决的是：'用户说过什么？' 但真正的 Portrait 应该解决的是：'从用户长期说过的话里，我理解到了一个什么样的人？'"
>
> "两者差一个非常关键的中间层：Interpretation / Insight（解释与洞察）"

MVP 链路：`Evidence → Thought → Pattern` ✅
缺层：`Pattern → Insight → Portrait` ❌

### 1.3 四能力模型（本 ADR 锁定）

| 能力 | 回答 | MVP v0.1 | v0.2 目标 |
|---|---|---|---|
| **识别 (Detect)** | "你反复在关注什么？" | ✅ Pattern 层 | 保持 |
| **解释 (Interpret)** | "为什么这些东西会反复出现？" | ❌ | **本 ADR 范围** |
| **连接 (Connect)** | "这些分散决定是否同源？" | ❌ | v0.3 |
| **发现 (Discover)** | "你可能没意识到、但行为轨迹暗示了什么？" | ❌ | v0.4 |

**v0.2 范围**：仅落地"解释"能力。连接与发现留作 v0.3/v0.4，待解释能力闭环验证后启动。

### 1.4 与 Thought Evolution 的汇合

> "Evolution 解决：一个 Thought 如何变化？Portrait 解决：大量 Thought 的变化轨迹，透露出这个人什么？"

本 ADR 锁定：Portrait 不是独立功能，是 **Thought Evolution 在"人"尺度上的聚合与解释投影**。架构上：
- Thought Evolution 提供"单 Thought 的变化轨迹"（supersede 链、refine 链）
- Portrait Interpretation Engine 消费 Evolution 投影，跨 Thought 聚合，生成"关于人的候选 Insight"
- 二者共享 Evidence chain 协议，但职责分离：Evolution 不生成关于人的判断，Engine 不生成关于单 Thought 的判断

---

## §2 决策

### 2.1 主决策：Hypothesis 复用 Interpretation 实体（不新增 Kernel 概念）

**决策**：Portrait Insight = `Interpretation(source='mirror', confidence_rationale 前缀 '[portrait_insight]')`。

> 标记策略修正（Phase B 实现时发现）：Interpretation schema 不支持 `pattern_type` 字段（与 Observation 不同，`additionalProperties: false` 禁止扩展）。改用 `source='mirror'`（标识 AI 生成的候选）+ `confidence_rationale` 字段前缀 `[portrait_insight]`（标识 Portrait Engine 产出，区别于 Extractor 的 `interpretation_hypothesis`）。两者组合唯一标识一条 portrait insight。

**约束**：
- `source` 必须为 `'mirror'`（标识 AI 候选，区别于 `source='user'`）
- `confidence_rationale` 必须以 `[portrait_insight]` 前缀开头（标识 Portrait Engine 产出）
- `evidence_ids` 必须含 ≥3 条 Thought/Interpretation/Evidence（防止单点证据生成画像判断）
- `confidence` 必填（0-1），且**置信度 ≤ 0.7**（v0.2 保守门控，强制 LLM 自我降温）
- `confidence_rationale` 前缀后必须显式列出**反证**（counter_evidence_ids）≥1 条，格式：`[portrait_insight] supports=t1,t2,t3; counters=t4; rationale=...`
- `status` 初始为 `pending`，永不自动 confirmed（Confirmation Protocol 独占确认权）
- 反证 id 列表通过 `confidence_rationale` 文本结构化携带，不新增 Schema 字段（保持 Kernel 不动）

**Kernel Razor 验证**：
- 不新增实体 ✅
- 不新增 Schema ✅（Interpretation schema 已支持 `source` 与 `confidence_rationale` 字段）
- 不新增 Relation type ✅（Hypothesis 与 Thought 的"解释关系"通过 `evidence_ids` 数组表达，不引入新 Relation type）
- 不新增状态机 ✅（复用 pending→confirmed/rejected/superseded）

### 2.2 推理边界（最小解释原则，不可逾越）

**Claim ≤ Evidence**：Hypothesis 不能比 Evidence 走得更远。

| 允许 | 禁止 |
|---|---|
| "你最近 47 天在反复绕'理解完整性 vs 行动速度'" | "你害怕失败" |
| "过去 37 个相关事件暗示你对未闭合理论容忍度较低" | "你是一个完美主义者" |
| "你过去 6 个设计决定可能来自同一稳定原则" | "你的核心动机是 X" |

**禁止条款（直接对应 S-6.3 认识论治理红线）**：
- ❌ 断言固定本质身份（"你本质上…" / "你内心深处…" / "你就是个…" / "注定…"）
- ❌ 替用户做决定（"你必须…" / "你应该…" / "你人生应该…"）
- ✅ 允许：将心理学 / 行为科学 / 社会学等成熟构念应用于用户长期 Evidence，形成 person-level characterization（须可追溯 Evidence、标置信度、列反例、可推翻）

**强制条款**：
- ✅ Hypothesis 必须以"从过去 N 个事件来看，你似乎…"句式表达（候选性，非断言）
- ✅ Hypothesis 必须列支持证据 + 反证
- ✅ Hypothesis 必须显式 confidence 与 rationale
- ✅ Hypothesis 必须可被 Challenge（5 原因：never_true / was_true_changed / insufficient_evidence / special_period / other）

### 2.3 触发机制（后台并行，不入对话循环）

**决策**：Interpretation Engine 是后台定时任务，**严格独立于对话循环**。

参考 LatticeSynthesisService（ADR-0013）的同构模式：
- **触发器**：定时器（默认 5 分钟）+ 三重门控
- **门控 1（材料门）**：自上次生成后，新增 Thought 数 ≥ `PORTRAIT_INSIGHT_MIN_NEW_THOUGHTS`（默认 5）
- **门控 2（漂移门）**：上次生成到现在，最新 Reflection 与上次生成时的 Reflection 余弦相似度 < 0.85（即用户思考确有显著迁移才触发，避免无意义重复生成）
- **门控 3（预算门）**：RuntimeBudget 配额未耗尽（默认每轮 1 次调用，每天累计 ≤ 10 次）

**禁止触发场景**：
- 对话正在进行（reply-first 优先级永远高于后台推理）
- 用户处于 stalled_prompts 状态（先解决停滞，再生成新候选）
- 上次生成的 Hypothesis 全部 pending 未处理（防止淹没用户）

### 2.4 LLM 调用边界

**决策**：v0.2 必须引入 LLM 调用（无 LLM 只能做统计 Pattern，做不出 Insight），但受 RuntimeBudget 严格控制。

**调用上下文（System Prompt 必须包含）**：
1. 用户 Thought 的**分层采样**（按日分桶轮转，默认 20 条；v0.4 修订：替代"最近 N 条"，防止批量导入/确认的时间脉冲把窗口压缩成单日快照）
2. 用户最近 N 条 Question 全文
3. 用户所有 active contradicts/challenges Relation
4. 用户最近 Reflection 的 theme + focus-by-lattice + tensions + evolved 字段
5. **反证检索结果**：LocalKnowledgeCapability 检索与候选 Hypothesis 相反的 Thought/Question
6. 已有 pending/rejected 的 portrait_insight（防止重复生成；rejected 项携带用户 challenge 原话）
7. **Evidence 原声**（v0.4 新增）：最近 20 条 `speaker='user'` 的 Evidence 原文摘要（第一人称是"画像感"的核心来源；`speaker='mirror'` 的回复必须排除——不能把镜子的话当成用户的声音）

**输出契约（严格 JSON Schema）**：
```json
{
  "hypotheses": [
    {
      "claim": "从过去 N 个事件来看，你似乎对'未闭合的理论'容忍度较低",
      "claim_sentence": "候选性表述，非断言",
      "evidence_ids": ["t1", "t2", "t3"],
      "counter_evidence_ids": ["t4"],
      "confidence": 0.6,
      "confidence_rationale": "支持证据集中在 2026-06 到 2026-08 的理论研究期间；反证来自 2026-07 短暂的产品化尝试",
      "scope": "cognitive_pattern",
      "temporal_span": { "from": "2026-06-01", "to": "2026-08-20" },
      "challenge_hint": "这是长期稳定倾向，还是 Mirror 项目造成的特殊时期？"
    }
  ]
}
```

**字段约束**：
- `evidence_ids.length ≥ 3`
- `counter_evidence_ids.length ≥ 1`
- `confidence ∈ [0, 0.7]`（v0.2 保守上限）
- `claim` 必须含"似乎 / 可能 / 从 N 个事件来看" 等候选性词
- `claim` 不得断言固定本质身份或替用户决定（主权红线；科学构念化刻画允许，受 S-6.3 认识论治理约束）
- `scope` 枚举：`cognitive_pattern` / `tension_root` / `temporal_drift`（v0.2 三类，连接/发现能力留 v0.3/v0.4）
- **时间跨度门控**（v0.4 新增）：`evidence_ids` 对应实体的 `created_at` 跨度必须 ≥ 2 天，否则丢弃（同日快照只构成"当日状态"，不构成"长期模式"）

### 2.5 Challenge 机制复用（不新增交互协议）

**决策**：Hypothesis 的 Challenge 复用 Confirmation Protocol + 现有 5 原因。

| 用户选择 | Hypothesis 状态流转 | 副作用 |
|---|---|---|
| never_true | `rejected` | 持久信号，防止 LLM 重复生成同判断 |
| was_true_changed | `rejected`（reason 字段标记 was_true_changed；**落地修正 v0.3**：原设计为 `superseded`，但 Kernel 跨字段约束 `constraints.ts` 要求 `status=superseded` 必须有 `superseded_by` 继任者，挑战时刻继任 Hypothesis 尚不存在；按权威链 Schema/约束 > ADR，落为 rejected + **去重豁免**——不进入 Engine 去重哈希集，允许后续生成描述"现在的"同主题新候选） | 触发新 Hypothesis 候选，描述"现在的"判断 |
| insufficient_evidence | `rejected`（reason 字段标记 insufficient） | 持久信号 |
| special_period | `rejected`（reason 字段标记 period） | 持久信号 |
| other | `rejected` + 用户文本 | 持久信号 |

**用户文本（userComment）**：
- v0.2 **不**写入为新的 Thought（避免闭环：用户反驳 AI 立即变成新 Evidence 让 AI 再生成 Hypothesis）
- v0.2 仅作为下次 Engine 触发时的 LLM context 注入（"用户曾对该判断说：…"）
- v0.3 评估是否升级为 Thought（避免用户被 AI 反复挑战）

### 2.6 与 Continuity Resolution Layer 的关系

**决策**：Interpretation Engine 是 Continuity v0.2 扩展，但**严格不破坏 v0.1 只读边界**。

```
Continuity v0.1（ADR-0021，已 frozen）
  ↓ 只读投影，无写入，无 LLM
  └─ resolve() → primary reflection + supporting slots

Continuity v0.2（本 ADR）
  ↓ 后台推理任务（Pattern → Insight）
  └─ InterpretationEngine.run() → 产 pending Hypothesis（写入 Interpretation 表）
  ↓
  └─ resolve() 扩展：primary 中可引用最近 confirmed 的 Hypothesis（仅 confirmed，pending 不入 primary）
```

**关键边界**：
- v0.1 的 `resolve()` 永远不引用 pending Hypothesis（防止画像判断污染对话上下文）
- 仅当用户 confirmed 一个 Hypothesis 后，它才可作为 Continuity 的 supporting context
- rejected Hypothesis 永不入 Continuity（持久信号，仅供 Engine 防重复）

---

## §3 三权分离（不可逾越）

| 角色 | 权限 | 边界 |
|---|---|---|
| **Interpretation Engine** | 生成 pending Hypothesis | 永不 confirmed，永不写入 Thought，永不修改 Continuity primary |
| **LLM** | 解释 Evidence 形成候选 Insight | 必须列反证，必须 confidence ≤ 0.7，必须可被 Challenge |
| **User** | confirmed / rejected / revised | 最终解释权，所有 Hypothesis 状态流转的唯一触发者 |

---

## §4 实现后果

### 4.1 正面后果

- **Portrait 从"思想数据库的漂亮视图"升级为"Mirror 对一个人的理解能力"**
- Evidence chain + counter-evidence + confidence 让 Hypothesis 可追溯、可证伪
- 复用 Interpretation 实体，无新 Kernel 概念，无新 Schema
- 复用 Confirmation Protocol，无新交互协议
- 与 Thought Evolution 自然汇合（Evolution 在 Thought 尺度，Portrait 在人尺度）

### 4.2 负面后果 / 风险

- **LLM 调用成本**：每次触发消耗 RuntimeBudget，需严格门控
- **Hypothesis 淹没风险**：若反证检索失效，LLM 可能反复生成低质量候选 → 通过门控 3（pending 未处理则不触发）+ rejected 持久信号缓解
- **候选性表述的语言漂移**：LLM 可能在多次生成中逐步把"似乎"漂移为"是" → 通过 System Prompt 强制 + 输出 Schema 校验拦截
- **用户反驳变成新 Evidence 闭环风险**：v0.2 严格禁止 userComment 写入为 Thought，防止 AI 反复挑战用户
- **画像判断污染对话上下文风险**：v0.1 的 resolve() 永不引用 pending Hypothesis

### 4.3 未解决的开问题（Open Questions，留待 v0.3+）

- **Q1**：Hypothesis 是否应该有"时间窗口"自动 expire？例如 90 天未 confirmed 自动转 superseded？
- **Q2**：连接能力（v0.3）如何识别"6 个分散决定同源"？需要新建 Relation type `manifests` 还是走 Interpretation evidence_ids？
- **Q3**：发现能力（v0.4）如何防止 LLM 走在用户前面？是否需要"用户已明确说出"作为反证检索源？
- **Q4**：用户反驳（rejected）累积 N 次后，是否应自动调整 Engine 的 confidence 上限？

---

## §5 v0.2 落地路径（PoC，非承诺）

**Phase A: 协议与 Prompt 冻结（本 ADR + Protocol + Capability + Prompt v001）**
- 本 ADR（0031）
- `specs/protocols/Portrait_Interpretation_Protocol.md`
- `(private agent capability)`
- `(private agent capability)`
- 测试用例：`specs/evaluation/cases/batch-portrait-insight-001.md`（5 条候选性表述合规校验）

**Phase B: 最小 PoC 实现（待 Phase A 用户验收）**
- `src/services/portrait/interpretationEngine.ts`（后台定时器 + 三重门控 + LLM 调用 + 输出 Schema 校验）
- `src/services/portrait/counterEvidenceRetrieval.ts`（复用 LocalKnowledgeCapability 检索反证）
- `src/api/routes/portrait.ts` 扩展：`POST /api/portrait/insights/:id/confirm`（接入现有 Confirmation Protocol）

**Phase C: Challenge 闭环验证（待 Phase B PoC 跑通）**
- 用户挑战 → rejected 持久化 → Engine 下次生成时注入"用户曾拒绝过该判断"作为 LLM context
- 测试：rejected 的 Hypothesis 不会被 Engine 在 N 轮内重新生成（去重哈希）

**Phase D: UI 集成（待 Phase C 闭环）**
- `public/portrait.html` 顶部新增"AI 假设"区块（与现有 Pattern 卡片视觉区分：虚线边框 + 候选性徽章）
- `public/portrait.js` 渲染 Hypothesis + 展开支持/反证 + Challenge 入口
- 不扩张现有 Pattern 卡片字段

**Phase A-D 不承诺时间表**。每阶段完成后由用户决定是否启动下一阶段。

---

## §6 拒绝的替代方案

### 6.1 拒绝：新增 `Hypothesis` Kernel 实体

**理由**：违反 Kernel Razor。Hypothesis 本质就是"AI 对用户的解释性判断"，正是 Interpretation 的定义。新增实体只是表达更方便，无功能性新增。

### 6.2 拒绝：让 Engine 接入对话循环

**理由**：违反 reply-first（ADR-0012）。用户发消息 → Mirror 应先回复，再后台推理。Engine 接入循环会让对话变成"AI 反过来质问用户"，破坏认知增强而非替代的核心宪法原则。

### 6.3 拒绝：Hypothesis 直接写入 Continuity primary

**理由**：违反 Continuity v0.1 只读边界（ADR-0021）。pending Hypothesis 是 AI 的候选判断，进入 primary 会让"AI 候选"变成"对话上下文"，污染用户当下判断。

### 6.4 拒绝：用户反驳立即升级为 Thought

**理由**：闭环风险。AI 生成 Hypothesis → 用户反驳 → 反驳成为新 Thought → AI 基于新 Thought 生成新 Hypothesis → 用户再反驳。这会让 Mirror 从"镜子"变成"持续审讯"。

### 6.5 拒绝：连接能力（v0.3）与发现能力（v0.4）在 v0.2 一起做

**理由**：四能力递进。解释能力未闭环前做连接/发现，会让 LLM 在没有"反证机制"验证的情况下做更激进的推断。能力必须按"识别 → 解释 → 连接 → 发现"顺序解锁，每步验证后才启动下一步。

---

## §7 验收标准

### Phase A 完成 = 本 ADR ACCEPTED（2026-08-22 已满足）
- [x] ADR-0031 定稿（本文档）
- [x] `specs/protocols/Portrait_Interpretation_Protocol.md` 定稿
- [x] `(private agent capability)` 定稿
- [x] `(private agent capability)` 定稿
- [x] `specs/evaluation/cases/batch-portrait-insight-001.md` 定稿（5 条测试用例：候选性表述合规 / 反证存在性 / confidence 上限 / 主权红线拦截 / 可被 Challenge）
- [x] 用户明确批准本 ADR 进入 Phase B（PoC 实现）

### Phase B PoC 落地状态（2026-08-22 已实现）
- [x] Interpretation Engine 实现：`src/services/portrait/interpretationEngine.ts`（三重门控 + LLM + Hypothesis 写入 Interpretation 表）
- [x] 反证检索：`src/services/portrait/counterEvidenceRetrieval.ts`
- [x] 路由层：`src/api/routes/portrait.ts`（`/insights`、`/insights/:id`、`/insights/run`、`/insights/:id/confirm`、`/insights/:id/challenge`）
- [x] 确认/挑战流转：复用 `ConfirmationService.confirmInterpretation`（`src/services/confirmation.ts`）
- [x] 前端 v0.2 UI：`public/portrait.html` + `public/portrait.js`（Insight 列表、采纳/挑战按钮、手动"重新推演"）
- [x] 单元测试：`tests/portrait.test.ts` + `tests/portrait-insight-engine.test.ts`
- [x] **后台定时触发**：`container.ts` 已注册 `setInterval`（默认 5min，`MIRROR_BG_JOBS=0` 可禁用），引擎自带三重门控 + running 锁防重入（2026-08-23 核实）

> 注：v0.2 的 Hypothesis 严格保持候选性（confidence ≤ 0.7、必含反证、可被 Challenge）。pending 不入 Continuity primary（§2.6 边界保留）。

---

## §8 修订记录

| 日期 | 版本 | 修订内容 | 修订人 |
|---|---|---|---|
| 2026-08-22 | v0.1 | 初稿，PROPOSED 状态 | 明杰 |
| 2026-08-22 | v0.2 | ACCEPTED：Phase B PoC 已落地，前端 v0.2 UI 补齐，§7 验收状态更新；后台定时触发待接入 | 明杰 |
| 2026-08-23 | v0.3 | §2.5 落地修正：was_true_changed 由 superseded 改为 rejected + 去重豁免（Kernel 约束 superseded_by 非空与 ADR 字面冲突，按权威链约束层优先）；§2.5 userComment 注入下次 Engine LLM context 已补齐（含 prompt 指令 + 解析消毒）；§7 后台定时器已接入（container.ts，5min）；前端确认/挑战闭环修通（app.js SPA，非 portrait.html） | 明杰 |
| 2026-08-23 | v0.4 | §2.4 材料层修订（产品反馈"Insight 没有汇聚感"）：① Thought 窗口由"最近 20 条"改为按日分层采样；② 材料清单新增 Evidence 原声（speaker=user）；③ 新增时间跨度门控（evidence 跨度 <2 天丢弃）；④ 配套 Extractor prompt v002 治理第三人称转述腔（Thought 层原料质量） | 明杰 |
