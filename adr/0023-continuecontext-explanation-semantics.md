# ADR-0023 — ContinueContext Explanation Semantics (Q2)

**Status**: HYPOTHESIS — recorded 2026-08-04, **pending Phase 4 Experience Prototype validation** (not final-locked)
**Date**: 2026-08-04
**领域**: Continuity / Policy / 表达层语义
**Phase**: Phase 4 v0.2 (Policy Boundary) — Phase A, Q2
**关联文档**: `specs/policy/Continuity_Policy_Resolution_v0.2.md`（cycle 入口，§7 Phase 4 Experience Prototype）、`adr/0022-continuity-primary-resolution-authority.md`（ACCEPTED，已闭合 Representation + Authority 两层）、`adr/0021-continuity-resolution-read-side-projection.md`（ACCEPTED，边界约束来源）

> 本 ADR 是**决策假设记录**，非最终锁定。2026-08-04 剃刀原则复核后：Q2 文档决策暂停为"假设"，待 Phase 4 Experience Prototype 用户验证后回填确认。当前记录的 Decision 是**候选方向**，红线约束仍成立，但 ADR-0023 状态从 ACCEPTED 调整为 HYPOTHESIS pending validation。
> **依赖关系（显式）**：
> ```
> Representation (ADR-0022 §3.1, ACCEPTED)   → ContinueContext = continuation entry
> Authority     (ADR-0022 §4, ACCEPTED)      → Model D: PoC generation + User acceptance
>         ↓
> Explanation Semantics (本 ADR, Q2, HYPOTHESIS) → rationale = continuity relationship, not importance
>         ↓
> Knowledge Lifecycle (ADR-0024, NOT STARTED) ← 依赖本 ADR 表达边界
> ```
> Q2 建立在 Q1 已闭合之上，只处理表达层语义，不重新讨论 authority。

---

## §0 Context

ADR-0022 已解决"谁生成 continuation entry"（Model D：Continuity Policy 拥有生成权，User 拥有最终接受权）。但生成之后，entry 需要被呈现给用户——用户有权知道"为什么是这个入口"。

当前 `ContinueContext.rationale?: string` 仅存在于接口层，无承诺语义。Q2 要回答：

> **`rationale` 的语义是什么？它是给谁看的？它能否隐含认知判断？**

关键约束来自 ADR-0022 五条冻结约束与 ADR-0021：
- `entry ≠ most important thought`（Representation 约束）
- `Resolver ≠ evaluator`（Constraint A）
- `context projection ≠ hidden memory authority`（Representation 约束）

因此 Q2 的核心风险是：**`rationale` 若被写成"系统认为这个值得继续的理由"，会重新引入被 ADR-0022 排除的认知判断**。本 ADR 必须在表达层切断这条路径。

---

## §1 Constraint (red lines, not reopened)

继承自上游，本 ADR 不重新开放：

| Constraint | Source | 对 Q2 的含义 |
|---|---|---|
| Primitive 是唯一事实源 | ADR-0021 | rationale 不能发明新事实，只能引用已存在 primitive / 生成规则 |
| Resolver 无认知判断权 | ADR-0021 Constraint A | rationale 不得表达"系统判断此思想重要" |
| ContinueContext 是 projection | ADR-0021 Constraint C | rationale 随 ContinueContext 生成/消费/丢弃，不持久化为状态 |
| Model D ≠ 共同判断思想价值 | ADR-0022 §4 | rationale 不把"生成权"伪装成"价值判断解释" |
| entry ≠ most important thought | ADR-0022 §3.1.8 | rationale 不称 entry 为"最重要/最相关" |

任何 Q2 候选若违反上述任一条，直接 disqualify。

---

## §2 Candidate Models (no selection)

### Model A — UI Explanation (product-experience copy)

语义：给用户看的体验文案，解释 entry 的来源上下文而非算法。

示例：
- "你上次留下了一个未完成的问题。"
- "这是你三天前开始的职业转型思考。"

特征：
- 面向终端用户；
- 语言自然、非技术；
- 引用 concrete primitive / 时间点，不引用 score / rule id。

### Model B — Reason Trace (developer observability)

语义：内部可观测性，记录生成规则与触发条件，供调试/审计。

示例：
- `{ rule: "reflection_latest", triggered_by: "PendingSlot.open", source_primitive: "ref-A" }`

特征：
- 面向开发者 / 系统；
- 结构化、可机读；
- 不面向用户呈现（除非用户主动展开"技术详情"）。

### Model C — User Continuity Explanation (cognitive experience)

语义：解释"我们之前停在哪里"，聚焦思考节点而非算法或重要性。

示例：
- "我们之前停留在这个思考节点：关于职业转型的不确定性。"

特征：
- 面向用户，但表达认知连续性而非系统决策；
- 最接近 Thought OS 意图（帮助用户重新进入思考过程，而非被告知"系统选了什么"）；
- 与 Model A 的区别：A 是产品文案风格，C 是认知关系风格，二者可叠加。

---

## §3 Decision Criteria (no scoring)

评估维度，仅用于结构比较，不评分、不排名：

1. **Transparency（透明度）**
   用户能否理解 entry 来源，而不被暗示"系统做了价值判断"？

2. **Constraint Safety（红线安全）**
   是否必然触发 §1 任一条红线？Model B 若直接呈现给用户则有风险。

3. **User Agency Preservation（用户主权保留）**
   解释是否保留 User 的最终接受权（ADR-0022 Model D），还是变相替用户确认"这就是你该继续的"？

4. **Projection Discipline（投影纪律）**
   rationale 是否仍随 ContinueContext 生灭，不成为新状态源（Constraint C）？

5. **Expression Independence（表达独立）**
   rationale 的语义是否独立于 authority 决策——即换 Authority 模型也不改变本 ADR 结论？

### §3.1 Options Matrix (non-scoring)

| 模型 | Strength | Tension | Open Question |
|---|---|---|---|
| A UI Explanation | 用户立即理解；零认知判断暗示 | 可能过于营销化，缺乏可观测性 | 多语言/个性化边界？ |
| B Reason Trace | 可调试/可审计；完全透明于系统 | 直接呈现给用户会触发 §1（伪装价值判断） | 用户是否可选择性查看？ |
| C User Continuity Explanation | 贴合 Thought OS 意图；表达认知关系 | 与 A 风格重叠，需定义分界 | A/C 是选择还是分层？ |

### §3.2 分层决策说明（决策输入，已采纳为 §4）

> 不与 A/B/C 单一选择，而采用与 ADR-0022 同构的分层：Model C 作主语义，Model B 作可选内部 trace。非 Hybrid authority。

- **Model A 不进入 `rationale` 主语义**：其"推荐文案"风格易混入"这个值得继续"的判断，触碰 §1 红线；仅可作为 Model C 的呈现风格参考。
- **Model C 主语义**：解释"入口与用户过去思考的连接"，不评价思想、不声明重要性。
- **Model B 可选内部 trace**：承载生成规则与触发事实，供验证/审计，默认不呈现给用户（否则用户感知"系统在分析我"，且易滑向 ranking）。

对应结构：

```
ContinueContext
    ├── userExplanation   (Model C, 用户看到)
    └── reasonTrace       (Model B, 系统验证)
```

此分层与 ADR-0022 的 `Representation(entry) / Resolution(contextual projection)` 两层分离同构，且不对 User 的最终接受权（Model D）增加任何认知暗示。

---

## §4 Decision (HYPOTHESIS — pending Phase 4 Experience Prototype)

> 本 ADR 采用与 ADR-0022 同构的**分层决策**，而非 A/B/C 单一选择。2026-08-04 剃刀原则后，本 Decision 作为**假设记录**，待 Phase 4 体验验证后回填确认，当前不视为最终锁定。

**Hypothesis (candidate direction)**

- **Model C（User Continuity Explanation）作为 `rationale` 的主语义**——表达"用户与继续入口之间的连续关系"，不评价思想重要性；
- **Model B（Reason Trace）作为可选内部 trace**——供系统验证 / 审计，不默认呈现给用户；
- **Model A（UI Explanation）不进入 `rationale` 主语义**——避免其"推荐文案"风险（易混入"这个值得继续"的判断），仅可作为 C 的呈现风格参考，不得写入 rationale 字段。

**结构（冻结）**

```
Resolution
    ↓
ContinueContext
    ├── userExplanation   (Model C, 用户看到；rationale 字段承载)
    └── reasonTrace       (Model B, 系统验证；可选，默认不呈现)
```

对应接口形态（仅记录，不实现）：

```ts
ContinueContext {
  entry          // 来自 ADR-0022 §3.1: continuation entry
  rationale      // = userExplanation (Model C)
  reasonTrace?   // = internal trace (Model B), optional
}
```

**Decision Statement（冻结句）**

```
ContinueContext rationale represents the continuity relationship between
the user and the generated continuation entry,
not the system's judgment of importance.
```

中文：

> **ContinueContext 的 rationale 表达用户与继续入口之间的连续关系，而不是系统对思想价值的判断。**

**红线保持**：本决策不违反 ADR-0023 §1 任一条（rationale 不发明事实、不表达认知判断、不成为状态源、不伪装价值判断、不称 entry 为最重要）。Model C ≠ cognitive interpretation——必须严格区分"连续性解释"与"认知解读"。

```
Decision:

Model C (primary semantic) + Model B (optional internal trace)
Rationale = continuity relationship, not importance judgment

Decision owner:
Product philosophy decision
Decision date:
2026-08-04
```

---

---

## §5 Consequences

**正向后果**
- `rationale` 语义闭合：表达连续关系（Model C），不表达系统价值判断；内部 trace（Model B）与呈现分离，避免用户感知"系统在分析我"。
- 与 ADR-0022 组合后三层闭合：Representation（entry）/ Authority（Model D）/ Explanation（C+B 分层）。
- 红线齐备：rationale 不成为第四状态源（Constraint C），Resolver 仍无认知权（Constraint A）。

**对 Q3 (Knowledge Lifecycle) 的边界影响（待 ADR-0024 处理）**
- 因 rationale = 连续关系而非重要性判断，Knowledge 若作为 supporting primitive 进入 continuation，其表达须沿用 Model C 风格：说明"与用户过去思考的连续连接"，而非"Knowledge X 因 relevance 被推荐"。
- reasonTrace（Model B）可承载 Knowledge↔Reflection 的连接事实，供验证，但不向用户呈现为推荐理由。

**未改变项**
- 不进入 Phase C Proof Scope 与 Phase D Implementation；
- 不讨论 ranking / freshness / LLM 决策；
- ADR-0022 已闭合，不在本 ADR 重议 Authority。

---

*Decision record, Phase 4 v0.2 Phase A / Q2. Candidate space complete; selection deferred until options analysis is reviewed.*
