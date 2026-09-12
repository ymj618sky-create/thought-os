# Protocol: Conflict Detection

**所属层**: `specs/protocols/`
**执行者**: 独立于 Extractor 的冲突检测逻辑（消费 Extractor 产出的 Interpretation 候选，进行语义比对；可以是独立组件或另一个 agent 能力，**不得是 Extractor 自身**）
**范围声明**: 本协议只负责"发现并登记未化解张力"这一步——即：当一条新的 Interpretation 候选与用户已确认且当前有效的 Thought 在语义上冲突时，创建一条 `relation_type=challenges` 的待确认 Relation。**不负责**这条张力的后续确认/驳回/升级，那属于 `Confirmation_Protocol.md` 与 `Relation.md`「未化解张力」生命周期的范围。

> 本协议是为了填 `Relation.md` 第 66 行诚实标注的缺口而起草：冲突检测逻辑此前"没有正式的 capability/protocol 归属"，既不在 `Thought_Extraction_Protocol`（该协议止于 Interpretation 草稿），也不在 `Confirmation_Protocol`（只处理用户对已有候选的响应）。本协议把这段"系统"说法收口为可审查、可实现的步骤。

---


> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

## 调用时机（Invocation Trigger）

在 `Thought_Extraction_Protocol.md` 产出一条新的 `Interpretation` 候选 I（含 `confidence`、`evidence_ids`/`observation_ids`）之后，作为该候选的下游消费步骤运行一次。它**不是** Extractor 流程的一部分（Extractor 的 `capability.md` 第 33 行明确"不合并/不判断 Relation"），而是"Extractor 产出 I → 本逻辑判断 I 与既有 Thought 是否冲突"中的第二步。

---

## 流程

```
Input: 一条新生成的 Interpretation 候选 I（status=pending，user_id=U）
  ↓
Step 1 — Load Established Thought Set
  查询 user_id=U 且 status=active 的 Thought 集合 T_set
  （这些是用户此前已确认/已派生的有效思想，是比对的"既有信念库"；
   已 archived / superseded 的 Thought 不纳入比对，避免对已废弃观点重复报警）
  ↓
Step 2 — Pairwise Conflict Assessment
  对 T_set 中的每条 Thought T，判断 I 是否在语义上与其构成矛盾/冲突
  这是一个推断步骤（AI 建议，非定论）——符合 Article 5：可以"建议/总结"，
  但不得"判定"。输出候选冲突对集合 C = {(I, T, conflict_confidence, rationale)}
  ↓
Step 3 — Confidence Gating（S-6.1）
  对每个候选冲突对：必须给出 conflicts_confidence ∈ [0,1]
  若对某一对无法给出置信度 → 该对不创建 challenges 关系，直接丢弃
  （与 capability.md 失败行为一致：无法给置信度就不得生成，绝不用默认值敷衍）
  ↓
Step 4 — Evidence / Rationale Linkage（S-9.3）
  每个候选挑战关系必须携带 evidence_ids：
  至少继承 I 自身的 evidence_ids / observation_ids 作为依据，
  并在 rationale 中写明"为什么觉得 I 与 T 冲突"，供用户核验 AI 的判断
  ↓
Step 5 — Dedupe Guard
  若已存在 from_id=I.id、to_id=T.id、relation_type=challenges 且
  status∈{pending, confirmed} 的记录 → 跳过，不重复创建
  ↓
Step 6 — Emit challenges Relation(s)
  对通过上面所有门槛的每个冲突对，创建一条：
    relation_type = challenges
    origin_type   = ai_suggested
    status        = pending
    from_id / from_type = I.id / interpretation
    to_id  / to_type    = T.id / thought
    confidence   = 该对的 conflict_confidence（可继承 I 的 confidence，
                   也可独立估算，二者皆可，但不得为空——对齐 batch002 的 REL-CHALLENGES-001）
    evidence_ids = 依据证据（见 Step 4）
  ↓
Output: 零条或多条 status=pending 的 challenges Relation（登记为"未化解张力"）
```

---

## 关键约束

- **只产出 `challenges`，不产出其他关系类型**：本协议是唯一允许创建 `challenges` 关系的协议。它**绝不**直接创建 `contradicts` / `supports` 等终态关系——那些是用户对 `challenges` 确认后、由 `Confirmation_Protocol.md` 升级流程新建的（见 `Relation.md` 生命周期第 3 步）。冲突检测若越权直接写 `contradicts`，等于 AI 单方面判定矛盾成立，违反 Article 5 与 S-2.2。
- **不改动被挑战的 Thought**：目标 Thought T 的 `status` 不受本流程影响，保持 `active`（对齐 batch002 REL-CHALLENGES-001 预期结果）。张力是叠加在 T 之上的信号，不是对 T 的修正。
- **不改动 Interpretation I 本身**：I 仍是 `status=pending` 的候选；它的确认/驳回完全由 `Confirmation_Protocol.md` 处理。本协议只"借用"I 作为 challenges 关系的起点，不替用户决定 I 的命运。
- **confidence 非空**：与 `Relation.schema.json` 中"ai_suggested + pending 必填 confidence"一致；缺失则不得创建该关系。
- **evidence_ids 非空**：与 S-9.3 一致，AI 建议的关系必须可核验"为什么觉得冲突"。

---

## 明确排除的步骤（Non-Responsibility）

- **不确认、不驳回、不升级**：任何把 `challenges` 从 `pending` 推向 `rejected`/`confirmed`/`superseded` 的动作都不属于本协议（归属 `Confirmation_Protocol.md` + `Relation.md` 生命周期）。本协议在 Step 6 写出 `pending` 记录后即结束职责。
- **不处理非 Interpretation 来源**：只对 Interpretation 候选做冲突检测；Observation 是客观可核验陈述，本身不承载可冲突的推断，不在比对发起方范围（即便 Observation 与某 Thought 看似不合，也需先形成 Interpretation 才能进入本流程）。
- **不比对 Interpretation 与 Question / 与另一条 Interpretation**：目标集合严格是 `status=active` 的 Thought（`Relation.schema.json` 中 `challenges` 的 `to_type` 固定为 `thought`，见 `Relation.md`）。
- **不做最终判定**：输出一律停留在 `ai_suggested` + `pending`，是"系统觉得这里有张力"的建议，而非"这里确实有张力"的结论——最终解释权在用户。
- **不触发 Thought 创建**：派生 Thought 是用户在 `Confirmation_Protocol.md` 中主动触发的独立动作，本协议无此职责。

---

## 与既有文档的关系

- **上游**：`Thought_Extraction_Protocol.md` + `(private agent capability)` —— 产出 Interpretation I；Extractor 明确"不判断 Relation"，本逻辑承接这部分职责。
- **下游**：`Confirmation_Protocol.md` + `Relation.md`「未化解张力」—— 消费本协议产出的 `pending` challenges 关系，按四态生命周期推进（驳回→rejected 留痕 / 确认存为 Thought→升级 contradicts 并 superseded 原记录 / 确认不存→confirmed 长期保留）。
- **评测对齐**：本协议产出的 `pending` challenges 记录，由 `specs/evaluation/cases/batch002-relation-evolution.md` 的 `REL-CHALLENGES-001` 直接断言其字段；后续三态由 `REL-CHALLENGES-002/003/004` 断言。本协议的实现若与这些断言冲突，视为实现 bug，应回退至 `Relation.md`，而非反向改 eval。

---

*本文档遵循 Article 5（AI 可以观察/建议/总结，不可判定/宣布）、Article 8（区分 Evidence/Observation/Interpretation，张力发起方是 Interpretation 而非 Evidence）、Article 12（关系的演化是最有价值的成长信号，故冲突检测只"登记"不"判定"）、以及 `specs/specifications/v0.1.md` 中的 S-6.1（推断必须标注置信度）、S-2.2（AI 不得单方面定案）、S-9.3（AI 建议的关系必须可核验）、S-4.1（状态变更优先于物理删除）。*
