# ADR-0037: Semantic Cognitive Loop v0.1 — 允许 AI 分析，冻结语义能力边界

> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: DESIGN ACCEPTED (2026-09-08) / P0 Semantic Notice (S5.1) 实现就绪
**Date**: 2026-09-08
**领域**: Personal Cognitive AI / Semantic Loop / 能力边界冻结
**关联**: `adr/0036` (战略框架)、`adr/0035` (认知成长闭环 P1–P5)、`adr/0025` (认知分层语义边界)、`adr/0031` (Portrait Interpretation Engine)、`adr/0004` (Conflict Detection Protocol)、`constitution/Constitution.md` (宪法剃刀)

---

## Context

### 触发

`adr/0036` 把 Mirror 重定位为 **Personal Cognitive AI**，并冻结最高战略原则「停止建设系统、开始证明产品」。V0 四刀（Explore 主动化 / Continue 接回 / Decide 产品化 / Outcome 反馈机制 / Notice 模式发现）已落地，但全部是**确定性逻辑、不调 LLM、不替用户下结论**。

V0 的局限：
- Notice 只是「客观状态提醒」（decision overdue / thought unverified），不是「Mirror 认为这里可能有值得你认识的东西」。
- Explore 只是「用户主动搜索」，未利用 Mirror 已积累的长期 Evidence / Thought / Decision / Outcome 做认知级关联。
- Outcome 只是「客观索引回写」，不形成 Personal Decision Intelligence。

用户重审后明确修正旧约束：

> 不再沿用「AI 不判断用户」的旧纪律。Mirror 应主动理解用户的认知系统，并利用认知科学 / 心理学 / 行为科学帮助用户认识自己、认识世界、做出更好的判断与行动。

但旧宪法（`adr/0025` / `adr/0036` V0）的「AI 止于 Interpretation、不替用户下结论」需要被**精确修订而非推翻**：AI 现在允许产出 Inference / Hypothesis，但必须可审计、不得伪装成用户身份或事实。

### 生死问题（本 ADR 要回答的）

> 在不破坏「Authority 在人」主权的前提下，如何让 Mirror 从「保存与连接思想」升级为「主动理解认知系统并反馈给用户」，且首刀（Semantic Notice）能产出用户自己未意识到、回头看却认同的发现？

---

## Decision（Semantic Cognitive Loop v0.1 能力边界）

### D1 产品目标重定义

Mirror = **Your Personal Cognitive AI**。

完整闭环：

```text
                 ┌─────────────┐
                 │   CONTINUE  │
                 └──────┬──────┘
                        ↓
                     THINK
                        ↓
          ┌─────────────┴─────────────┐
          ↓                           ↓
       EXPLORE                     NOTICE
          ↓                           ↓
     World Evidence          Cognitive Analysis
          ↓                           ↓
          └──────────→ THINK ←────────┘
                         ↓
                      DECIDE
                         ↓
                        ACT
                         ↓
                      OUTCOME
                         ↓
                 Cognitive Analysis
                         ↓
                      NOTICE
                         ↓
                     CONTINUE
```

核心价值：**Mirror 持续建立 / 检验 / 更新对你的认知理解**，而非仅存储。

### D2 架构原则：AI 可以判断，但 Inference ≠ Fact

**AI 允许**：发现行为 / 认知 / 决策模式；发现矛盾；发现长期趋势；建立心理 / 行为假设；使用认知科学解释现象；比较用户与外部世界；对判断提出挑战；预测可能结果；指出用户未察觉的问题。甚至可表述：

> 「我认为你可能存在 X 认知倾向，证据是 A / B / C。」

**分层（必须显式区分）**：

```text
事实          → Evidence
AI 推断       → Inference
科学解释      → Interpretation
认知假设      → Hypothesis
用户自我理解  → Human Authority
```

AI 可走到 **Hypothesis**，但**禁止**把「Inference」伪装成「你的真实身份 / 事实」。

**红线（禁止项）**：
1. 未经授权自动写入 / 修改 Thought / Decision / Outcome 等认知对象；
2. 隐藏推理依据（每条候选的 `why` / `reasoning` 必须可查）；
3. 伪装确定性（必须带 `uncertainty`，不得用肯定语气包装推断）；
4. 替用户定案（Authority 永远在人，`dismiss` 永久生效）。

### D3 Semantic Notice（P0，分两阶段）

S5.1 **Semantic Pattern**（先落地，本轮实现目标）：
- 跨 Thought 关联、Thought↔Decision、Decision↔Outcome、时间模式、行为模式、矛盾、重复模式、未解决 tension。
- 验证问题：**Mirror 能不能发现用户自己没有发现的东西？**

S5.2 **Cognitive Interpretation**（S5.1 成功后再加）：
- Pattern → Psychology / Cognitive Science / Behavioral Science → Interpretation → Hypothesis。
- 验证问题：**Mirror 能不能解释「为什么可能发生」？**
- 两阶段**不混成一个大功能**。

**SemanticNoticeCandidate 内部结构（必须结构化、可审计）**：

```text
type:      pattern | contradiction | bias_hypothesis | behavioral_shift
          | cognitive_shift | decision_pattern | unresolved_tension
claim:     AI 对现象的描述
evidence:  [Thought / Decision / Outcome ID]   # 必须可核查
reasoning: 为什么这些 evidence 支持这个判断
interpretation: 可使用的科学理论 / 模型        # S5.2
hypothesis:    值得进一步验证的假设
uncertainty:   证据强度 / 推断不确定性
counter_evidence: 是否存在反例
next_step:  可以如何继续验证
```

> 这不是让 AI 更保守，而是让 AI 可以更大胆地分析，但分析必须**可审计**。

### D4 Cognitive Science Layer（S5.2）

```text
User Evidence → Semantic Analysis → Scientific Models → Cognitive Interpretation → Personal Hypothesis
```

理论库（渐进引入，不为贴标签）：
- **Cognitive Science**: cognitive biases / decision theory / bounded rationality / uncertainty / attention / memory / metacognition
- **Psychology**: motivation / avoidance / self-efficacy / cognitive dissonance / emotion regulation
- **Behavioral Science**: habit formation / present bias / loss aversion / status quo bias / planning fallacy / behavioral inertia
- **Social-Behavioral**: social comparison / conformity / reputation effects

目的：让 Mirror 对人的理解具有理论基础，而非纯 LLM intuition。这是 Personal Cognitive AI 与普通 AI Assistant 的区别。

### D5 Semantic Explore（P1）

当前 Explore 未利用已知。升级：

```text
Current Thought / Decision / Recent Notice / Recent Outcome
        ↓
Explore Seed
        ↓
LLM semantic expansion（生成检索式）
        ↓
World Search → World Evidence
        ↓
Compare（你的判断 VS 现实）
        ↓
New Thought（认知碰撞）
```

Mirror 理解「你真正关心的问题」而非仅「你想搜什么」；最有价值的是**让用户自己的模型与现实碰撞**，而非 Search 本身。

### D6 Outcome Intelligence（P2）

```text
Thought → Decision → Prediction → Action → Outcome
        ↓
Compare expected vs actual → Model error → Cognitive analysis
```

形成 **Personal Decision Intelligence**（校准 / 误差模式）。暂不做「AI 总结器」——先建立 Reality → Cognitive Model Testing 能力。

### D7 Decision Intelligence（P3）

Decision 成为**可检验决策模型**：Problem / Options / Evidence / Assumptions / Expected Outcome / Risks / Review + Prediction。与 Outcome 比较形成 Calibration，回答「你在哪些领域准、哪些系统性失误」。

### D8 Continue Persistence（P4）

跨会话持久化 `focus`（现 sessionStorage → storage）；恢复时 LLM 生成「可能的下一步」提示（可忽略）。成为整个 Loop 的入口。

### D9 实现优先级（修订）

| 优先级 | 模块 | 核心价值 |
|---|---|---|
| **P0** | S5.1 Semantic Notice | 认识自己 |
| **P1** | S1 Semantic Explore | 认识世界 |
| **P2** | S4 Outcome Intelligence | 从现实中学习 |
| **P3** | S3 Decision Intelligence | 提高判断能力 |
| **P4** | S2 Continue Persistence | 形成长期连续性 |

Outcome 置于 Decision 前：无 `Decision → Outcome → Reality`，Mirror 无法知道自己的分析是否有价值。

### D10 Kernel 不膨胀（硬约束）

现有 13 primitive（Evidence / Thought / Question / Relation / Decision / Outcome / Evolution / Reflection / Continuity / Portrait / Admission / Notice / Explore）已足够支撑下一阶段。**禁止新增** `Personality / UserProfile / CognitiveProfile / BehaviorProfile / BiasEntity / ResearchProject / Topic / Interest / CognitiveModel` 等实体。Personal Cognitive Model 先作为 **derived semantic interpretation** 存在；确有使用证据需持久化，再经新 ADR 升格 Kernel。避免重踩「Kernel 越来越漂亮，产品越来越远」的坑。

### D11 与既有 ADR 关系

- **不推翻** `adr/0036`（战略框架）；本 ADR 为其 Semantic 阶段冻结能力边界与优先序。
- **修订** `adr/0025` / `adr/0036`-V0 的「AI 止于 Interpretation、不判断」：在 Semantic Notice / Explore 下允许 Inference / Hypothesis，但受 D2 红线约束；**V0 确定性逻辑保留为 no-LLM fallback**（mock 模式或 `semanticNotice=off` 时自动回退）。
- 复用 `adr/0031` Portrait Interpretation Engine、`adr/0004` Conflict Detection Protocol 作为语义分析底层。

### D12 验收标准（产品级，非仅测试）

代码测试仅为必要条件。真实验收问题只有一个：

> **Mirror 能不能让用户发现一个自己以前没有意识到、但回头看又觉得「确实如此」的东西？**

S5.1 观察链：

```text
Semantic candidate generated → Shown → Why opened
        → User response → Accepted / Rejected / Challenged → Revisit
```

关键指标：**用户是否因 Notice 产生新 Thought / Decision / Explore**。若 Notice 很酷，但用户看完「哦」然后退出，它只是 AI 洞察展示器；若 `Notice → 新 Thought → Explore → Decision → Outcome`，才真正建立 Personal Cognitive AI Loop。

---

## 备选方案（被否决的）

- **B1 五个孤立功能各自推进**：否决。应为统一 Cognitive Loop，Continue 为入口，五模块共享 Personal Cognitive Model 派生层。
- **B2 上来做 S5.2 大模型人格分析**：否决。先 S5.1 验证「能否发现未知」，再解释「为什么」，两阶段不混。
- **B3 新增 CognitiveModel 等 Kernel 实体支撑语义**：否决，违反 D10。
- **B4 保持 V0 不调 LLM**：否决，与 V2 产品目标直接冲突。

---

## Consequences

- **正向**：Mirror 从记录工具升级为 Personal Cognitive AI；首刀 S5.1 可交付第一个 magic moment；边界清晰、可审计、可降级。
- **风险**：语义分析可能出错 / 过度推断。缓解 = `uncertainty` + `counter_evidence` + `why` 全展示 + 用户可 `dismiss`；默认 `semanticNotice=off`，需用户显式开启。
- **不做什么**：不自动写认知对象、不贴标签、不做大规模 Kernel 重构。

---

## 下一步路线

```text
NOW
 ├── ADR-0037（本 ADR，冻结边界）
 ├── S5.1 Semantic Notice（Pattern / Contradiction / Behavioral Signal）  ← 立即实现
 ├── 真实用户验证
 ├── S5.2 Cognitive Interpretation（Psychology / Cognitive Science / Behavioral Science）
 ├── 真实用户验证
 ├── S1 Semantic Explore（Personal Thought ↔ World Evidence）
 ├── S4 Outcome Intelligence（Prediction ↔ Reality ↔ Learning）
 ├── S3 Decision Intelligence（Decision ↔ Calibration）
 └── S2 Continue（Long-term Cognitive Continuity）
```

> 核心变化一句话：**Mirror 不再只是「帮你保存和连接思想」，而是开始主动理解你的认知系统，并把这种理解拿来帮助你认识自己、认识世界、做决定、行动，再从现实结果中修正对你的理解。**
