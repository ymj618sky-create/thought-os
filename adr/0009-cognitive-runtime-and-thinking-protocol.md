# ADR-0009: 认知运行时（Cognitive Runtime）+ 可插拔思考方法（Thinking Protocol）



> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: Accepted
**Date**: 2026-07-30
**领域**: 架构内核 / 认知循环
**关联文档**: `constitution/Constitution.md`（Article 0：第一性原理、绝对极简、自洽性、工程可落地）、本设计文档《Mirror Cognitive Runtime Architecture (Current Optimal Design)》、`adr/0001`–`adr/0008`

## Context

Mirror 之前围绕 Agent / Role / Workflow 思考，导致一级概念不断膨胀。但用户真正需要的是**一个稳定的认知循环**：思想落在哪里（What）、用哪种思维方法（How）、整个认知过程怎么被驱动（How it runs）。

当前阶段只需确立三个**不可约支柱**：

- **Twelve Lattice（What）**：思想位于哪个思想空间。
- **Thinking Protocol（How）**：采用哪种认知方法（如现象学、苏格拉底、系统思考、决策科学）。
- **Cognitive Runtime（How it runs）**：如何驱动每一轮 Turn。

设计文档明确约束本轮范围：

- **仅修改 Conversation Runtime → 引入 Thinking Protocol**；
- **保持不变**：Twelve Lattice、Thought、Evidence、Conversation；
- **避免大规模重构**；
- **不引入** FSM / Workflow / Graph / DSL / Plugin Marketplace；
- 任何新增设计必须能由现有概念推导（架构领先代码半步）。

## Decision

1. **Runtime 是核心**：原 `ConversationOrchestrator` 升级为 **Cognitive Runtime**。Runtime 负责每一轮 Turn 的循环：`Observe → Evaluate → Generate → Commit`，所有对话均遵循这一循环。

2. **Twelve Lattice 保持稳定**：十二晶格只回答"What：思想位于哪个思想空间"，不负责提问、推理、Protocol、Runtime。本次不改动 `src/lattice/`、`src/models/`、`src/storage/`、`src/services/` 中的既有对话机制。

3. **Thinking Protocol 是可插拔模块**：Protocol 不代表角色、不代表专家，只代表一种**思维方法**。新增一种认知方法，只新增一个 Protocol；Kernel 不变。

4. **Protocol 最小接口**（7 字段，不引入 FSM/Graph）：
   - `id`
   - `name`
   - `principles`（认知原则）
   - `constraints`（约束）
   - `exitCriteria`（退出标准：何时停止本轮追问）
   - `behavior`（全局行为约束：P1 改变"行为"而非"内容风格"）
   - `pairWith` / `signals`（P0 三态决策的切换依据：互补方法 / 顶部信号）

5. **Runtime 负责加载 Protocol**：内置 4 种认知方法（`phenomenology` / `socratic` / `systems` / `decision`），由 `ProtocolRegistry` 加载；默认 `socratic`。Runtime 在 `Generate` 阶段把当前 Protocol 的原则/约束/退出标准注入 Questioner 的提示，使"提问风格"随认知方法变化，而底层对话机制（抽取、冲突、提交）保持不变。

6. **组合而非重写（避免大规模重构）**：`CognitiveRuntime` 以**组合**方式持有 `ConversationOrchestrator` 作为引擎，不重写其对话机制；Protocol 仅作为"认知方法提示"注入 `Generate`。这是"Conversation 不变"约束下的最小落地。

## 备选方案（被否决的）

- **A. 用 FSM / Workflow / Graph 描述认知流程**：过度设计，违反 Article 0 剃刀与本设计 §四。本轮不需要状态机。
- **B. 把 Protocol 做成角色/Agent 专家**：Protocol 不是"专家人设"，而是中立的思维方法；做成角色会重新引入被否定的 Agent 概念膨胀。
- **C. 直接重写 ConversationOrchestrator 以融合 Protocol**：等于大规模重构，违反"避免大规模重构 / Conversation 不变"。采用组合注入。
- **D. Protocol 走插件市场 / DSL**：超出当前真实需求（设计 §七"架构领先代码半步"），待真正需要时再演进。

## Consequences

- 新增文件：`src/runtime/protocol.ts`（Protocol 接口 + ProtocolRegistry + 4 内置 Protocol）、`src/runtime/CognitiveRuntime.ts`（运行时循环）、`src/runtime/protocols/*.md`（4 份 Protocol 文档）。
- 修改：`ConversationOrchestrator.handleTurn` 透传 `protocolHint`；`QuestionerService.run` 接受可选 `protocolHint` 并注入提问提示；`src/api/app.ts` 用 `CognitiveRuntime` 包裹 orchestrator，并新增 `GET /api/runtime/protocols`、`POST /api/runtime/protocol`。
- 不变：Twelve Lattice、Thought、Evidence、Conversation（数据层与既有服务逻辑未动）。
- 前端可在 `/api/chat` 的请求体带 `protocolId` 临时切换认知方法，或用 `/api/runtime/protocol` 切换 Runtime 默认 Protocol。
- 已知骨架边界（已部分收敛，见下节「现实评估」）：`Evaluate` 已实现"何时停"启发式（同协议连续追问软上限 + 收束信号），但 Runtime 当前仍主要是**架构边界**而非**执行机制**；Protocol 仍只影响 Question，未触及 Composer/Interpretation/Evidence/Commit。下一步重点见「现实评估与路线图」。

## P0 + P1 落地记录（2026-07-30 第二轮收敛 · 已实现）

> 把「现实评估与路线图」中的 P0、P1 落地，并据实现结果诚实校准路线图。

### P0 — Evaluate 升级为真实三态决策中心（continue / stop / switch）

- `CognitiveRuntime.evaluate()` 取代原 `evaluateStop()`，返回三态 `RuntimeEvaluateDecision`：`continue` / `stop` / `switch`，并携带 `suggestedProtocolId` / `suggestedProtocolName`。
- 三态启发式（真实逻辑，非占位）：
  1. **收束信号**（明白了/谢谢/我决定了/停止…）→ `stop`；
  2. **顶部信号**：用户最近一次捕获的想法强烈匹配另一 Protocol 的信号关键词 → `switch`（Runtime 判断力，用户可否决）；
  3. **软上限**（同协议连续追问 ≥ `PROTOCOL_SOFT_CAP=6`）仍无收束 → `switch` 到 `pairWith` 互补方法给新角度，否则 `stop`。
- 用户否决权：`/api/questioner/run` 接受 `veto: true` → `evaluate(..., { forceContinue: true })`，把 `switch` 拉回 `continue`（收束 `stop` 仍尊重）。前端以 `[继续][换一个]` 呈现（仪表盘 `renderSwitchPrompt`；对话页 `maybeShowRuntimeSuggestion`）。
- **诚实校准**：Article 0 第③点（Evaluate 才是价值）已坐实。但 Article 0 第①点仍成立——Runtime 至今仍是**架构边界**：三态决策只在 `Questioner` 前置闸口 / `chat` 后置判据生效，并未改变 `Orchestrator` 内部的 `Observe→Extract→Generate→Commit` 执行机制。这不影响价值，但文档须持续如实写。

### P1 — Protocol 影响整个 Runtime 的「行为」

- 新增 `Protocol.behavior`（全局行为约束，而非内容风格）：
  - 现象学 = 全局**禁止解释 / 建议 / 归因**；
  - 决策科学 = 全局**允许概率 / 风险 / 机会成本**，显式列选项与取舍；
  - 系统思考 = 从结构/关系出发，**禁止线性因果**与替用户拍板；
  - 苏格拉底 = 以提问/反观为主，**禁止把问题包装成建议**。
- 注入点（组合式、非破坏性，未动数据层 Twelve Lattice / Thought / Evidence / Conversation）：
  - `Questioner`：沿用 `buildProtocolHint`（含 behavior 段落）；
  - `Composer`（`ResponseComposer.compose`）：新增 `ComposeInput.protocolHint`，把行为约束追加进系统提示；
  - `Interpretation`（`ExtractionService.extract`）：新增可选 `protocolHint`，仅注入 LLM 用户轮（**不**进入 `locateOrCreate` 的 Evidence 落库，EVAL-CAP-001 顶层键约束不变）。
- 结论：Article 0 第②点（Protocol 只影响 Question）**已被推翻**——现在 Protocol 通过 `behavior` 约束 Question / Composer / Interpretation 三阶段的行为。Article 0「二、深化」已落地。
- 边界保留：`Evidence` / `Commit` 阶段仍不感知 Protocol（这符合"认知方法不改变事实落库"的自洽性）。

### 路线图再校准（P0/P1 已完成，P2/P3 不变）

- **P0 ✅**：`Evaluate` 已是真实三态决策中心。
- **P1 ✅**：Protocol 影响 Runtime 行为（Question/Composer/Interpretation）。
- **P2（以后做）**：Protocol **自动推荐**并接管切换，用户仅确认（否决权）。当前 `switch` 建议已具备，但"Runtime 负责实际切换、用户确认"的半自动流仍可深化（例如对话页点击即应用、仪表盘默认跟随 Runtime 推荐）。
- **P3（很久以后）**：可见 / 可配置 / Marketplace / Pro —— 仍放后面。
- **North Star 未变**：先证明 Runtime 有判断力（P0 ✅），再证明 Protocol 有价值（P1 ✅ 行为层，P2 推荐层继续）。

## 现实评估与路线图（Constitution Article 0 审视 · 2026-07-30 收敛）

> 本节能且必须诚实写出当前实现的真实状态。它是一次 Article 0 审视，不推翻上面的 Decision（已落地的代码），而是校准下一轮方向。

### 一、几乎完全赞同的三点

**① Runtime 目前只是「架构边界（Architectural Boundary）」，不是「执行机制（Execution Mechanism）」。**
名义循环是 `Observe → Evaluate → Generate → Commit`，但看今天的代码，实际仍是：
`ConversationOrchestrator → Extractor → Questioner → Commit`。
我们只是把前者改了名。真正变化的只有 `Questioner ← Protocol Prompt`。
所以严格说，Runtime 现在是一个**新的架构边界**，而不是一个新的运行机制。这句话必须写进文档。

**② Protocol 目前只影响 Question。**
目前数据流是 `Protocol → Question Prompt → 结束`。Composer / Interpretation / Evidence / Commit 均未受影响。
于是用户最终只看到「问题风格稍微变了」——这是一个非常真实的用户体验风险。

**③ Evaluate 才是真正的价值。**
第一反应容易去做 Protocol Marketplace / Protocol UI / Protocol Store；但真正影响体验的是：
**什么时候继续？什么时候停止？什么时候换一种思路？** —— 这恰好与「Evidence-driven Runtime」一致。
结论：Runtime 的第一能力，不是生成问题，而是**知道什么时候不要继续问**。

### 二、需要深化的一点：Protocol 影响「行为」而非「内容」

赞同「Protocol 应影响 Composer」，但更进一步：**Protocol 不应影响内容，而应影响行为。**

- 例：现象学 —— 不是「回复更温柔」，而是整个 Runtime **禁止解释 / 建议 / 归因**（Question、Composer、Summary 全受影响）。
- 例：Decision Science —— 整个 Runtime **允许概率 / 风险 / 机会成本**，Composer 自然如此组织，而不是多写一句「从决策角度来看」。

这是两个层次：Prompt Style（退化） vs 真正的认知运行协议（行为约束）。若只到前者，Protocol 就退化成提示词模板。

### 三、唯一不同意的一点：Protocol 不应过早作为 Pro 权益

现在讨论商业包装太快。真正该问的是：**用户会不会主动切换 Protocol？** 判断：90% 不会。
用户不会说「今天我想用现象学」，而会说「我最近很焦虑」。

因此 Protocol 更应由 **Runtime 自动推荐，用户只有否决权**：
- 推荐形态：`建议：系统思考。[继续][换一个]`；
- 而非：`请选择：□ 禅宗 □ 苏格拉底 □ 现象学 □ 系统思考`（几乎没人会选）。

这里暴露的更大问题是：Protocol 以后可能不是「用户选择」，而是「Runtime 选择」，用户只有否决权。

### 四、收敛出的优先级（P0–P3）

- **P0（必须做）**：真正的 Runtime。让 `Evaluate` 成为真实逻辑（不是占位）。
  *注：本 ADR 已落地 `Evaluate` 的「何时停」启发式（软上限 + 收束信号）；但「何时切换」与「作为决策中心」仍待深化。*
- **P1（应该做）**：Protocol 影响整个 Runtime 的**行为**，而非只影响 Question。
- **P2（以后做）**：Protocol **自动推荐**；Runtime 负责切换，用户负责确认（否决权）。
- **P3（很久以后）**：Protocol 可见、可配置、可扩展、Marketplace、Pro —— 全部放后面。

### 五、North Star（应成为下一轮开发的唯一重点）

> **不要先证明 Protocol 有价值，而要先证明 Runtime 有判断力。**

因为如果 Runtime 不能判断：
- 什么时候继续；
- 什么时候停止；
- 什么时候切换；

那么无论挂载多少 Thinking Protocol，它们都只是**不同风格的 Prompt**。
只有当 `Evaluate` 成为真正的运行时决策中心，Thinking Protocol 才会从「提示词模板」升级为真正的**认知运行协议**。

这既不需要大规模重构，又直接决定 Runtime 是否名副其实，也符合 Article 0 强调的「先解决真实问题，再增加能力」。
