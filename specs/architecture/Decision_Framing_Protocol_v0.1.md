# Decision Framing Protocol v0.1

**Status:** PROTOCOL — v0.1 (pure spec, no implementation plan)
**Date:** 2026-08-10
**Layer:** Architecture / Specification
**Upstream:** `adr/0025-cognitive-layering-semantic-boundaries.md` (ACCEPTED), `specs/architecture/Cognitive_Layering_Review.md` (CONCLUDED), `specs/architecture/Observation_Projection_Implementation_v0.1.md` (IMPLEMENTATION CONTRACT)
**Constitution:** `docs/constitution/Constitution.md` — Article 1 / Article 5 / Invariant III (Runtime Restraint)

> 本文档是一份**纯协议规格**，只冻结输入 / 输出 / authority 边界 / provenance / 四层结构 / non-goals。
> **不包含 implementation plan、算法、阈值、schema 改动或代码路径**。
> 与 `Observation_Projection_Implementation_v0.1.md` 同源：先把契约冻住，再决定 Stage 1 如何验证。
> **不修改 Constitution。** 是否升格为 `Invariant IV — Decision Space Non-Collapse` 留待 Stage 1 真实运行证据后决定（见 §8）。

---

## 0. 定位与产品语言

Decision Framing 是 Thought OS 从"思考连续性工具"向"决策性认知支持工具"延伸的**自然一步**，与 Continuity / Reflection / Invitation 同一条产品哲学：

> **AI 不替你做决定，而是帮助你看清楚，你究竟在做什么决定。**
> *(Mirror doesn't make decisions for you. It helps you see the decision you're actually making.)*

能力命名建议：**Decision Framing / Decision Support**，内部概念名 **Decision Space（决策空间）**。
**不称** "Decision Making"（该词隐含收敛到选择，与本文红线冲突）。

核心价值不是"给答案"，而是**增加认知维度**——让用户意识到"我原来只从一个角度看这个问题"。

---

## 1. 宪法兼容性声明（Compatibility）

本文协议与 Constitution 兼容，且可将现有原则**精确化**：

- `Article 1`：增强思考，不替代思考 → Decision Framing 展开决策空间，不收敛到选择。
- `Article 5`：AI 可观察 / 提问 / 建议 / 总结；不可定义 / 判定 / 宣布 → 优劣分析是"建议/总结"的结构化形态，不落入"判定"。
- `Invariant III — Runtime Restraint`：Runtime 可**推荐认知方法（Protocol）**，不可判断正确与否 / 人生方向 → Lens Recommendation 属于"推荐认知方法"的可为区间。
- `Article 8`：Evidence / Observation / Interpretation 不得混淆 → 本协议显式分层（§3）。
- `Article 6`：任何 AI 推断必须允许用户修改 / 拒绝 / 删除 / 回滚 → 最终的 Decision 留白给用户。

**精确化红线（待 Stage 1 后可能升格为 `Invariant IV`）：**

> **Mirror may expand and clarify the decision space, but may not collapse it into a decision on behalf of the user.**
>
> *Mirror 可以扩展和澄清决策空间，但不得代替用户将决策空间收敛为一个选择。*

---

## 2. 权限边界矩阵（Authority Boundary）

```text
Mirror
 │
 ├── 提供决策方法 (Decision Method)              ✓
 ├── 组织用户材料 (Information Organization)       ✓
 ├── 按方法展开分析 (Lens-specific Analysis)       ✓
 ├── 暴露隐含假设 (Surface Assumptions)            ✓
 ├── 指出方法间冲突 (Surface Tensions)             ✓
 ├── 指出未知量 (Surface Unknowns)                 ✓
 ├── 情景推演 (Scenario Analysis)                  ✓
 ├── 推荐审视角度 (Lens Recommendation)            ✓  (须带 provenance，见 §6)
 │
 └── 替用户选择 (Decision Recommendation)         ✗  (明确禁止)
```

三态区分（§0 所述的三个东西，必须严格分离）：

| 层 | 名称 | 定义 | Mirror 可否 |
|---|---|---|---|
| ① | **Decision Method** | 知识/方法层：成本—收益、机会成本、可逆性、风险分析、情景分析、Pre-mortem、Expected Value、Regret Minimization 等 | 可提供 |
| ② | **Decision Analysis** | 针对用户自己材料的分析："按机会成本框架，你目前明确的机会成本包括 X、Y" | 可做 |
| ③ | **Decision Recommendation** | "因此你应该选择 A" | **禁止** |

---

## 3. 四层结构（Framing Pipeline）

Decision Framing 的展开必须遵循以下顺序，且**在最后一层之前停止**：

```text
Decision Problem Interpretation
        │
        ↓
     Lens Set
        │
        ↓
  Lens-specific Analysis
        │
        ↓
Comparison / Tension / Unknowns
        │
        ↓
     User Judgment          ← 系统止步于此，不进入"Recommendation"
```

### 3.1 Decision Problem Interpretation（决策问题解读）

- 输入：用户表达（Evidence）+ 已识别的 Interpretation Candidate（"这是一个决策问题"）。
- **本质**：这是对用户意图的**解读（Interpretation Candidate）**，不是 Observation（Observation 是跨 Evidence 的关系投影），也不是 Thought（未经用户确认）。
- 输出：结构化的决策问题描述，包括显式选项集合（如 离开 / 留下 / 延后）、关键约束、已知目标。
- 纪律：只描述"问题看起来是什么结构"，不预判"哪个选项正确"。

### 3.2 Lens Set（透镜集合）

- 基于 **问题结构特征**（见 §6）筛选适合该问题的决策方法子集，而非一股脑列出全部决策理论。
- 例如"我要不要买房"被识别为：财务决策 / 长期承诺 / 高不可逆 / 高机会成本 / 利率不确定性 → 仅呈现 Cash-flow resilience / Opportunity cost / Reversibility / Scenario analysis 四个透镜。
- 透镜是**认知方法的推荐**，不是选择结果的隐性推荐（§6）。

### 3.3 Lens-specific Analysis（透镜专项分析）

- 对 Lens Set 中每个透镜，独立展开：
  - 该透镜如何看这个问题；
  - 该透镜下的优势 / 局限 / 风险；
  - 该透镜对用户自己材料的观察结果（须引用 Evidence，见 §5 provenance）。
- 每个透镜的分析**相互独立**，不得相互暗示优劣排序。

### 3.4 Comparison / Tension / Unknowns（比较 / 冲突 / 未知）

- **Comparison ≠ Recommendation**（关键边界）：
  - Mirror 可以明确指出：
    > "按照成本—收益视角，A 的优势较明显；按照可逆性视角，B 更有优势；两种分析产生冲突。"
  - 但**必须在此停住**，不得收敛为"所以应该选 A"。
- 须显式呈现：
  - 方法之间的 **Tension**（冲突点）；
  - 当前最大的 **Unknowns**（未知变量 / 缺失信息 / 反事实不确定性）。
- 输出形态使 Decision Framing 成为 **decision-space expander**，而非偷偷把用户推向某答案的 recommendation engine。

### 3.5 User Judgment（用户判断）

- 系统止步于 §3.4，最终判断权完全留白给用户。
- 可附带一个**开放性问题**（Questioner 职责，非本协议范围）作为思考落点，但不得隐含"应该选 X"。

---

## 4. 输入契约（Input Contract）

- **唯一输入来源**：用户已落库的 `Evidence`（不可变，见 `Invariant II`）以及由 `ExtractionService` 派生的 Interpretation Candidate（"决策问题"识别）。
- v0.1 **不新增**任何输入实体、不读新数据源。
- 不要求用户以特定格式提问；Decision Problem Interpretation 从用户自由表达中识别结构。

---

## 5. Provenance 契约（Provenance Contract）

- 任何 Lens-specific Analysis 引用了用户材料之处，必须能回指 `evidenceIds[]`。
- Analysis 文本只描述"按某透镜，用户材料呈现出 X"，**不得**包含"你应该因为 X 而选 Y"的 Interpretation 越权措辞。
- 不进入 Thought lifecycle，不修改 Evidence。
- Lens Recommendation 必须标注其**结构依据**（从用户 Evidence 派生的哪些特征触发了该透镜），见 §6。

---

## 6. Lens Recommendation 契约（Lens Provenance）

**允许**，但必须满足：

- Mirror 可以说：
  > "基于你目前表达出的高不可逆性和机会成本特征，可以从可逆性与机会成本两个角度继续审视。"
- Mirror **不能**说：
  > "因此应该重点考虑方案 A。"
- **Lens 是认知方法的推荐，不是选择结果的隐性推荐。**
- 每条 Lens 推荐须附 `basis`：触发该透镜的问题结构特征（如 高不可逆 / 高机会成本 / 长期承诺 / 存在不确定性），且这些特征本身须可追溯至 Evidence。
- 禁止：透镜推荐隐含地指向某个选项、或把某个透镜包装成"正确视角"。

---

## 7. 与 Continuity 的连接 = DEFERRED

- v0.1 **只解决单轮 Decision Framing**。
- **不创建** Decision Object / Decision Problem 持久化实体。
- **不扩展** Continuity Resolver，**不修改** ContinueContext。
- "Continue this decision"（跨会话继续决策过程）作为未来能力保留，但**不进入当前实现边界**。
- 理由：避免"为连接而提前扩展 Continuity"，与 Observation v0.1 将 `absence` 推后的手法一致。
- 未来若要实现跨会话决策连续性，须作为独立 protocol cycle 开启，不与本 v0.1 耦合。

---

## 8. 升格路径（Constitution Escalation）

- 本协议当前 **不修改 Constitution**。
- 待 Stage 1 跑出真实运行证据（用户是否因 Decision Framing 而"看到未察觉的决策空间"、是否误读为推荐、lens provenance 是否充分），再决定是否：
  - 将 §1 的精确化红线升格为 `Invariant IV — Decision Space Non-Collapse`；
  - 或将 §6 的 Lens Provenance 纪律并入 `Invariant II`（Evidence Immutability）的下游要求。
- **原则**：一个漂亮的原则不应先于实现证据被冻结。

---

## 9. Explicit Non-Goals (v0.1)

```text
DO NOT
✗ 不修改 Constitution
✗ 不创建 Decision Object / 持久化决策实体
✗ 不扩展 Continuity Resolver / 不修改 ContinueContext
✗ 不生成 Decision Recommendation（"应该选 A"）
✗ 不把 Lens Recommendation 包装成选择结果的隐性推荐
✗ 不新增输入数据源 / 不读新外部数据
✗ 不进入 Thought lifecycle / 不修改 Evidence
✗ 不做"Continue this decision"跨会话连续性
✗ 不附带 implementation plan / 算法 / 阈值 / schema 改动
✗ 不预定义"完整决策方法清单"（方法集可随验证扩展）
```

**核心验收条件**：任何输出若收敛为"用户应该选择 X"，即视为本协议红线违例，整份输出须丢弃或回退到 §3.4 的比较形态。

---

## 10. 摘要（一句话）

> **Decision Framing = 决策空间展开器（decision-space expander）：展开方法、揭示冲突、暴露未知，但止步于用户判断之前。**

*PROTOCOL v0.1 — 纯规格，冻结输入 / 输出 / authority / provenance / non-goals；implementation 与 Stage 1 验证方式另议。*
