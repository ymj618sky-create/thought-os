# ADR-0028: Representation — source / epistemic_status / authority_status 表达语义

> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: SEMANTIC ACCEPTED (2026-08-15) — schema representation DEFERRED (no field/schema/code change; semantic boundary frozen)
**Date**: 2026-08-15
**领域**: Representation / 认知对象权威语义
**Phase**: Optimization主线 P0 #1（蓝图 10 点之第①项）
**关联文档**: `adr/0025-cognitive-layering-semantic-boundaries.md`（认知分层边界）、`adr/0022-continuity-primary-resolution-authority.md`（Authority 已闭合：Model D）、`adr/0023-continuecontext-explanation-semantics.md`（Q2 HYPOTHESIS）、`specs/Observation_Enhancement_v0.1.md`、`src/schema/index.ts`（现有事实源实体字段）

> **核心定位（关键澄清）**：本 ADR 的 `Authority` **不是权限控制系统**，而是**认知对象语义系统**——它回答一个持久认知对象"来自哪里、是什么性质、谁拥有改变它意义的权力"。这正是 Thought OS 与普通 AI Agent 架构的根本区别：普通 Agent 把 Authority 设计成"AI 能做什么"的权限层；Thought OS 把 Authority 设计成"认知对象的意义归属"语义层。

---

## §0 Context（现状速写，非设计）

现有事实源实体（`src/schema/index.ts`）中，`source / 认知地位 / 权威归属` 的表达是**碎片化且隐含**的：

| 实体 | 现有相关字段 | 缺口 |
|---|---|---|
| Evidence | `source_type: chat_message｜voice_transcript｜uploaded_text｜uploaded_file` | 仅记"捕获渠道"，不记"认知归属"与"权威等级" |
| Observation | 无 source / 无 epistemic 标记（仅 `pattern_type`、`status: active｜dismissed`） | 其"客观/可核验"的认知地位未被显式建模 |
| Interpretation | `confidence`、`confidence_rationale`、`status: pending→confirmed/rejected/superseded` | confidence 隐含 epistemic 强度，但无统一 `epistemic_status` 维度 |
| Thought | `origin_type: user_authored｜derived_from_interpretation`、`origin_interpretation_id`、`source_reflection_id` | 来源链有片段，无统一 `source` 表达，无 `authority_status` |
| Reflection | `source_reflection_id` 已弃用/冗余（`origin_reflection_id` 并存）、`conversation_ids` | 来源引用重复且语义重叠 |

**核心张力**：Observation（客观、可核验真假）与 Interpretation（推断、需置信度）的"认知地位差异"存在于宪法与规范层，但**从未被建模为实体的显式权威属性**。当前靠 `confidence` 隐式区分，UI/Resolver/Continuity 各取所需，无统一契约。

**本 ADR 不解决**：谁生成 continuation（ADR-0022 已闭合 Model D）、rationale 表达语义（ADR-0023 HYPOTHESIS）、Knowledge 生命周期（ADR-0024 NOT STARTED）。本 ADR 只定义"Representation 层如何表达 source / epistemic_status / authority_status 三个维度"的语义。

---

## §1 逐问收敛（语义决议，已定方向）

> 纪律：本节只钉语义，不决定 schema 字段名/结构，不写代码。每个结论标注"是否影响存量数据"。

### Q1 — 什么算 Representation？**【已收敛】**

**决议**：Representation ≠ 所有系统实体。Representation 指**能够参与认知连续性的持久认知对象**。

区分两层：

- **A. 认知对象（Representation Primitive）** —— 需要 `source` + `epistemic_status` + `authority_status` 三维：
  - `Evidence`（用户原始表达，不可变）
  - `Observation`（系统客观观察）
  - `Interpretation`（系统推断解释）
  - `Thought`（若作为长期认知对象存在）
- **B. 事件对象（Event）** —— **不强行拥有三维**，只应有 `source reference` + `participant/context`：
  - `Reflection Event`
  - `Conversation Event`

理由：事件不是一个需要被接受或拒绝的认知主张，因此"谁拥有它的权威"是错误建模。这避免 Reflection 被错误赋予 `authority_status`。

影响存量：否（仅澄清分类，不改字段）。

### Q2 — source 的语义边界 **【已收敛：拆语义，不合并】**

**决议**：`source` **不是一个字段，而是一组来源语义**，必须拆为两个正交语义：

- **`capture_source`（provenance）**：这个东西最初从哪里进入系统？
  - 例：`chat_message` / `voice_transcript` / `uploaded_text` / `uploaded_file`
  - 对应现有 `Evidence.source_type`（不可变约束保留）
- **`derivation_source`（lineage）**：这个东西由什么认知对象产生？
  - 例：Interpretation `derived_from: [Evidence A, Observation B]`
  - 对应现有 `origin_*` / `origin_interpretation_id` / `source_reflection_id` 片段

理由：两者回答完全不同的问题（"入口" vs "生成链"）。设计为 `{ type, origin }` 单结构会在未来膨胀。本 ADR 仅在**语义层**拆开，不代表现在加字段。

影响存量：否（语义视图，旧字段继续存在）。

### Q3 — epistemic_status **【已收敛：枚举调整】**

**决议**：`epistemic_status` 描述"这句话是什么**性质**"，**不是**"可信程度多少"。枚举：

| 值 | 含义 | 例 |
|---|---|---|
| `asserted` | 用户表达（主张） | "我不喜欢现在的工作。" |
| `observed` | 系统观察（可核验模式） | "过去五次记录均出现职业相关主题。" |
| `inferred` | 系统解释（推断） | "可能意味着你正在考虑方向变化。" |
| `reflective` | 用户反思事件 | "我重新看待了过去的选择。" |

关键修正：不用 `objective`（易误读为"系统认为这是真的"——Observation 即使来自模式检测也不一定客观）。`confidence` **仍保留**，但明确归属为 `inferred` 的**内部属性**（仅在 inferred 时有意义），不跨维度通用。

影响存量：否（旧 `confidence` 作为 `inferred` 派生源；旧 `pattern_type` 作为 `observed` 派生源）。

### Q4 — authority_status **【已收敛：语义拆两维，schema 暂不决】**

**决议**：Authority 必须表达**生成方**与**接受方**的区别（与 ADR-0022 Model D 对齐：生成权 ≠ 接受权）。语义上拆为两个维度：

- **生成方（origin authority）**：谁产出了这条 Representation？
  - 候选值：`user` / `system`
- **采纳方（adoption authority）**：用户是否把它纳入自己的认知结构？
  - 候选值：**枚举暂缓**（见下方红线）。本 ADR 只锁定"adoption 是独立问题"，不固化状态枚举。

红线：
- **不采用 `system_confirmed` 命名**（易误读为"系统确认"；实际应是"用户确认接受"）。
- **不把 authority 设计成 AI 权限系统**——它是认知对象的"意义归属"语义。
- **`user_accepted` 与 `user_owned` 不过早固定**：二者可能存在语义重叠（用户说"这个解释挺接近"≠"这是我的理解"）。因此本 ADR 只定义 authority 的两个问题（origin / adoption），**adoption 的状态枚举暂缓**，避免 schema 阶段被枚举绑架。
- schema 上**暂不决定**是两字段还是复合结构；本 ADR 先锁定"必须区分生成方与采纳方"这一语义事实。

影响存量：否（语义层；现有 `status: confirmed` 可派生为 adoption 已发生，但不预先映射到固定枚举）。

### Q5 — 一次性 output vs Representation **【已收敛】**

**决议**：Projection 层**不拥有权威属性**。

- `ContinueContext`：不是认知对象，是当前计算出的展示结果 → **无 `authority_status`**。
- `Invitation Card`：不是 Interpretation，是触发用户继续思考的 projection → **无 `authority_status`**。

若出现"系统生成卡片→卡片拥有认知权威"，即为错误方向（呼应 ADR-0021 Constraint C：projection ≠ 隐藏权威）。

影响存量：否（仅约束未来 projection 设计）。

### Q6 — 进入 Continuity 的闸门 **【已收敛：放宽】**

**决议**：进入 Continuity 的候选**不要求 `user_owned` / 已确认**。

允许条件：
- `source` 可追溯（capture_source 或 derivation_source 存在）；
- `epistemic_status` 明确（非未定义）；
- **未被 reject / dismissed**（lifecycle status 排除）。

禁止条件：
- 不基于"重要性"（与 ADR-0022 §3.1.8 `entry ≠ most important` 一致）；
- 不要求用户确认。

理由：若要求 `user_owned` 才进 Continuity，Mirror 会丧失探索能力——一条高价值但尚未用户确认的 AI observation（"过去三个月你反复回来讨论同一主题"）完全可以成为 Continue candidate。

影响存量：否（定义读取规则，不改数据）。

### Q7 — Reject / Dismiss 后防复用 **【已收敛：正交】**

**决议**：**不污染 `authority_status`**。Reject 不是权威变化，而是生命周期事件。

- `Interpretation` 被 `rejected`、或 `Observation` 被 `dismissed` → 由 **lifecycle `status`** 承担：
  - `pending` → `accepted` / `rejected` / `superseded`
- `authority_status` 不负责生命周期；一个 Interpretation 可以"被拒绝作为用户解释"但"仍是一次历史 AI 输出"——其 `origin authority = system` 不变。

下游（Resolver/Continuity）排除复用 = 查 lifecycle `status`，不查 authority。

影响存量：否（强化 status 职责，authority 保持正交）。

### Q8 — 历史兼容与迁移 **【已收敛】**

**决议**：**不 migration**，尤其不触碰加密容器与 Persistence 契约（Stage 1 Alpha 纪律）。

采用"新语义视图 + 旧字段继续存在"：
- 旧 `source_type` → `capture_source` 派生源
- 旧 `origin_type` / `origin_interpretation_id` / `source_reflection_id` → `derivation_source` 派生源
- 旧 `confidence` → `inferred.epistemic` 内部属性派生源
- 旧 `status: confirmed` → `acceptance_status: user_accepted` 派生源

三维模型是**只读语义视图**，不立即删除旧字段。

影响存量：否（纯派生，无数据回填）。

---

## §2 核心决议（一句话）

> Representation 三维不是为了给所有对象贴标签，而是为了让任何进入认知连续性的持久对象，都能回答三个问题：**它从哪里来、它是什么性质、谁拥有改变它意义的权力。**

| 维度 | 回答 | 对应语义 |
|---|---|---|
| `source` | 来源与形成路径 | `capture_source`（入口） + `derivation_source`（生成链） |
| `epistemic_status` | 认知性质 | `asserted` / `observed` / `inferred` / `reflective` |
| `authority_status` | 确认归属 | 生成方（`user`/`system`） × 接受方（`pending`/`user_accepted`/`user_owned`） |

---

## §3 四个确认点（Semantic ACCEPTED，2026-08-15）

> 以下四点用户逐项 ACCEPT，构成本 ADR 语义冻结边界。schema 表达未冻结。

1. **Representation 边界**：认知对象（Evidence/Observation/Interpretation/Thought）持三维；Event（Reflection/Conversation）与 Projection（Invitation/ContinueContext）仅持 source reference + context，不持 authority。✅ ACCEPT（§1 Q1, Q5）。
2. **三维各自负责什么**：source=来源路径（非正确性）；epistemic_status=认知性质（非可信度，故 `confidence` 不得升级为权威判断）；authority=谁拥有改变其意义的权力（非谁生成它，故 `system 生成 ≠ system 权威`）。✅ ACCEPT（§1 Q2–Q4）。
3. **与现有 status / confidence / origin 字段的关系**：三维是只读语义视图，旧字段继续存在并作为派生源；authority 与 lifecycle status 正交（Q7）。
   - **补充约束（ACCEPT）**：旧字段（`status` / `confidence` / `pattern_type` / `origin_type`）可作为历史实现细节存在，但**不得继续定义未来语义**。方向 = `legacy fields → semantic interpretation → future representation model`（映射而非扩张），禁止旧字段与三维并存、五套语义平行扩张。旧字段是兼容来源，不是未来规范。
4. **Continuity 可读未确认 Interpretation**：可以——闸门为"可追溯 + epistemic 明确 + 未 reject"，不要求 user_owned。✅ ACCEPT（§1 Q6）。

四点全部 ACCEPT，**ADR-0028 语义冻结**；schema 表达阶段可后续启动，但仅回答"如何表达已确定语义"，不再讨论 Representation 定义 / Authority 必要性 / Continuity 读取范围。

---

## §4 Red lines（本 ADR 不重新开放）

| 约束 | Source | 对本 ADR 的含义 |
|---|---|---|
| Primitive 是唯一事实源 | ADR-0021 | 三维不得发明新事实，只表达已存在实体的来源/认知性质/归属 |
| Resolver 无认知判断权 | ADR-0021 Constraint A | epistemic_status 不表达"系统判断此思想重要" |
| Projection ≠ 隐藏权威 | ADR-0021 Constraint C | 三维只属落库 Primitive，projection 层不反向持有 |
| Model D 已闭合 | ADR-0022 §4 | authority 区分生成方/接受方，不伪装价值判断；不采用 `system_confirmed` |
| entry ≠ most important | ADR-0022 §3.1.8 | Continuity 闸门不基于"重要性" |
| 不引入新架构层 | 优化主线纪律 | 三维是现有 Representation 属性升级，非新层 |
| Authority ≠ 权限系统 | 本 ADR 核心定位 | authority_status 是认知对象意义归属语义，非 AI 权限控制 |

---

## §5 下一步（Schema DEFERRED）

1. **本阶段终点 = Semantic ACCEPTED（已达）**。语义边界冻结，不再修订 §1–§3。
2. **Schema 表达草案推迟**（用户决策：不立即进入字段设计，避免未充分验证的认知模型固化成 DB 结构）。待启动时的纪律：
   - 只回答"如何表达已确定语义"（字段结构 / 枚举 / 校验规则）；
   - **不再讨论**：什么是 Representation、Authority 是否必要、Continuity 是否读取 Interpretation（均已冻结）；
   - adoption authority 的状态枚举在 schema 阶段才审慎决定（本 ADR 仅锁定"origin / adoption 两问题"）；
   - 仍不动代码，仅落字段结构草案（可本文件续章或独立 ADR-0028-bis）。
3. 基于 schema 草案再评估是否需存量数据视图层代码（届时另开实现 ADR）。

---

## §6 冻结价值（本 ADR 的核心成果）

> **任何进入长期认知连续性的对象，都必须能够回答三个问题：**
> 1. **它来自哪里？**（`source`：capture_source + derivation_source）
> 2. **它是什么性质？**（`epistemic_status`：asserted / observed / inferred / reflective）
> 3. **它是否已被用户纳入自己的认知结构？**（`authority`：origin authority × adoption authority）
>
> 这条规则一旦冻结，后续的 Reflection、Question、Continuity、Knowledge 才有了共同语言——它们不再各自定义"来源/性质/归属"，而是共享同一套 Representation 语义契约。这正是 Thought OS 与普通 AI Agent 架构的分野：Authority 在此是**认知对象的意义归属语义系统**，而非 AI 权限控制系统。

