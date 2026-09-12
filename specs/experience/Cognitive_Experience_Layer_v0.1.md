# Thought OS Cognitive Experience Layer v0.1

**所属层**: `specs/experience/Cognitive_Experience_Layer_v0.1.md`
**层级关系**: Constitution → `specs/specifications/v0.1.md`（行为规则，含 S-x.x）→ **本文件（领域体验规范）** → `specs/concepts/`、`specs/schemas/`、`(private agent capability)` → 实现。
**Article 0 审查**: 本文件**不引入任何新的认识论实体**（Thought / Observation / Interpretation / Evidence / Question / Relation 之外的新类型）。它只定义"六实体模型之上的派生 / 只读视图层"及其呈现规则。任何"新增实体"提案须先能回答内核剃刀（"删掉它系统会失去什么"），且不得在本文件内悄悄落地。
**状态**: Draft v0.1
**日期**: 2026-07-30

---

## 0. Design Goal

### 不做什么

不是：

- AI 分析报告；
- 心理测试结果；
- 人格画像；
- 自动评判系统。

避免让用户产生：

> "AI 在研究我。"

### 要做什么

让用户产生：

> "我终于看清了自己的想法。"

这是 Thought OS 的核心体验。

---

## 1. Cognitive Experience Layer 总体结构

用户层：

```
Conversation
      |
      ↓
Reflection
      |
      ↓
Cognitive Artifacts
      |
      ↓
Personal Cognitive History
```

其中：

- **Conversation**：自然聊天入口。
- **Reflection**：每次对话后的认知整理。
- **Cognitive Artifacts**：用户真正看到和保存的东西。
- **Personal Cognitive History**：长期形成个人认知轨迹。

---

## 2. 四类核心 Cognitive Artifacts

第一版不应该太多。建议只保留四个。

### Artifact 1：Thought Map（思考地图）

**目的**：帮助用户看到"我到底在想什么？"

例如：

> 用户：我想离开现在公司。
> 系统生成：
> ```
> 离职问题
>         ┌── 工作满意度
>         │
>         ├── 成长需求
>         │
>         ├── 经济安全
>         │
>         └── 未来方向
> ```

**注意**：不是"你应该离职"，只是"你的想法结构"。

**用户价值**：从"一团混乱的感觉"变成"一个可以观察的结构"。

### Artifact 2：Belief Map（信念地图）

这是 Thought OS 的核心差异点。

不是记录"用户喜欢什么"，而是记录"用户如何理解世界"。

例如：

> 过去：成功 = 获得社会认可
> 后来：成功 = 创造长期价值
> 系统显示：你的一个重要观点发生变化：
>   过去：外部评价驱动
>   现在：内部价值驱动

这里产生长期价值。因为 ChatGPT 可以回答问题，但无法自然形成"用户思想演化史"。

### Artifact 3：Conflict Map（认知冲突地图）

这是最符合 Mirror 精神的部分。

**核心原则：不解决冲突，呈现冲突。**

例如：

> 用户：我想创业，但是害怕失败。
> 显示：
> ```
> 探索欲
>    ↑
>    |
>    |
> 安全需求
> ```
> 系统：你当前同时重视（1）自由探索 （2）稳定保障。目前没有必要立即选择其中一个。

这对应 Constitution：Mirror 不产生 Judgment。

### Artifact 4：Reflection Summary（思考摘要）

这是最高频入口。每次重要对话结束生成。

格式：

```
本次思考
主题：职业选择
我理解到：你关注的不只是工作本身，而是成长感和自主性。
当前张力：自由探索 vs 稳定生活
尚未回答的问题：如果没有失败风险，你真正想尝试什么？
```

**注意**：不是总结聊天，是总结认知变化。

---

## 3. Cognitive Experience 的交互原则

### 原则一：用户永远拥有解释权

系统不能说：

> ❌ "你的核心问题是逃避。"

应该说：

> ✅ "一个可能存在的角度是……"

### 原则二：所有洞察允许修改

例如：

> 系统生成：你的重要价值：自由
> 用户可以：[修改] 我认为不是自由，而是创造。

因为：Thought OS 不是建立 AI 对用户的模型，而是帮助用户建立自己的模型。

### 原则三：避免心理诊断感

禁止：

> 你属于回避型人格。

允许：

> 过去几次讨论中，你多次提到对确定性的需求。

---

## 4. 首页设计

不是 Chat 页面。应该是：

```
Thought OS
今天想整理什么？
----------------
继续昨天的思考
○ 职业方向
○ 创业想法
○ 人际关系
开始新的思考
[ 输入 ]
```

---

## 5. 用户主页（Personal Cognitive Space）

这是区别 ChatGPT 的核心。类似"我的思想空间"。

结构：

```
我的思考空间
最近关注：职业 / 创造 / 关系
长期价值：创造 > 稳定
持续探索：如何建立长期方向
最近变化：从寻找答案 转向 寻找方向
```

---

## 6. Cognitive Timeline（思想时间线）

非常重要。因为"成长感"来自变化。

例如：

```
2026.07  讨论：是否创业
         发现：真正关注的是自主性
2026.08  讨论：新的职业机会
         变化：开始接受渐进式探索
```

---

## 7. 与 ChatGPT 的产品差异

| 维度 | ChatGPT | Thought OS |
|---|---|---|
| 核心 | 回答问题 | 理解思考 |
| 关系 | 即时 | 长期 |
| 价值 | 信息 | 认知成长 |
| 记忆 | 上下文 | 个人认知资产 |
| 输出 | 答案 | 洞察 |
| 目标 | 解决问题 | 帮助形成自我理解 |

---

## 8. MVP 中哪些必须实现

**第一阶段必须**：

- ✅ Conversation
- ✅ Reflection Summary
- ✅ Thought Map（简单版）
- ✅ Cognitive Timeline

**暂缓**：

- ❌ 复杂三维认知图
- ❌ 人格模型
- ❌ 社群认知网络
- ❌ 职业专家空间

---

## 9. 最核心的一句话

Thought OS 不应该让用户感觉"我正在使用一个复杂的认知系统"，而应该让用户感觉"这是第一个真正帮我理解自己的工具"。

---

*到这里，Thought OS 的产品结构基本形成：*

```
                User Experience
              Cognitive Surface
                    |
     --------------------------------
     Reflection  Map  Timeline  Conflict
                    |
              Thought OS Kernel
     Twelve Lattice
     Thinking Protocol
     Runtime
     Orchestrator
```

下一步进入 **Chapter 3：核心交互流程（Conversation → Reflection → Cognitive Artifact Loop）**——这一章直接决定 MVP 的界面与开发优先级。

---

# Chapter 3 — 核心交互流程（Conversation → Reflection → Cognitive Artifact Loop）

> 本章的统领约束（见文件头 Article 0 审查）：**Cognitive Experience Layer 是六实体模型之上的"派生 / 只读视图层"。它最多只新增一种持久记录（Reflection Session：一次反思的指针 + 时间窗 + 产物 id 列表），绝不新增 Thought / Observation / Interpretation / Relation 之外的认识论实体。** 该约束同时锁死 S-4.2（schema 不得有画像/标签字段）与 Article 27（规范高于实现）。

本章分两部分：§3.1–§3.11 为**体验叙事**（用户实际感知到的闭环），§3.12 为**实现映射**（将每一步锚定到现有 6 实体模型、模块与 ADR，以及 S-3.4 闭环规则）。

## 3.1 核心体验闭环

Thought OS 的基本循环：

```
用户输入
    ↓
Conversation
    ↓
理解与探索
    ↓
Reflection
    ↓
生成认知产物
    ↓
用户确认 / 修正
    ↓
沉淀个人认知历史
    ↓
下一次对话继续演化
```

核心不是一次回答。而是：**每一次交流，都让用户对自己多理解一点。**

## 3.2 Conversation Layer（对话层）

**目标**：降低表达门槛。

用户不需要知道：

- 我要建立什么模型；
- 我要分析什么问题。

只需要：说出现在脑中的东西。

**初始状态示例**：

> 用户：最近感觉工作越来越没意思。
> 普通 AI：可能直接给"工作倦怠分析 / 职业建议"。
> Thought OS：进入 **Understanding Mode**。

AI：

> 我想先理解一下，这种"没意思"更接近哪一种？
> A. 工作内容本身没有兴趣
> B. 感觉没有成长空间
> C. 环境和人际关系消耗很大
> D. 说不上原因，只是长期疲惫

这里使用 **Questioner Gate** 与 **Intent Clarification**。但用户感受到的是："它在认真理解我的问题。"

## 3.3 Conversation 内部状态转换

内部（用户无感）：

```
Input
  │
  ▼
Questioner Gate
  │
  ▼
Observe
  │
  ▼
Extract
  │
  ▼
Generate
  │
  ▼
Commit
```

**注意**：这里不改变 Orchestrator。Conversation Layer 只是用户体验入口。

## 3.4 Reflection Layer（反思层）

这是 Thought OS 的关键。

普通聊天：结束即结束。Thought OS：结束后进入"这次交流留下了什么？"

**Reflection Trigger（触发条件）**：不是每句话生成，否则体验会很重。触发：

- 用户主动结束；
- 重要主题出现；
- 对话达到一定深度。

示例：

> 用户：今天先聊到这里。
> 系统：我可以帮你整理一下今天思考中比较重要的部分。
> 按钮：[生成我的思考记录]

## 3.5 Reflection Output

不是聊天总结。

区别：

- 聊天总结：你说了 A、B、C。
- Reflection：你的思考结构发生了什么。

输出示例：

```
本次思考记录

主题
职业方向探索

当前关注
你反复提到：
* 成长感
* 创造空间
* 长期价值

可能存在的张力
稳定收入  VS  自主探索

尚未明确的问题
如果不用立即改变现状：你愿意尝试什么小规模探索？
```

注意：没有"建议你创业"。

## 3.6 User Confirmation Layer（用户确认层）

这是非常重要的一步。AI 不能直接写入用户认知。

流程：

```
AI 提出理解
      ↓
用户确认
      ↓
形成 Cognitive Artifact
```

示例：

> AI：我观察到，你似乎越来越重视创造价值，而不是单纯收入。
> 按钮：[符合我的想法] [部分符合] [不是这样]

用户选择"部分符合" → "哪部分需要调整？"

这一步非常重要。因为：Thought OS 的模型不是"AI 建模用户"，而是"AI 协助用户建立自我模型"。

## 3.7 Cognitive Artifact Layer

确认后生成：

**Thought Node**

```
{
  "type": "thought",
  "topic": "职业",
  "content": "希望拥有更多创造空间",
  "confidence": "user_confirmed"
}
```

**Conflict Node**

```
{
  "type": "conflict",
  "left": "稳定",
  "right": "探索",
  "status": "open"
}
```

**Question Node**

```
{
  "type": "question",
  "content": "什么样的生活值得长期投入？",
  "status": "unresolved"
}
```

这些才是未来 Personal Cognitive Model 的基础。

## 3.8 Next Session Continuity（连续体验）

这是击败普通聊天产品的关键。

一个月后：

> 用户：最近工作又让我很烦。
> 普通 AI：重新开始。
> Thought OS：读取
>   历史主题：职业方向
>   最近状态：持续关注成长感
>   未解决：稳定 vs 探索
> AI：上次我们讨论过，你的不满似乎不仅来自工作压力，也和成长感有关。最近变化主要发生在哪部分？

用户感觉："它认识我。"这才产生长期价值。

## 3.9 MVP 产品流程图

```
              用户
               │
               ▼
        Chat Conversation
               │
               ▼
        Reflection Trigger
               │
               ▼
        Reflection Summary
               │
               ▼
      User Confirmation
               │
               ▼
     Cognitive Artifact Store
               │
               ▼
    Personal Cognitive Timeline
```

## 3.10 第一版开发优先级

**P0（必须）**：

- Chat（已有基础）；
- Reflection Generator（核心差异）；
- Artifact Storage（哪怕简单 JSON，实际已由 6 实体 Storage 提供）；
- Timeline View（让用户看到积累）。

**P1**：

- Thought Map；
- Conflict Map；
- Belief Evolution。

**P2**：

- 复杂认知可视化。

## 3.11 一个重要产品判断

Thought OS 的核心 Loop 不是：

```
Question → Answer
```

而是：

```
Experience
      ↓
Reflection
      ↓
Self Understanding
      ↓
Better Experience
```

这也是它与 ChatGPT 最大的产品差异。

---

## 3.12 实现映射（到现有模块、规范与 ADR）

> 本节将 §3.1–§3.11 的体验叙事逐项锚定到 Thought OS 已有的 6 实体数据模型、服务模块与 ADR，并明确 S-3.4 的闭环规则。目的：不让体验层漂移到"与 Kernel 平行的产品模型"——任何呈现都必须是 6 实体的派生 / 只读视图。

### 3.12.1 主循环状态机（技术版）

```
[首页 Landing]  ──选择/新建──▶  [Conversation 会话]
                                      │
                          Runtime 决策中心（continue / stop / switch）
                                      │
                          stop / switch / 用户主动结束
                                      ▼
                            [Reflection 反思]
                       （确认未决节点 + 生成 Artifact）
                                      │
                         用户 [修改] / [丢弃] / [确认]
                                      ▼
                   [Cognitive Artifacts 入库] ──▶ [Personal Cognitive History]
                                                      │
                                              (下次 Landing 的"继续/变化")
```

关键点：Reflection 不是新对话，而是对本次会话产生的新实体做"确认 + 聚合"。它直接复用已有的"发现"面板（confirm / skip / reject）与 S-2.3（AI 节点可逆）的确认流。

### 3.12.2 每一步映射到现有模块

| 体验步骤（§3.x） | 现有零件 | 状态 |
|---|---|---|
| Conversation 入口（§3.2/§3.3） | `conversation/Orchestrator`（先回复、后台抽取）、`PendingSlotStore` / `StalledPromptStore`（会话 / 续写）、Questioner / IntentResolver | 已有基础；需补选项式澄清的呈现 |
| 内部状态转换（§3.3） | Orchestrator 流程：Observe → Extract → Generate → Commit | 不改变 Orchestrator（见 §3.3 注） |
| Reflection 触发（§3.4） | **Runtime 三态决策中心**（stop / switch） | 需在 stop / switch 后自动引导进 Reflection，而非停在问答 |
| Reflection 输出（§3.5） | `extraction` 产出 delta + 新生成 prompt | 缺：delta 聚合查询 + Reflection Summary 生成 prompt |
| 用户确认层（§3.6） | `ConfirmationService` 四态 + `confirmInterp` 前端 | ✅ 已由 **ADR-0012** 实现：`thought_wording_confirm` 两阶段确认 + `rewriteToDeclarative()` 把 AI 推测语气改写为第一人称陈述句，再经 `LatticeClassifier` 打晶格坐标，用户可 `wording_edit` 改写 |
| Cognitive Artifact（§3.7） | 已确认 `Thought` / `Relation(challenges)` / `Question(unresolved)` | 直接复用 6 实体，无需新类型 |
| Next Session Continuity（§3.8） | 已确认 `Thought` 的 lattice 聚类 + superseded 链 + 未决 `Relation`/`Question` | 主要是聚合查询，几乎无新逻辑 |

### 3.12.3 四类 Artifact 的派生规格（不是新数据，是查询 + 渲染）

| Artifact（§2） | 派生自 | 渲染规则 | 净新增工作量 |
|---|---|---|---|
| **Thought Map** | 已确认的 `Thought` + 其 `lattice` 坐标（LatticeClassifier 已有）+ `Relation` 边 | 按 12 晶格维度聚类成树 / 簇，呈现"你在想什么的结构" | 仅一个聚合查询 + 布局；**几乎纯前端** |
| **Conflict Map** | `Relation` 类型 `challenges`（张力）——**已实现** | 改文案："你同时重视 X 与 Y，无需立即二选一"，而非"你有冲突要解决" | ✅ 已由 **ADR-0014** 实现：`TensionMapService` 只读聚合 challenges+contradicts，零写入，天然满足 S-8.2 与"Mirror 不产生 Judgment" |
| **Reflection Summary** | 本次会话时间窗内的新 Observation / Interpretation / Thought / Relation **delta** | "认知变化"而非"聊天总结"；遵守 S-3.2（三层可区分）+ S-9.3（可查依据） | 一个新生成 prompt + delta 计算 |
| **Belief Map** | `Thought` 的 **S-4.1 版本历史**（superseded 链）+ 跨月 lattice 位置漂移 | 呈现"某观点从 A 变成 B" | ⚠️ 已由 **ADR-0013** **部分**实现：`latticeSynthesis` 以余弦漂移检测生成 `lattice_synthesis` Observation（仍属 Observation，不引入新实体）；完整 Belief Map 仍待建。schema bug 已修复（见 3.12.7），可随合成门控跑通 |

### 3.12.4 "用户永远拥有解释权"如何闭环（S-3.4）

每个 Artifact / 每条 AI 生成内容，渲染时必须带两个 affordance（落实 §3 原则一 / 二、§2 的 Belief Map 精神）：

- `[修改]` → 打开输入框让用户用自己的话改写，落为 user-confirmed `Thought`（满足 S-3.2）；
- `[丢弃]` → 走 S-2.3 的 reject / dismiss，且**不可被 AI 自动恢复**。

这把"帮助建立自己的模型"从口号变成数据流：AI 的 Interpretation 永远只是待确认建议，闭环终点一定是一个用户确认的 Thought 或显式拒绝。

### 3.12.5 调和"不展示系统如何思考"与现有 Interpretation 卡片

现有前端已把 AI 的 Interpretation（带 confidence_rationale）直接展示——这恰好是体验层要压制的"AI 在研究我"感。规则定为：**所有 AI 生成内容一律以"系统注意到…（依据 Evidence #x）"呈现，并显式标注"这是系统的观察，你可以改写或丢弃"，绝不写"你的核心问题是 X"**。这同时落实 §3 的原则一 / 三，并直接满足 S-2.2（无定案动词）、S-6.1（置信度展示）、S-9.3（可溯源）。因此体验层大量工作是**呈现层重框**，不是数据层。

### 3.12.6 MVP 范围（诚实版：什么是架构、什么是待建）

- **已有（直接复用）**：Conversation、Conflict Map（张力）、确认流、12 晶格、Runtime 触发、Next Session Continuity 所需的数据。
- **待建（小）**：首页 Landing 改造、`Reflection Summary` 生成、Thought Map 聚合查询、Cognitive Timeline（按月的实体时间聚合，成本极低，主要靠 S-4.3"优先展示关系变化"）。
- **待建（需单独设计，标风险）**：**Belief Map 的"信念变化自动检测"**——ADR-0013 已提供分布级漂移（`lattice_synthesis` Observation），但"某具体观点 A→B 的前后对照"仍待建；该能力最容易滑向"用户画像 / 演化模型"，必须谨慎设计且配测试；MVP 可先只做"用户显式标记'我改了主意' + Thought 版本链展示"的简版。
- **暂缓（§8 已列）**：三维图、人格模型、社群网络、职业专家空间。

### 3.12.7 权威链补全状态（更新于 2026-07-30）

1. **ADR（体验层派生决策）**：不再需要单独的"体验层只读派生层"ADR——该原则已被三份 ADR 具体实例化，且均**未引入新认识论实体**：
   - **ADR-0012**（对话编排）：`pending_slots` / `stalled_prompts` 为编排层内部状态（SQLite 裸表，不走 6 实体 Schema）；`thought_wording_confirm` 实现"用户改写措辞"闭环（即 §3.6 的确认层）。
   - **ADR-0013**（晶格合成）：漂移检测产物是 `Observation`（`pattern_type='lattice_synthesis'`），复用既有实体，不新增类型（即 §3.7 / §2 Belief Map 的部分来源）。
   - **ADR-0014**（张力地图）：`TensionMapService` 只读聚合 challenges+contradicts，零写入（即 §2 Artifact 3 / §3.7 Conflict Node 的来源）。
   故本文件原写的"ADR-0011（体验层只读派生层）"引用**作废**——`0011` 已被 Sync 占用，且该原则现已由上述三份 ADR 落地。
2. **S-3.4**（AI 内容以"系统观察"语气呈现 + 可改写 / 丢弃入口）：✅ 已写入 `specs/specifications/v0.1.md`（§3），并在 §3.6 / §3.12.4 落地为闭环。

> **阻塞级风险（来自 ADR-0013）— ✅ 已修复（2026-07-30）**：`specs/schemas/Observation.schema.json` 的 `pattern_type` 枚举**已加入 `'lattice_synthesis'`**。`latticeSynthesis.ts` 写入的 `evidence_ids` 取的是 Thought 的 `evidence_ids`（即 Evidence id）并经 `repos.evidence.get` 过滤，引用的是 Evidence 而非 Thought，`constraints.ts` 亦无 Observation 分支，故该约束改造不必要。回归测试已加入 `tests/m1.smoke.test.ts`（lattice_synthesis 入库 + 未知枚举仍被拒），锁定不再退化。修复后 Belief Map 已可随合成门控跑通。

> 状态说明：本 3.12 列出的 ADR 已由 0012/0013/0014 覆盖，S-3.4 已落地；任何后续规范变更仍须走独立评审流程，不得随前端迭代顺带变更（S-9.1）。

---

# Chapter 4 — MVP Interface Specification（MVP 界面规格）

> 本章将 Chapter 3 的闭环与 §2 的四类 Artifact、§4/§5/§6 的五个屏幕，落成**可实现的界面规格**。所有屏幕共享一条铁律（见 §4.6）：AI 生成内容一律按 **S-3.4** 以"系统观察"语气呈现，并带 `[修改]` / `[丢弃]` 入口。每一屏都锚定到 6 实体模型的查询，不新增认识论实体。

## 4.1 首页（Landing）

**目的**：降低进入门槛，非 chat-first（呼应 §4）。提供"继续 / 新建"两条路径。

**线框**：

```
Thought OS
今天想整理什么？
----------------
继续昨天的思考
○ 职业方向
○ 创业想法
○ 人际关系
开始新的思考
[ 输入 ]
```

**数据来源**：查询最近 `active` 的 `Thought`，按 `lattice_level` / 主题聚类得出"最近关注"；读取会话游标（`pending_slots` / `stalled_prompts` 或上次会话时间窗）→ 渲染"继续昨天的思考"的主题列表。

**关键交互**：
- 点击主题 → 进入 Chat 页面并带入该主题上下文（呼应 §3.8 连续体验）；
- 空白输入 → 新建会话（§3.2 的"说出现在脑中的东西"）。

**空状态（首启）**：无任何历史 → 仅显示"开始新的思考 [输入]"，不渲染空的主题列表。

**开发优先级**：P0。

## 4.2 Chat 页面（Conversation）

**目的**：自然聊天入口，降低表达门槛（§3.2）。

**内部状态（用户无感，§3.3）**：`Input → Questioner Gate → Observe → Extract → Generate → Commit`。不改变 Orchestrator。

**线框**：

```
[ 主题 / 上下文条：职业方向 · 上次关注的是成长感 ]
------------------------------------------------
用户：最近感觉工作越来越没意思。
系统：我想先理解一下，这种"没意思"更接近哪一种？
      A. 工作内容本身没有兴趣
      B. 感觉没有成长空间
      C. 环境和人际关系消耗很大
      D. 说不上原因，只是长期疲惫
用户：B
系统：系统注意到（依据 #E12），你多次把"没意思"和"成长"连在一起说。
      [修改] [丢弃]
------------------------------------------------
[ 输入 ]
```

**数据来源**：`Evidence`（落库 raw_content）；Orchestrator 后台抽取产生 `Observation` / `Interpretation` / `Thought` delta；Questioner 产生 `Question`。

**关键交互**：
- Understanding Mode 下用**选项式澄清**（Questioner Gate / Intent Clarification），而非直接给建议（§3.2）；
- AI 内容以"系统注意到…（依据 Evidence #x）"呈现（S-3.4，呼应 §3.12.5）；
- 每条 AI 节点带 `[修改]` / `[丢弃]`（§3.6 / §3.12.4）。

**空状态**：会话刚开始、尚无任何节点 → 仅展示输入区与上下文条。

**开发优先级**：P0（已有基础，需补 S-3.4 呈现重框 + 选项式澄清）。

## 4.3 Reflection 页面

**目的**：会话结束后回答"这次交流留下了什么"（§3.4 / §3.5），**不是聊天总结**。

**触发（§3.4 Reflection Trigger）**：用户主动结束 / 重要主题出现 / 对话达深度 → 显示 `[生成我的思考记录]`。

**线框**：

```
本次思考记录
主题：职业方向探索

当前关注（你反复提到）
* 成长感
* 创造空间
* 长期价值
      [修改] [丢弃]

可能存在的张力
稳定收入  VS  自主探索        （status: open）
      [查看 / 修改]

尚未明确的问题
如果不用立即改变现状，你愿意尝试什么小规模探索？
      [修改] [丢弃]

[ 保存为我的思考记录 ]
```

**数据来源**：本次会话时间窗内的新 `Observation` / `Interpretation` / `Thought` / `Relation` **delta**；`Relation(challenges)` 张力；`lattice` 聚类得出"当前关注"。

**关键交互**：
- Reflection Summary 生成（新 prompt，遵守 S-3.2 三层可区分 + S-9.3 可查依据）；
- 呈现"认知变化"而非"聊天总结"；**绝不**出现"建议你 X"（§3.5）；
- 每个洞察带 `[修改]` / `[丢弃]`（S-3.4）→ 落 user-confirmed `Thought` 或 reject；
- 张力以"你同时重视 X 与 Y，无需立即二选一"呈现（ADR-0014 / §2 Artifact 3）。

**空状态**：会话未产生足够节点 → 提示"这次还没沉淀出明确想法，下次继续"，不强行生成 Summary。

**开发优先级**：P0（核心差异）。

## 4.4 我的思考空间（Personal Cognitive Space）

**目的**：区别 ChatGPT 的核心（§5），长期认知资产。

**线框**：

```
我的思考空间
最近关注：职业 / 创造 / 关系
长期价值：创造 > 稳定
持续探索：如何建立长期方向
最近变化：从寻找答案 转向 寻找方向

[ Thought Map ] [ Conflict Map ] [ Belief ] [ 未决问题 ]
```

**数据来源**：已确认 `Thought` 聚合（`lattice` 聚类 → 最近关注；`superseded` 链 → 长期价值 / 最近变化）；`Relation(challenges)` → 张力；`Question(unresolved)` → 持续探索。

**关键交互**：点击任意区块 → 进入对应的 Artifact 视图（Thought Map / Conflict Map / Belief Map / Question 列表）；所有 AI 衍生展示带 `[修改]` / `[丢弃]`。

**空状态（首启）**：引导"开始第一次思考"，不渲染空卡片矩阵。

**开发优先级**：P1（Thought Map / Conflict Map / Belief Evolution，见 §3.10）。

## 4.5 Timeline 页面（Cognitive Timeline）

**目的**："成长感"来自变化（§6）。

**线框**：

```
2026.07  讨论：是否创业
         发现：真正关注的是自主性
2026.08  讨论：新的职业机会
         变化：开始接受渐进式探索  ★
（★ = 观点从 A 变为 B，点开看前后对照）
```

**数据来源**：按 `created_at` 月桶聚合 `Thought` / `Interpretation` / `Observation`；S-4.3 优先展示关系变化；`superseded` 链标注"变化点"（Belief 演化）。

**关键交互**：点击月份 → 展开该月实体；变化点高亮并链接到 Belief Map 的前后对照。

**空状态（首启）**：提示"你的认知时间线会在这里慢慢长出来"。

**开发优先级**：P0（让用户看到积累）。

## 4.6 跨屏统一规则（S-3.4 落地）

所有屏幕共享：

- AI 生成内容一律以"系统注意到…（依据 Evidence #x）"呈现；显式标注"这是系统的观察，你可改写或丢弃"；
- 每条 AI 节点带 `[修改]`（改写落 user-confirmed `Thought`，满足 S-3.2）/ `[丢弃]`（S-2.3 reject / dismiss，不可被 AI 自动恢复）；
- 禁止定案性断言（S-2.2）、禁止人格标签（Article 20）、置信度须展示（S-6.1）、可溯源（S-9.3）；
- **移动端**：当前 Hono 绑定 127.0.0.1，移动设备不可访问。P2 前以桌面为主，Tauri 包装为折中；MVP 界面布局须做最小响应式适配（单列流式），不专门为移动端设计复杂交互。

## 4.7 开发优先级汇总（呼应 §3.10）

- **P0**：Chat（补 S-3.4 重框 + 选项式澄清）、Reflection Generator、Artifact Storage（6 实体 Storage 已具备）、Timeline View、首页 Landing。
- **P1**：Thought Map、Conflict Map、Belief Evolution（我的思考空间）。
- **P2**：复杂认知可视化、移动端 / Tauri 包装。

---

*本文档为 Cognitive Experience Layer Draft v0.1，包含 Chapter 3（核心交互闭环）与 Chapter 4（MVP 界面规格）。遵循 Article 27（Specification 高于 Prompt，应保持稳定）与 Article 0（内核剃刀：不引入未通过审查的新认识论实体）。任何 Chapter 4 的界面迭代不得反向偷偷变更 6 实体模型或 S-x.x 规则（S-9.1）。*
