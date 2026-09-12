# Protocol: Confirmation

**所属层**: `specs/protocols/`
**范围**: 定义所有"AI 生成、需要用户回应"的节点（Observation、Interpretation、Relation）如何根据用户动作变更状态，以及 Thought 如何从被确认的 Interpretation 派生——这是唯一负责"创建 Thought"这一步的协议。

---


> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

## 流程（通用部分）

```
Input: 一个 status=pending（或 active，对 Observation 而言）的候选 + 用户动作
  ↓
Step 1 — Present with Full Context
  呈现候选内容时必须同时呈现：内容本身、（若有）置信度、可追溯的来源链接
  批量呈现允许，但每一项必须可独立操作，禁止"一键全部接受"作为唯一入口
  ↓
Step 2 — Wait for Explicit Action
  未操作 = 保持 pending/active，不因超时或不活跃自动流转为 confirmed
  （违反此条即违反 S-2.2：AI 不得单方面定案，沉默不能被系统解读为同意）
  ↓
Step 3 — Branch by Action
  见下方各节点类型的具体分支
```

## 分支：Observation

- **用户忽略** → 保持 `active`，允许在其他分析中继续被引用为背景观察（因为客观陈述本就不需要确认才能成立）。
- **用户驳回** → `status=dismissed`，记录 `dismissed_at`；此后不得在任何输出中继续引用这条被驳回的观察作为前提。

## 分支：Interpretation

呈现给用户时提供**三个并列选项**（合并为单一交互，而非"确认→再单独一步问是否存为 Thought"的两屏流程）：

- **认同，存起来** → `status=confirmed`，记录 `confirmed_at`；同时立即触发下方"从已确认的 Interpretation 派生 Thought"流程。
- **认同，但先不存** → `status=confirmed`，记录 `confirmed_at`；**不**触发派生 Thought 流程，用户认同这个观察是对的，但暂时不想把它固化为长期思想。
- **不是这样，其实是…** → `status=rejected`，打开一个输入框收集用户的真实说法；此后不得在任何输出中继续将其作为已确立的前提使用。

**这个合并为什么不违反 Article 6**：Article 6 要求的是用户拥有最终决定权，不是要求决定权必须拆成两次点击才算数。只要"认同但先不存"这个选项在界面上与"认同并存起来"权重相同、不是被默认勾选或藏在次级菜单里，用户依然是在明确地做出选择，只是把两次交互合并成了一次三选一。真正需要杜绝的是"用户点了认同，系统就默认帮他决定要不要存"——只要"先不存"这个选项始终可见、可选、不被默认，合并本身不构成违规。

- **用户编辑后确认，仅涉及措辞/时态调整**（如把"这或许说明…"改写成陈述句）→ 视为正常确认流程的一部分，`origin_type` 保持 `derived_from_interpretation`。
- **用户编辑后确认，但实质性改变了论断内容**（不只是措辞，而是换了一个说法）→ **不得**视为原 Interpretation 的确认。正确处理方式：原 Interpretation 标记为 `rejected`（因为 AI 提出的说法实际上没有被采纳），用户新写的内容作为 `origin_type=user_authored` 的全新 Thought 创建。这条规则是为了保证溯源诚实——不能让"用户几乎重写了一遍"的内容挂着"AI 解释被确认"的名义留在系统里。

**与 Relation 的联动**：若该 Interpretation 附带一条 `relation_type=challenges` 的 Relation（见 `Relation.md` 的"未化解张力"），需按其生命周期同步处理——驳回时该 Relation 一并 `rejected`；确认且存为 Thought 时，该 Relation 被新的 `contradicts` 关系 `superseded`；确认但不存为 Thought 时，该 Relation 保持 `confirmed`。

## 分支：Relation

- 与 Interpretation 相同的确认/驳回逻辑，额外说明：一条 Relation 被 `confirmed` 不影响它连接的两个节点各自的状态（例如两条 Thought 被标记为 `contradicts` 并不会让其中任何一条自动变成 `superseded`——矛盾允许共存，遵循 S-8.2）。

## 分支：Question

仅 `origin_type=ai_suggested` 的 Question 需要经过本分支——与 Interpretation/Relation 一致，它在 AI 提出的那一刻就已创建为 `status=pending` 的真实记录，而不是等用户确认后才创建。`origin_type=user_authored` 的 Question 创建时直接是 `open`，不经过本分支。

- **用户确认**（"这个问题问得好，帮我记下来"）→ `status` 从 `pending` 变为 `open`。
- **用户驳回**（"不用了"）→ `status` 从 `pending` 直接变为 `archived`。**不新增 `rejected` 值**——Question 的状态集合刻意保持精简（`pending`/`open`/`archived` 三态），被驳回的建议和被主动收起的问题复用同一个 `archived` 语义已经足够，不必比照 Interpretation/Relation 的四态机械照搬。
- **用户忽略**（不表态）→ 保持 `pending`，不因超时自动流转到 `open` 或 `archived`（与 S-2.2 一致：沉默不构成同意，AI 不得替用户把"没回应"解读成任何一种决定）。

## 独立步骤：从已确认的 Interpretation 派生 Thought

这是一个**用户主动触发的、与"确认 Interpretation"分开的动作**（例如界面上"确认"和"存为 Thought"是两个不同的按钮，不能合并）：

```
Input: 一条 status=confirmed 的 Interpretation + 用户发起的"存为 Thought"动作
  ↓
Step 1 — Rewrite as Declarative
  将 Interpretation 的推测性措辞转写为陈述句（不得直接照搬原文语气，见 Thought.md）
  此步骤的转写结果需再次呈现给用户做最终确认（防止转写引入偏差）
  ↓
Step 2 — Create Thought
  origin_type = derived_from_interpretation
  origin_interpretation_id = 该 Interpretation 的 id
  evidence_ids = 继承自该 Interpretation 的 evidence_ids（若为空，则需回退调用
                 Evidence_Linking_Protocol 重新建立，不得留空）
  confirmed_at = 用户执行本步骤的时间（不是 Interpretation 被确认的时间）
  ↓
Output: 新建的 Thought 记录
```

## 为什么"先不存"必须与"存起来"同等醒目

用户可能认同一个观察是对的，但并不想把它作为长期思想记录下来（例如"对，这个说法没错，但我不需要一直记着这件事"）。如果界面上"认同并存起来"是主按钮、"先不存"是弱化的小字链接，等于用视觉权重替用户做了决定，这仍然是一种隐性的判定权侵占，违反 Article 6。三个选项必须视觉权重相当，用户选择的成本必须一样低，合并交互步骤才不会退化成"变相的自动确认"。

---

*本文档遵循 Article 6（用户拥有修改/拒绝/删除/回滚的最终决定权）与 `specs/specifications/v0.1.md` 中的 S-2.2（AI 不得单方面定案）。*
