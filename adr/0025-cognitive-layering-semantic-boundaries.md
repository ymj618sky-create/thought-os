# ADR-0025 — Cognitive Layering Semantic Boundaries (Evidence → Observation → Interpretation → Thought)

**Status**: ACCEPTED — recorded 2026-08-09, **formal review passed 2026-08-09** (REQUESTED CHANGES 1/2/3 已补强)
**Date**: 2026-08-09
**领域**: Cognitive semantic layering / Authority boundary
**Phase**: Post–Stage 1 Alpha（语义边界冻结，不触发实现）
**关联文档**:
- `specs/architecture/Cognitive_Layering_Review.md`（Discussion Draft，本 ADR 的决策来源）
- `Cognitive_Chain_Enhancement_Roadmap.md`（Plan，已有 `Evidence → Observation → Interpretation → Thought` 链）
- `specs/Observation_Enhancement_v0.1.md`（已落地 A2，Observation = pattern_type 闭集 + Projection）
- `adr/0003-extractor-stops-at-interpretation.md`（ACCEPTED，Extractor 不产出 Thought）
- `adr/0002-tension-endpoint-is-interpretation.md`（ACCEPTED，分层边界）
- `adr/0015-reflection-event-vs-projection.md`（ACCEPTED，Projection 不当事实源）
- `adr/0024-stage1-private-alpha-deployment.md`（ACCEPTED，Alpha 边界）

> **本 ADR 的性质**：冻结**语义边界与 authority**，**不冻结实现算法**。
> 它规定每一层"是什么、不是什么、谁有权确认"，但明确不规定 Observation 关系检测的具体算法、阈值或评分公式。下一阶段的 Observation Projection 实现不因本 ADR 被提前锁死。

---

## §0 Context

当前系统中，部分 `Fact` 本质上只是 `Evidence` 的语义压缩或改写（例如把"我好像越来越不想做这个了"改写成"你越来越不想做这个"）。这带来两个问题：

1. **信息增量不足**：`Evidence → Fact` 退化成"原话 → 改写句子"，未计算 Evidence 之间的关系。
2. **确定性提升风险**：改写把用户原话中的主观、暂态、不确定性压成看似已成立的事实，与 Constitution（AI 不替用户做判断）潜在冲突。

同时，若把"跨 Evidence 的候选解释"作为一个独立新层（`Candidate Pattern`）插入，会形成五层链 `Evidence → Observation → Candidate Pattern → Interpretation → Thought`，引入新的生命周期 / provenance / authority 问题，且违反 Roadmap "不新增认知层"的总原则。

本 ADR 旨在冻结认知链的**语义边界与 authority**，复用已有 `Interpretation` 层，不新增 primitive，不把实现算法提前锁死。

---

## §1 Decision

### 1.1 冻结的认知链

```text
Evidence
   │
   │ relationship projection
   ▼
Observation
   │
   │ interpretation proposal
   ▼
Interpretation Candidate
   │
   │ explicit user judgment
   ├──── reject ────→ discarded
   │
   ├──── correct ──→ corrected Thought
   │
   └──── accept ───→ Thought
```

**明确禁止**：

```text
Evidence → AI interpretation → Thought
```

AI 永远不得跳过 Observation / Interpretation Candidate 与显式用户判断，直接将解释 materialize 成 Thought。

### 1.2 各层语义边界（D1–D5 收敛）

| 层 | 是什么 | 不是什么 / 禁止 |
|----|--------|----------------|
| **Evidence** | 原始认知材料 / provenance（用户原话、经历、陈述） | 不需要用户确认其认知意义；不承载 interpretation |
| **Fact** (D1) | Explicit Stable Fact：明确表达、相对稳定、无需 AI 推断即可成立的信息（如"公司每周一开周会"） | **禁止**由趋势、情绪、因果、意图等推导生成；不担认知模式发现；不得把含判断的内容包装成 Fact |
| **Observation** (D2/D3) | Evidence 之间关系的 Projection；最小语义单位 = `relationship(Evidence₁…Evidenceₙ)`，而非 Evidence 的摘要/改写 | **不是** Evidence 改写；**不持久化为 primitive**；不成为新事实源；**必须具有 Evidence provenance（可回指支持它的 Evidence）**；不拥有认知权、不进入 Thought 生命周期、不修改 Evidence |
| **Interpretation Candidate** (D4) | 已有 `Interpretation` 层的**候选状态**（未确认），提出值得用户审视的候选解释 | **不是新 primitive**；**不能自行产生 Thought authority**；不宣布结论 |
| **Thought** (D5) | 用户确认/修正后的认知对象（已有 primitive） | **只有用户确认/修正才能 materialize**；AI 不得因"模式明显"自动升格 |

### 1.3 Observation 关系类型闭集（语义分类，非算法）

关系类型冻结为闭集：

```text
recurrence     重复：同类 Evidence 在不同时间重复出现
trend          变化：同一主题出现明显方向变化
contrast       对比：不同 Evidence 表达不同侧面
contradiction 矛盾：不同 Evidence 出现明显冲突
correlation    共现：多个原本不同的主题稳定共同出现
absence        缺失/长期未出现：在定义的观察窗口/材料范围内，未观察到此前频繁出现的某主题
```

**关键约束**：

- **关系类型是语义分类，不代表因果成立。**
- `correlation` 与 `absence` 语义风险高于 `recurrence`：`correlation` 易被 LLM 偷换成因果；`absence` 易把"没有记录"误判成"没有发生"。两者在生成 Interpretation Candidate 时需更高显式不确定性标注。
- **`absence` 特殊处理（语义约束，非算法约束）**：`absence` 只能表达"在定义的观察窗口 / 材料范围内未观察到某关系"，**不得**表达对象本身不存在、已停止或已改变。即 `absence of evidence ≠ evidence of absence`——例如"最近一个月没再提到创业"不得推导为"你已经不想创业了"。Observation 一旦涉及 `absence`，其表述必须限定在可观察范围内，不得越界到事实性否定。

### 1.3.1 Observation 的可审计 provenance 结构（语义边界，非 schema）

任何 Observation 一旦呈现给用户，必须能够回答"你为什么认为这是一个模式"。这是 Constitution "AI 不成为认知权威"的可审计性要求：

> **任何 Observation 都必须能够回到支持它的 Evidence。**

因此 Observation 至少携带以下可回指结构（语义约束，不规定具体存储格式）：

```text
Observation
 ├─ relationType      （必须属于 §1.3 闭集之一）
 ├─ evidenceIds[]     （指向支持该关系的 Evidence，可空仅当关系类型本身允许，如 absence 须显式标注观察窗口）
 └─ observation       （对人类可读的关系描述）
```

若 Observation 无法回指 Evidence，则它已越界成为 interpretation，不应以 Observation 名义呈现。

### 1.4 不冻结实现算法（本 ADR 的核心纪律）

以下**不**在本 ADR 中冻结，留给后续实现 cycle：

- `trend` 的具体判定（如"N 条 / N 天"）；
- `recurrence` 的触发次数阈值；
- `correlation` 的评分公式或置信度计算；
- 任何关系检测的具体算法、模型调用方式、聚类参数。

冻结的仅是：

> **"Observation 必须表达一种受支持的 Evidence relationship"**

不冻结：

> **"某关系类型必须满足某个具体算法阈值"**

否则 ADR 会过早把 Projection 实现锁死，违背本 ADR "冻结边界、不冻结算法"的性质。

### 1.5 Interpretation Candidate 的显式 acceptance semantics（D4 补充硬边界）

用户看到 Interpretation Candidate **绝不**默认"未反对 = 接受"。必须存在显式用户 authority：

```text
accept    用户确认该候选解释
reject    用户拒绝，候选丢弃
correct   用户修正语义（属于确认链，而非重新让 AI 解释）
```

其中 **`correct` 也属于用户确认链**：

> Observation：近 30 天你有 4 次提到不想参加周会。
> Interpretation Candidate：你可能正在失去对当前工作方式的投入。
> 用户：**不是工作本身，是我不喜欢现在的管理方式。**
> → 最终 Thought 来自**用户修正后的意义**，而非系统把原 Interpretation 改写一下。

这是 Constitution "AI organizes, human judges" 在 Interpretation 层最具体的实现边界。

### 1.6 `correct` 后 Thought 的 provenance（语义权威来自用户）

`correct` 产生的 Thought 来自**用户修正后的意义**，而非 AI Interpretation 改写（§1.5）。进一步约束其 provenance：

> **Thought 保留 provenance，但语义内容必须来自用户，而非 AI Interpretation。**

即 Thought 结构应可回溯：

```text
Thought
 ├─ user-authored / user-confirmed meaning   （语义权威来源）
 └─ provenance
      ├─ Evidence                  （原始材料）
      └─ optional originating Observation   （系统最初观察到的关系，仅供参考）
```

而**不得**表达为：

```text
Thought
 └─ derived_from_AI_Interpretation   （语义内容源自 AI 解释）
```

这样用户未来可见"这个 Thought 最初是系统从哪些材料观察到的"，但 Thought 的语义权威始终属于用户，AI Interpretation 仅是产生候选的触发源，不构成 Thought 的内容来源。

---

## §2 备选方案（被否决的）

### 2.1 新增 `Candidate Pattern` 作为独立 primitive（五层链）

否决理由：与已有 `Interpretation` 层职责完全重叠；形成 `Evidence → Observation → Candidate Pattern → Interpretation → Thought` 五层链，引入新生命周期 / provenance / authority 问题；违反 Roadmap "不新增认知层"总原则。→ 收敛为 `Interpretation Candidate = Interpretation 的候选状态`（§1.2 D4）。

### 2.2 继续优化现有 Fact 层（让 Fact 更"漂亮"）

否决理由：Fact 若只是 Evidence 改写，信息增量 ≈ 0；优化 Fact 不解决"材料→认知"的计算缺失，只是更漂亮的数据整理器。→ Fact 降级为 Explicit Stable Fact（D1），模式发现职责移交 Observation/Interpretation。

### 2.3 在 ADR 中冻结关系检测的具体算法/阈值

否决理由：过早锁死 Projection 实现，违背"冻结边界、不冻结算法"的性质；`correlation`/`absence` 算法尚不成熟，且 Stage 1 Alpha 边界（专业能力深度不在 Alpha 范围，见 ADR-0024）要求此类深度能力待观察信号回来后再进入。

### 2.4 让系统把"用户未反对"视为接受

否决理由：违反 Constitution 的用户判断权；等同于 AI 静默替用户升格 Interpretation → Thought。→ 必须显式 accept/reject/correct（§1.5）。

---

## §3 Consequences

### 正面

- 认知链从 `Evidence → Fact → Inbox`（改写）升级为 `Evidence → Observation → Interpretation → Thought`（关系计算 + 显式确认），完成"材料→认知"的增量。
- 复用已有 `Interpretation` 层，不新增 primitive，严守"不增加新事实源"与 Projection 纪律（呼应 ADR-0015、ADR-0003）。
- 确定性提升风险被显式禁止（Fact 禁推导、Interpretation 禁自动升格）。
- "用户确认"恢复认知意义：确认的是"这个关系/解释是不是我的"，而非"AI 有没有正确复述"。
- Questioner / Inbox 后续可消费 Observation/Interpretation 结果，而非围着 Evidence 碎片逐条追问（见 Cognitive_Layering_Review §11/§12），但必须在边界冻结后才改造。
- 本 ADR 不锁死算法，Observation Projection 实现可独立演进。

### 负面 / 成本

- 现有 Fact 生成逻辑需重新定义职责（降级为 Explicit Stable Fact）；属 implementation cycle，不在本 ADR 范围。
- Observation 关系检测与 Interpretation Candidate 生成尚无实现，需后续 cycle（且受 ADR-0024 Alpha 边界约束，深度能力待观察信号）。
- `correlation` / `absence` 的误用风险需在实现时以更高不确定性标注缓解，本 ADR 仅冻结语义约束，不提供算法保障。

### 推进纪律（禁止反向）

下一阶段**不应先改 Fact，也不应先改 Questioner**。先以本 ADR 冻结 Observation/Interpretation 语义与 authority，再让 Inbox 与 Questioner 消费其结果。否则会回到"哪里空了就修哪里"的局部优化。

---

## §4 与现有架构的关系

- 不推翻 `Observation_Enhancement_v0.1.md` §10 冻结范围（Phase A/A2 收口，禁止新 pattern_type 扩展、Reflection/ContinueContext 接入、Knowledge Layer、User Modeling，直到 Alpha UX 信号回来）。
- 不推翻 `Cognitive_Chain_Enhancement_Roadmap.md` §5 Stage 1 Alpha 边界（专业能力深度不在 Alpha 范围）；本 ADR 仅冻结语义边界，不触发 Interpretation 深度实现。
- 复用 ADR-0003（Extractor 止于 Interpretation）、ADR-0002（Interpretation 为解释端点）、ADR-0015（Projection 不当事实源）的既有权威纪律。
- `Interpretation Candidate` 落入 Roadmap 的 Phase C（Interpretation Enhancement）范畴，应在 Alpha 观察信号回来后、按 Roadmap §5 触发条件进入。

---

## §5 Formal Review Record

**Review 结论（2026-08-09）**：原则上 ACCEPT，补 3 项小补强后标记 ACCEPTED。

**REQUESTED CHANGES（已全部纳入）**：

1. **Observation 必须具有 Evidence provenance**（§1.3.1）：Observation 至少携带 `relationType / evidenceIds[] / observation`，可回指支持它的 Evidence；无法回指则越界为 interpretation。
2. **`absence` 只表达"观察范围内未观察到"**（§1.3）：`absence of evidence ≠ evidence of absence`，不得表达事实不存在/停止/改变；属语义约束非算法约束。
3. **`correct` 后 Thought 保留 provenance，语义内容来自用户**（§1.6）：Thought 结构含 `user-authored meaning` + `provenance{Evidence, optional originating Observation}`，不得表达为 `derived_from_AI_Interpretation`。

**直接接受、不再讨论的决定**：
- 不增加 `Candidate Pattern` primitive（五层链收敛为四层，避免为 UI/生命周期状态新增认知层）；
- 不冻结算法（ADR 冻结"什么是合法 Observation"，不冻结"如何计算 Observation"）；
- Questioner 不先改（推进顺序：ADR → Observation Projection → Interpretation Candidate → 用户确认链 → Inbox → Questioner；反向会让 Questioner 重成隐性 authority）。

---

*ACCEPTED — 2026-08-09. 冻结语义边界与 authority，不冻结实现算法。关联 Discussion Draft `Cognitive_Layering_Review.md` 待本 ADR ACCEPT 后回写为 CONCLUDED（按 review 决定，不现在联动）。*
