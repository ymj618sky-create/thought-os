# Concept: Interaction Evidence

**所属层**: `specs/concepts/`
**关联 Schema**: 扩展自 `specs/schemas/Evidence.schema.json`（见下文"与 Evidence 的关系"）
**关联 Constitution 条款**: Article 6（Mirror 是镜子不是裁判）、Event over Mutation 原则
**关联概念**: `Evidence.md`（用户原始材料）、`Reflection.md`（认知变化事件）、`Thought.md`（长期实体）、`Conversation_Orchestrator_Interface.md`（会话编排）

---


> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

## 1. 为什么需要这个概念

现有 `Evidence.md` 把 Evidence 严格定义为**用户的原始表达**（`source_type` 仅含 `chat_message / voice_transcript / uploaded_text / uploaded_file`，且 `additionalProperties: false`）。这落实了"不替用户产生 Judgment"的核心原则——值得保留。

但它留下一个缺口：**Mirror 的回复、Mirror 与用户的互动转折点，目前既不能被持久化为可追溯事件，也无法接入提取链路**。具体后果：

- `ConversationTurn`（user/mirror）只活在 `OrchestratorTurnInput.history` 的内存里，**不持久化**，认知形成失去原始时间轴。
- Mirror 的观察、假设、知识注入、行动建议，**全部没有落库**，只作为当轮回复文本消失。
- 提取链路（`Thought_Extraction_Protocol`）只从用户 Evidence 抽 Observation/Interpretation，缺失"Mirror 提问 → 用户顿悟"这类**互动触发**的记录。

于是出现一个悖论：若只存用户发言，认知链不完整——用户第一句话"我担心别人怎么看我"可能是线索，但真正形成 Thought 的，往往是 Mirror 提问后用户说的"我突然发现我一直在逃避选择"。**只保存用户发言会丢失思考过程。**

但反过来，也不能把所有聊天消息都塞进 Evidence——那会退化成聊天历史数据库，且违反"Mirror 不能冒充用户理解"。

## 2. 定位：Interaction Evidence 不是 Evidence 的替代品

```
Conversation Event   ← 完整对话时间轴（恢复上下文 / 认知演化溯源）
        │
        │  Extraction（选择性提取，不是全盘照搬）
        ▼
Interaction Evidence ← 与认知有关的"用户表达 / Mirror 刺激 / 互动触发"
        │
        ▼
Reflection Event     ← 一次认知变化事件（已有概念，不变）
        │
        ▼
Thought              ← 长期形成的理解（已有概念，不变）
```

- **Evidence（用户原始材料）**：逐字、不可变，是 Thought/Observation/Interpretation 的可追溯来源。**Interaction Evidence 不取代它。**
- **Interaction Evidence**：描述"Mirror 产生或 Mirror↔用户互动触发"的认知事件。它**引用** Conversation Event，但**不冒充用户表达**，也**不直接成为 Thought**。

## 3. Mirror 侧的四个来源子类

Interaction Evidence 按来源与性质分为四类。关键边界：**只有用户吸收 / 重新解释 / 关联自身之后，才进入 Thought Formation；Mirror 的来源本身不能直接生成 Thought。**

| 类型 | 来源 | 性质 | 能否进入 Thought | 示例 |
|---|---|---|---|---|
| **Mirror Observation** | AI | 客观注意到用户的模式（思考刺激） | 否（引用，不直接成 Thought） | "我注意到你最近多次提到自由" |
| **Mirror Hypothesis** | AI | 推测，置信度低 | **否**（严禁） | "也许你真正纠结的不是收入，而是不确定性" |
| **Knowledge Input** | AI | 外部世界知识注入 | 否（作为 external knowledge exposure） | "可以了解一下马斯洛需求层次" |
| **Action Guidance** | AI | 行为/规划支持 | 否（说明用户关注规划/执行） | "可以分三个阶段制定计划…" |

> **边界原则**：Knowledge Input 不能导致"用户形成了量子力学 Thought"——它只能作为知识暴露存在。只有当用户产生吸收、重新解释、关联自身的反应时，才进入 Thought Formation。这守住了 Thought OS 最重要的一条：**Mirror 可以参与形成理解，但不能冒充用户的理解。**

## 4. Conversation Message 的 Role + Type 维度

为了让 Conversation Event 不仅是文本日志，应给每条消息打两个维度（建议在 `ConversationTurn` / Conversation Event 模型上落地）：

```
ConversationMessage {
  id
  role:   user | assistant          // 谁说的
  type:   statement | question | knowledge | reflection | action | summary
  content
  metadata                            // 如关联的 Interaction Evidence id、触发的 Reflection id
}
```

- `role` 区分用户 vs Mirror。
- `type` 区分这条消息的认知性质（陈述 / 提问 / 知识 / 反思 / 行动 / 总结）。

这直接支撑"不应该把 Mirror 所有回复都当成事实"：一条 `assistant + knowledge` 消息是知识暴露，一条 `assistant + reflection` 是思考刺激，二者在下游处理（是否进 Thought、如何进 Graph）上路径不同。

> **Phase A 落地状态（已固化，见 Rethink_Refactor_Plan §16.x）**：Conversation Event 持久化已实现为「黑盒录像」——落库字段为 `id / conversation_id / user_id / role(user|assistant) / content / created_at / metadata`，`role` 维度已生效（`mirror` 在前端历史中统一落库为 `assistant`）。**`type` 维度暂不落地**：Phase A 只保存「发生过什么」，不做认知分类，避免提前引入 Judgment。Phase B（Memory / Identity / Graph 阶段）再做 Interaction Extraction 时再补 `type`。

## 5. 与现有 Evidence schema 的关系（待落地的扩展点）

当前 `Evidence.schema.json` 的 `source_type` 枚举与 `additionalProperties: false` 使得 Mirror 来源**无法写入**。补本概念时，建议（而非立即改动 schema）：

- 保留 `Evidence` 表的用户原始材料语义不变。
- 在 Conversation Event / Interaction Evidence 层引入 `role` + `source` 维度，`source ∈ { user, mirror_observation, mirror_hypothesis, knowledge_input, action_guidance, interaction }`。
- Interaction Evidence 通过 `conversation_event_id` 回溯到 Conversation Event，再通过其中的用户消息回溯到 Evidence（满足可追溯）。

> 此扩展属于数据模型调整，应在 Rethink_Refactor_Plan §16 的演化阶段落地，不在本 Concept 文档直接改 schema。

## 6. Non Examples（边界，防止未来数据混乱）

- **Mirror 的回复不写入 `Evidence` 表**（现有约束不变）——Mirror 内容既不是用户原始表达，也不满足"逐字不可变"的用户材料语义。
- **Interaction Evidence 不冒充 Thought**——Mirror Hypothesis 即便被用户部分认同，也需用户自己重新表达后才可能成为 Thought。
- **Conversation Event 不等于 Thought**——它是原始时间轴（类比浏览器 history），Evidence/Reflection/Thought 是其上的不同抽象层（类比 bookmarks / 长期理解）。

---

*本概念补的是当前模型中"Mirror 侧认知事件无落点"的缺口，与 Evidence / Reflection / Thought 三者兼容互补，不推翻既有冻结概念。*
