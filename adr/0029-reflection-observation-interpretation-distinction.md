# ADR-0029: Reflection — Observation / Interpretation Distinction

> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: SEMANTIC ACCEPTED (2026-08-15) — schema representation DEFERRED (no field/schema/code change; semantic boundary frozen)
**Date**: 2026-08-15
**领域**: Reflection / 认知对象语义区分
**Phase**: Optimization主线 P0 #2（蓝图 10 点之第②项），依赖 ADR-0028 语义地基
**关联文档**: `adr/0028-representation-source-epistemic-authority.md`（Semantic ACCEPTED：Representation 边界 / Interpretation 是语义状态非架构层 / Event·Projection 不承载 authority / Continuity 可读未确认非 reject 对象）、`specs/Observation_Enhancement_v0.1.md`、`src/schema/index.ts`（Observation / Interpretation / Reflection 现有字段）

> 本 ADR 是 **P0 #2 语义审查周期** 的入口。方式与 ADR-0028 一致：**先钉语义，再定 schema**。
> 严格纪律：期间**不动任何代码**、**不改任何 schema 文件**、**不引入新架构层（尤其不引入 Interpretation Layer）**、**不进入实现周期**。
> 目标产出 = 8 个语义问题的明确答案；答案收敛后，才进入 schema 表达阶段（另开或续章）。
> 本 ADR 解决的是"未来系统如何理解 Reflection 产物"，不是"数据库如何存"。

---

## §0 Context（依赖 ADR-0028 地基）

ADR-0028 已冻结四条约束，构成本 ADR 的前置语义地基：

1. **Representation 边界**：Representation = 持久认知对象（Evidence/Observation/Interpretation/Thought）；Event/Projection（Reflection Event / Conversation / Invitation / ContinueContext）不拥有认知权威语义。
2. **Interpretation 定位**：是认知对象的语义状态，**不是架构层**——禁止 Interpretation Layer / Service / Pipeline。
3. **Authority 定位**：认知对象意义归属语义，非 AI 权限控制。AI 生成 ≠ 用户认知纳入。
4. **Continuity 边界**：进入 Continuity ≠ 已成为用户认知；未 reject、可追溯、epistemic 明确的对象可参与。

**本 ADR 不重新讨论**（已被 ADR-0028 排除）：
- ❌ "Reflection 系统如何重构？"
- ❌ "是否新增 Interpretation 模块？"

**本 ADR 只回答**：
> Reflection 内部产生的内容，如何区分 Observation 与 Interpretation，并明确它们各自在 Mirror 中的生命周期。

它是 ADR-0028 留下的第一个消费方：Reflection 如何产生"可参与思考，但不夺取解释权"的内容。

---

## §1 逐问收敛（语义决议，已定方向）

> 纪律：本节只钉语义，不决定 schema 字段名/结构，不写代码。每个结论标注"是否影响存量数据"。

### Q1 — 什么属于 Observation？**【已收敛】**
**决议**：Observation = **可追溯材料上的结构化描述，不包含原因解释和主体意义判断**。
- ✅ 属 Observation：用户原话引用（"我不知道是否应该离开现在的岗位"）、行为模式统计（"过去五次反思中三次出现职业方向内容"）、时间趋势（"过去三个月多次回到同一主题"）。
- ❌ 不属 Observation：从"出现职业主题"跳到"你正在寻找人生方向"——已含意义判断，属 Interpretation。
- 冻结句：*Observation 描述"发生了什么、出现了什么、用户曾表达什么"，不回答"为什么发生"和"这意味着什么"。* 对应 ADR-0028 `epistemic_status = observed`。
- 影响存量：否（语义视图）。

### Q2 — 什么属于 Interpretation？**【已收敛】**
**决议**：Interpretation = **基于 Observation 的候选解释**，可含假设/因果/动机/趋势推演，但**不能定义用户身份**。
- ✅ 属 Interpretation："你可能正在重新评估职业方向"（假设）、"停滞感可能来自长期缺少反馈"（因果）、"你可能担心选择错误"（动机）、"若模式持续你可能继续推迟决定"（趋势推演）。
- ❌ 身份标签（禁）："你是一个害怕失败的人"→ 改写为"一个可能的解释是，当前犹豫与失败风险有关"。
- 冻结句：*Interpretation 可以解释状态，但不能定义用户身份。* 对应 ADR-0028 `epistemic_status = inferred`；`confidence` 仅作 inferred 内部属性。
- 影响存量：否。

### Q3 — 二者生命周期是否不同？**【已收敛：是，且修正表述】**
**决议**：必须不同（否则 ADR-0028 Authority 失效）。
- Observation：`capture → representation → continuity`（风险低，直进连续性）。
- Interpretation：`generation → review → accepted / rejected / superseded → (optional) representation`（候选意义，需审阅）。
- **修正**（采纳用户建议）：不写"Interpretation 默认不进 Representation"——ADR-0028 已定义 Interpretation 本身可是 Representation。准确表述：*Interpretation 可作为候选 Representation 存在，但是否成为用户认知结构的一部分需 adoption authority（待 schema 阶段定枚举）。*
- 影响存量：否。

### Q4 — 如何生成 Interpretation 而不固化？**【已收敛】**
**决议**：生成与固化分离。
- 链路：`Reflection Event → candidate Interpretation → user interaction → possible adoption`。
- 禁止：`AI 生成 → Representation` 直接固化（否则 AI 一句"你可能害怕失败"即成为关于用户的长期对象，违反 ADR-0028）。
- 影响存量：否。

### Q5 — Continuity 对二者处理是否一致？**【已收敛：读取同，呈现异】**
**决议**：**读取规则相同，呈现权重/语法不同**。
- 进入条件一致：可追溯 + epistemic 明确 + 未 reject（继承 ADR-0028 §1 Q6）。
- 呈现差异：
  - Observation 直述："你之前提到……"
  - Interpretation 必须带归属："之前一个可能的解释是……"，**禁止**伪装成事实（"你之前发现自己害怕失败"= 错误）。
- 影响存量：否（定义读取/呈现规则，不改数据）。

### Q6 — Questioner 消费什么？**【已收敛：防自循环】**
**决议**：两者可消费，角色不同。
- Observation = 问题依据（"你多次提到职业变化，我们继续看看这个主题"）。
- Interpretation = 待验证假设（"如果'害怕失败'不成立，还有什么因素？"），可挑战、**不继承身份判断**。
- 禁止闭环：`Interpretation → Question → Confirmation → User Fact`。
- 影响存量：否（语义边界，不设计 Questioner 实现）。

### Q7 — 用户修改 Interpretation 后如何处理？**【已收敛：C rejected 保留历史】**
**决议**：选 C（非 A 覆盖、非单纯 B 双候选）。
- 原 Interpretation `status = rejected` 保留；新 Interpretation `status = active`。
- 系统可知"曾考虑过什么、为何未继续"，服务 Continuity（与 ADR-0028 Q7 正交原则一致：reject 由 lifecycle status 承担，不污染 authority）。
- 影响存量：否。

### Q8 — Reflection 成功标准？**【已收敛】**
**决议**：指标 = **user self-clarification**，非 AI accuracy。
- 不是"用户接受 AI 解释"，而是"用户通过 Reflection 更清楚自己的判断过程"。
- Reflection 价值 = 增强用户自我解释能力，而非提供最终解释（与 ADR-0028 Authority 定位一致）。
- 影响存量：否。

---

## §2 收敛总结表（Semantic ACCEPTED）

| 问题 | 冻结方向 |
|---|---|
| Q1 Observation | 可追溯描述，不含意义解释 |
| Q2 Interpretation | 候选解释，不定义用户身份 |
| Q3 生命周期 | Observation 稳定性高直进；Interpretation 需审阅（可作候选 Representation，adoption 待定） |
| Q4 固化 | 生成 ≠ 纳入用户认知 |
| Q5 Continuity | 可读取，但呈现语法/归属不同 |
| Q6 Questioner | Observation 提供依据，Interpretation 提供待验证假设（禁自循环） |
| Q7 修正 | 旧 Interpretation 保留并标记 rejected |
| Q8 成功标准 | 增强自我解释，不提供最终解释 |

三项关键接口已稳定：**Q3 生命周期** / **Q5 Continuity 行为** / **Q6 Questioner 防自强化回路**。

---

## §3 Red lines（本 ADR 不重新开放 / 不违反）

| 约束 | Source | 对本 ADR 的含义 |
|---|---|---|
| Representation 边界 | ADR-0028 §1 | Reflection Event 是 Event，不持 authority；其产物可落为 Observation/Interpretation（Representation） |
| Interpretation 非架构层 | ADR-0028 §2 | 禁止 Interpretation Layer/Service/Pipeline；区分逻辑只落 Reflection/Representation/Continuity/Question 内 |
| Authority 非权限系统 | ADR-0028 §3 | Interpretation 生成 ≠ 用户认知纳入；adoption 待用户确认 |
| Continuity 可读未确认 | ADR-0028 §4 | Observation/Interpretation 未 reject 即可参与 Continuity，不要求 user_owned |
| Projection 不持权威 | ADR-0028 / ADR-0021 C | ContinueContext/Invitation 不反向持有 Observation/Interpretation 权威 |
| 不引入新架构层 | 优化主线纪律 | 区分是现有 Reflection 内部语义升级，非新层 |
| epistemic 描述性质非可信度 | ADR-0028 Q3 | confidence 仅 inferred 内部属性，不升级为权威 |

---

## §4 下一步（Schema DEFERRED）

1. **本阶段终点 = Semantic ACCEPTED（已达）**。语义边界冻结，不再修订 §1。
2. **Schema 表达草案推迟**（同 ADR-0028 节奏：不立即进入字段设计，避免未充分验证的认知模型固化成 DB 结构）。待启动时的纪律：
   - 只回答"如何表达已确定语义"（字段结构 / 枚举 / 校验规则）；
   - **不再讨论**：Observation/Interpretation 是否需区分、Interpretation 是否架构层、Continuity 是否读取未确认对象（均已冻结）；
   - adoption authority 状态枚举在 schema 阶段才审慎决定（本 ADR 仅锁定"需用户审阅"语义）；
   - 仍不动代码，仅落字段结构草案（可本文件续章或独立 ADR-0029-bis）。
3. 基于 schema 草案再评估是否需 Reflection/Continuity/Questioner 实现改动（届时另开实现 ADR）。

**与 ADR-0028 的关系**：本 ADR 是 ADR-0028 冻结后的第一个消费方语义审查。ADR-0028 定义"认知对象如何表达 source/epistemic/authority"，本 ADR 定义"Reflection 产物如何分给 Observation 与 Interpretation 并走各自生命周期"——二者共同构成 Mirror 认知数据语义地基的第一层。
