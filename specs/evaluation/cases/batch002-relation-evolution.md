# Evaluation Cases — Batch 002 (Relation / Confirmation Protocol，系统行为层)

**所属层**: `specs/evaluation/cases/`
**测试对象**: `specs/protocols/Confirmation_Protocol.md` + `specs/concepts/Relation.md` 定义的状态机，**不是任何 Prompt**
**与 batch001 的区别**: batch001 测的是"模型输出是否遵守宪法"（需要真的调用 LLM）；本批测的是"系统实现是否正确执行了协议里定义的状态转换"（可以纯代码断言，不需要调用任何模型）。两者测试对象不同，混在一起会让"这条用例到底在测 Prompt 还是在测后端逻辑"变得含糊，故拆成独立文件。

---

## REL-CHALLENGES-001 — 张力产生：Interpretation 冲突时创建 pending challenges

- **对应规则**: Relation.md「未化解张力」生命周期第 1 步
- **前置条件**: 用户已有一条 `status=active` 的 Thought T1（内容："我认为稳定的工作最重要"）。Extractor 对新的 Conversation 生成一条 Interpretation I1，内容与 T1 冲突（"这似乎说明，你现在其实更看重自由而不是稳定"）。
- **操作**: 系统判定 I1 与 T1 冲突，触发张力产生流程。
- **assertion**: 应存在一条新 Relation 记录 R1，满足：`relation_type=challenges`、`origin_type=ai_suggested`、`status=pending`、`from_id=I1.id`、`from_type=interpretation`、`to_id=T1.id`、`to_type=thought`、`confidence` 为非空数值（继承自 I1 或独立判定，两种实现皆可，但不得为空）。
- **预期结果**: R1 存在且字段齐全；此时 T1 本身的 `status` 不受影响，仍为 `active`（张力的产生不改变被挑战的 Thought 本身的状态）。

---

## REL-CHALLENGES-002 — 驳回：张力消失但留痕，不物理删除

- **对应规则**: Relation.md「未化解张力」生命周期第 2 步
- **前置条件**: 承接 REL-CHALLENGES-001 的 R1（`status=pending`）。
- **操作**: 用户对 I1 执行"不是，其实是…"（驳回）。
- **assertion**: I1 的 `status` 变为 `rejected`；R1 的 `status` 同步变为 `rejected`；R1 记录本身**依然存在于数据库中**，可被查询到，不因驳回而被物理删除。
- **反例（应判为失败的实现）**：驳回后直接对 R1 执行 DELETE，导致 R1 无法再被查询到——这违反 S-4.1 的精神（保留审计轨迹），即便 Relation.md 没有把 challenges 单独列为"禁止物理删除"的清单，也应比照 Thought/Interpretation 的一贯做法处理。
- **预期结果**: R1 可查询到，`status=rejected`。

---

## REL-CHALLENGES-003 — 确认且存为 Thought：新建 contradicts，旧记录 superseded_by 指向新记录

- **对应规则**: Relation.md「未化解张力」生命周期第 3 步
- **前置条件**: 承接 REL-CHALLENGES-001 的 R1（`status=pending`），T1 如前。
- **操作**: 用户对 I1 选择"认同，存起来"，触发从 Interpretation 派生 Thought 的流程（见 `Confirmation_Protocol.md`），生成新 Thought T2（内容改写为陈述句："我现在更看重自由而不是稳定"）。
- **assertion（关键，最容易被实现错的一条）**:
  1. 必须存在一条**全新**的 Relation 记录 R2，满足 `relation_type=contradicts`、`from_id=T2.id`、`to_id=T1.id`（或反向，方向不强制但两端必须都是 Thought）、`status=confirmed`。
  2. 原记录 R1 的 `relation_type` 字段**必须保持为 `challenges`，不得被原地改写成 `contradicts`**——这是最容易犯的实现错误（图省事直接 UPDATE 一行）。
  3. R1 的 `status` 变为 `superseded`，`superseded_by` 字段的值等于 R2 的 `id`。
- **反例（应判为失败的实现）**：只有一条 Relation 记录，`id` 不变，`relation_type` 从 `challenges` 被直接 UPDATE 成 `contradicts`——这样虽然最终状态"看起来"对，但丢失了"这段关系曾经是未确认张力、后来才升级"这条演化轨迹，查询 R1 的历史会发现它从来没有以 `challenges` 状态存在过，违反 Article 12。
- **预期结果**: 数据库中同时存在 R1（`challenges`, `superseded`）和 R2（`contradicts`, `confirmed`）两条独立记录。

---

## REL-CHALLENGES-004 — 确认但不存为 Thought：长期保留为一等信号，不得被当作临时态清理

- **对应规则**: Relation.md「未化解张力」生命周期第 4 步
- **前置条件**: 承接 REL-CHALLENGES-001 的 R1（`status=pending`）。
- **操作**: 用户对 I1 选择"认同，先不存"。之后模拟运行一次假设中的"清理陈旧待处理项"的后台任务（如果系统实现了这类任务）。
- **assertion**:
  1. I1 的 `status` 变为 `confirmed`；R1 的 `status` 同步变为 `confirmed`，**不触发**任何 Thought 创建流程。
  2. 假设存在的后台清理任务，其清理范围的查询条件**不得**匹配到 `relation_type=challenges AND status=confirmed` 的记录——清理任务如果写成"清理 N 天未处理的 challenges"，其筛选条件必须显式排除 `status=confirmed`（只能清理 `status=pending` 且确实长期无人处理的记录）。
- **反例（应判为失败的实现）**：后台任务用"关系创建时间超过 30 天"作为唯一清理条件，未区分 `status`，导致 R1 被误当作"过期未处理"清理掉——这直接违反 Relation.md 里"这个状态需要被明确当作一等公民对待"的要求。
- **预期结果**: R1 长期存在，`status=confirmed`，不被任何清理逻辑触碰。

---

## REL-S082-001 — 矛盾 Thought 允许共存，系统不得强制合并或覆盖

- **对应规则**: S-8.2
- **前置条件**: 用户已有两条 `status=active` 的 Thought：T1（"我认为稳定的工作最重要"）、T2（"我认为自由比稳定更重要"），两者之间存在一条 `relation_type=contradicts`、`status=confirmed` 的 Relation R2（可直接复用 REL-CHALLENGES-003 的产出状态）。
- **操作**: 模拟正常的后续使用——用户继续书写、Extractor 继续运行、系统执行任何常规的整理/归档流程。
- **assertion**:
  1. T1 与 T2 的 `status` 均应保持 `active`，系统不得因为存在 `contradicts` 关系就自动将其中一条改为 `archived` 或 `superseded`。
  2. 不存在任何自动合并逻辑把 T1、T2 的 `content` 拼接或改写成一条"折中版" Thought。
  3. 查询用户的完整 Thought 列表，T1 与 T2 必须同时出现，且两者都可独立被引用（如被其他 Relation 指向、被其他 Interpretation 引用为 evidence 之外的上下文）。
- **反例（应判为失败的实现）**：系统检测到两条 active Thought 存在 `contradicts` 关系后，自动弹出"这两条矛盾，请选择保留哪一条"的强制二选一交互，且不选择就无法继续使用——这违反 S-8.2 明确要求的"允许矛盾长期共存"。
- **预期结果**: T1、T2 均为 `active`，长期共存，无强制二选一。

---

## 判定汇总表

| Case ID | 规则 | 判定方式 | 状态 |
|---|---|---|---|
| REL-CHALLENGES-001 | Relation.md 张力生命周期①产生 | deterministic（数据断言） | 未运行 |
| REL-CHALLENGES-002 | Relation.md 张力生命周期②驳回 | deterministic（数据断言） | 未运行 |
| REL-CHALLENGES-003 | Relation.md 张力生命周期③升级 | deterministic（数据断言） | 未运行 |
| REL-CHALLENGES-004 | Relation.md 张力生命周期④确认不存 | deterministic（数据断言） | 未运行 |
| REL-S082-001 | S-8.2 | deterministic（数据断言） | 未运行 |

**运行方式说明**：这 5 条不需要调用任何 LLM，是纯粹的后端逻辑/数据库状态断言——可以在 Confirmation_Protocol 的具体实现代码写出来之后，直接作为单元测试/集成测试跑，比 batch001 更容易自动化，建议在实现 Mirror 后端时优先把这 5 条接入 CI，作为回归测试的第一批。

---

*本文档遵循 `specs/specifications/v0.1.md` 中的 S-8.2，以及 `specs/concepts/Relation.md`「未化解张力」一节定义的状态机。任何实现与本文档断言冲突，视为实现层 bug，应回退至 `Relation.md`/`Confirmation_Protocol.md`，而非反向修改这两份文档以迁就实现。*
