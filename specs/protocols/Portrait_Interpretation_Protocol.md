# Protocol: Portrait Interpretation

**所属层**: `specs/protocols/`
**执行者**: 独立于 Extractor / Conflict Detector 的后台推理逻辑（消费用户长期 Evidence/Thought/Tension/Question，跨实体聚合，生成关于"人"的候选 Insight；**不得是 Extractor 自身**——Extractor 止于"单次对话的 Interpretation 草稿"，本协议止于"长期材料的候选画像判断"）
**范围声明**: 本协议只负责"从用户长期材料生成候选 Insight Hypothesis"这一步——即：跨 Thought/Tension/Question 聚合，产出 `pattern_type='portrait_insight'` 的 pending Interpretation。**不负责** Hypothesis 的后续确认/驳回（属 `Confirmation_Protocol.md`），**不负责** Hypothesis 进入 Continuity primary（属 ADR-0021/0031 边界），**不负责**连接/发现能力（v0.3/v0.4 范围）。

> 本协议是 ADR-0031 的可执行规范。Hypothesis 复用 Interpretation 实体（不新增 Kernel 概念），通过 `pattern_type='portrait_insight'` 子型标记。

---

> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

---

## 调用时机（Invocation Trigger）

本协议**不是对话循环的一部分**，是后台定时任务（参考 LatticeSynthesisService 同构模式）。

**触发必须同时满足三重门控**：

| 门控 | 阈值（v0.2 默认） | 失败时行为 |
|---|---|---|
| **材料门** | 自上次生成后，新增 Thought 数 ≥ `PORTRAIT_INSIGHT_MIN_NEW_THOUGHTS`（默认 5） | 跳过本轮 |
| **漂移门** | 上次生成到现在，最新 Reflection 与上次生成时 Reflection 的内容余弦相似度 < 0.85（即用户思考确有显著迁移） | 跳过本轮 |
| **预算门** | RuntimeBudget 当轮配额未耗尽 + 当天累计调用 ≤ 10 次 | 跳过本轮，记入预算日志 |

**绝对禁止触发的场景**（即使三重门控通过）：
- 对话正在进行（reply-first 优先级永远高于后台推理）
- 用户存在 stalled_prompts 未处理（先解决停滞，再生成新候选）
- 上次生成的 Hypothesis 中存在未 confirmed/rejected 的 pending 项（防止淹没用户）

---

## 输入

```yaml
user_id: U
trigger_context:
  new_thought_count_since_last: N
  last_run_at: ISO8601
  drift_score: 0.XX  # 余弦相似度
  budget_remaining: M

material_set:
  thoughts_recent:        # 默认最近 20 条 active Thought（含 superseded 但未 archived）
    - { id, content, created_at, lattice, status, superseded_by_id }
  questions_recent:       # 默认最近 20 条 Question（pending 优先）
    - { id, content, status, created_at }
  tensions_active:        # 所有 active contradicts/challenges Relation
    - { from_id, from_type, to_id, to_type, relation_type, status, created_at }
  reflection_latest:      # 最新 Reflection 的聚合字段
    theme, focus_by_lattice, tensions, evolved, created_at
  existing_hypotheses:    # 已有 pending + rejected 的 portrait_insight（防止重复生成）
    - { id, claim, status, rejected_reason }
```

**LLM System Prompt 必须包含的材料检索结果**：
- **反证候选检索**：对每个候选 Hypothesis 主题，用 LocalKnowledgeCapability（Jaccard 双字符组）检索 N=3 条语义最远（最不支持）的 Thought/Question 作为反证预检索
- **历史拒绝信号**：所有 `status='rejected'` 的 portrait_insight 全文（防止 LLM 重复生成同判断）
- **宪法规约**：S-6.3 characterization 认识论治理（非词汇禁用 / Article 18）、S-9.2 模型无关、Article 5 候选性表述与所有权归属

---

## 流程

```
Input: material_set + trigger_context
  ↓
Step 1 — Pre-flight Check（强制门控）
  校验三重门控 + 绝对禁止场景
  任一失败 → return SkipResult(reason)
  ↓
Step 2 — Counter-evidence Pre-retrieval
  对 material_set.thoughts_recent 的每条 Thought，
  用 LocalKnowledgeCapability 检索语义最远的 3 条 Thought/Question 作为反证池
  （这是确定性的，不调 LLM）
  ↓
Step 3 — Hypothesis Generation（LLM 调用，受 RuntimeBudget）
  构造 System Prompt（含 material_set + counter-evidence 池 + 历史拒绝 + 宪法规约）
  调用 LLM，输出严格 JSON Schema（见下）
  ↓
Step 4 — Output Schema Validation
  ajv 校验输出 JSON：
    - evidence_ids.length ≥ 3
    - counter_evidence_ids.length ≥ 1
    - confidence ∈ [0, 0.7]
    - claim 含"似乎 / 可能 / 从 N 个事件来看"等候选性词
    - claim 不含主权红线词（本质身份断言如"你本质上"/"你内心深处"、替用户决定如"你必须"/"你应该"）
  校验失败 → 丢弃本次输出，记入日志（不重试，防止成本溢出）
  ↓
Step 5 — Dedup Hash Check
  对每条生成的 Hypothesis，计算 (claim_normalized, evidence_ids_sorted) 的 SHA-256 哈希
  与已 rejected 的 portrait_insight 哈希集比对
  命中 → 丢弃（持久拒绝信号生效）
  ↓
Step 6 — Persistence（写入 Interpretation 表）
  对每条通过校验的 Hypothesis：
    - 创建 Interpretation 实体
    - source = 'mirror'（标识 AI 候选，区别于 source='user'）
    - status = 'pending'
    - evidence_ids = Step 4 输出（≥3 条）
    - confidence = Step 4 输出（≤ 0.7）
    - confidence_rationale = '[portrait_insight] supports=' + evidence_ids.join(',') + '; counters=' + counter_evidence_ids.join(',') + '; rationale=' + Step 4 输出的 rationale
      （反证 id 列表通过 confidence_rationale 文本结构化携带，不新增 Schema 字段）
    - tension = Step 4 输出的 scope（cognitive_pattern / tension_root / temporal_drift）
    - 复用现有 Interpretation Schema，不新增字段
  ↓
Step 7 — Result
  return InsightRunResult({
    generated: [Interpretation...],
    skipped: SkipReason,
    budget_consumed: K
  })
```

---

## 输出 Schema（严格 JSON）

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["hypotheses"],
  "properties": {
    "hypotheses": {
      "type": "array",
      "minItems": 0,
      "maxItems": 3,
      "items": {
        "type": "object",
        "required": [
          "claim", "claim_sentence", "evidence_ids", "counter_evidence_ids",
          "confidence", "confidence_rationale", "scope", "temporal_span", "challenge_hint"
        ],
        "properties": {
          "claim": {
            "type": "string",
            "description": "候选性表述，必须含'似乎/可能/从N个事件来看'等词",
            "pattern": "(似乎|可能|从.*来看|暗示|倾向于|看起来)"
          },
          "claim_sentence": {
            "type": "string",
            "description": "完整单句表述，供 UI 直接展示"
          },
          "evidence_ids": {
            "type": "array",
            "minItems": 3,
            "items": { "type": "string" }
          },
          "counter_evidence_ids": {
            "type": "array",
            "minItems": 1,
            "items": { "type": "string" }
          },
          "confidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 0.7,
            "description": "v0.2 保守上限，强制 LLM 自我降温"
          },
          "confidence_rationale": {
            "type": "string",
            "minLength": 20,
            "description": "必须显式说明支持证据的时间集中度与反证来源"
          },
          "scope": {
            "type": "string",
            "enum": ["cognitive_pattern", "tension_root", "temporal_drift"]
          },
          "temporal_span": {
            "type": "object",
            "required": ["from", "to"],
            "properties": {
              "from": { "type": "string", "format": "date" },
              "to": { "type": "string", "format": "date" }
            }
          },
          "challenge_hint": {
            "type": "string",
            "description": "给用户的挑战引导问题，必须是开放问句，非闭式判断"
          }
        }
      }
    }
  }
}
```

**禁止输出的内容（宪法红线，由 System Prompt 强制 + 后置 LLM Guard 拦截）**：
- ❌ 断言固定本质身份（"你本质上…" / "你内心深处…"）
- ❌ 替用户做决定（"你必须…" / "你应该…"）
- ✅ 允许：将心理学 / 行为科学 / 社会学等成熟构念应用于用户长期 Evidence，形成 person-level characterization（须可追溯 Evidence、标置信度、列反例、可推翻；详见 Constitution Article 18 / S-6.3 认识论治理）

**后置 LLM Guard**：用第二个 LLM 调用（同模型，低预算）校验：是否含禁止词？是否保持候选性？反证是否有效？通过后才进入 Step 5。

---

## 最小解释原则（Claim ≤ Evidence）

| ✅ 允许 | ❌ 禁止 |
|---|---|
| "从过去 N 个事件来看，你似乎对'未闭合的理论'容忍度较低" | "你害怕失败" |
| "你过去 6 个设计决定可能来自同一稳定原则：系统不能在无授权时替你判断" | "你的核心动机是控制欲" |
| "最近 47 天你在反复绕'理解完整性 vs 行动速度'" | "你是一个犹豫不决的人" |
| "你最近 3 个月把'连续性'放在越来越核心的位置" | "你本质上是个追求连贯性的人" |

**判定原则**：Claim 不得超出 Evidence 字面意思做"穿透性归因"。可以观察"反复出现"，不可断言"内在动机"。

---

## 与 Confirmation Protocol 的接口

Hypothesis 写入 Interpretation 表后，自动进入 Confirmation Protocol 的候选池：
- 用户可在 portrait.html 的"AI 假设"区块看到 pending Hypothesis
- 用户选择 5 种 challenge 原因之一（never_true / was_true_changed / insufficient_evidence / special_period / other）
- Confirmation Protocol 处理状态流转，本协议不参与

**Hypothesis 状态流转表**：

| 用户选择 | Hypothesis 状态 | 持久信号 | Engine 下次行为 |
|---|---|---|---|
| never_true | `rejected` | 拒绝哈希入去重集 | 不再生成同主题 |
| was_true_changed | `superseded`（v0.2 走 supersede） | 旧 Hypothesis 进 rejected 集 | 可触发新候选描述"现在的"判断 |
| insufficient_evidence | `rejected`（reason=insufficient） | 拒绝哈希入去重集 | 不再生成同主题 |
| special_period | `rejected`（reason=period） | 拒绝哈希入去重集 | 不再生成同主题 |
| other | `rejected` + userComment | 拒绝哈希入去重集 + userComment 注入下次 LLM context | 不再生成同主题 |

**userComment 处理（v0.2）**：
- **不**写入为新的 Thought（避免闭环：用户反驳 AI 立即变成新 Evidence 让 AI 再生成 Hypothesis）
- 仅作为下次 Engine 触发时的 LLM context 注入（"用户曾对该判断说：…"）
- v0.3 评估是否升级为 Thought（避免用户被 AI 反复挑战）

---

## 与 Continuity Resolution Layer 的边界

**严格禁止**：
- v0.1 的 `resolve()` **永不引用** pending Hypothesis（防止画像判断污染对话上下文）
- rejected Hypothesis **永不入** Continuity（持久信号，仅供 Engine 防重复）

**v0.2 允许**：
- 仅当用户 confirmed 一个 Hypothesis 后，它才可作为 Continuity 的 supporting context（非 primary）
- confirmed Hypothesis 在 Continuity 中的呈现方式：作为 "supporting.contexts[]" 的一项，标注 `source='portrait_insight_confirmed'`

---

## 不变量（Invariants）

1. **Hypothesis 永不自动 confirmed** — 引擎只产 pending，状态流转的唯一触发者是用户
2. **Hypothesis 永不写入 Thought** — Hypothesis 是 Interpretation 子型，不进入 Thought Evolution 的 supersede 链
3. **每条 Hypothesis 必须有反证** — counter_evidence_ids ≥ 1，否则 Schema 校验失败
4. **confidence ≤ 0.7**（v0.2）— 强制 LLM 自我降温
5. **rejected 持久化** — 拒绝哈希永久保留，防止 LLM 在 N 轮内重新生成同判断
6. **用户反驳不立即变 Thought** — userComment 仅入 LLM context，不入 Evidence
7. **三权分离** — Engine 生成 / LLM 解释 / 用户决定，三者职责不交叉

---

## 测试用例

测试套件：`specs/evaluation/cases/batch-portrait-insight-001.md`（5 条，需 LLM）

| 用例 | 验证点 |
|---|---|
| INSIGHT-001 | 候选性表述合规（claim 必须含"似乎/可能"等词） |
| INSIGHT-002 | 反证存在性（counter_evidence_ids.length ≥ 1） |
| INSIGHT-003 | confidence 上限（≤ 0.7） |
| INSIGHT-004 | 主权红线拦截（本质身份断言 / 替用户决定 → 输出为空） |
| INSIGHT-005 | 可被 Challenge（pending → rejected 后不再重新生成） |

---

## 修订记录

| 日期 | 版本 | 修订内容 | 修订人 |
|---|---|---|---|
| 2026-08-22 | v0.1 | 初稿，对应 ADR-0031 Phase A | 明杰 |
