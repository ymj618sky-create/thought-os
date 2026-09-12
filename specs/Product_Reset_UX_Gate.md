# Product Reset / UX Gate — 产品铁律（2026-09-04）

> 触发：第一位真实用户（产品作者本人）的体验反馈。结论不是理论推演，而是来自"作为第一用户，体验非常差"的真实信号。
> 性质：**UX Gate，不是 Kernel 变更，不是新能力，不是新 ADR**。只重新决定"用户每天应该看到什么"。
> 配套约束位置：本文是产品级约束；不写入 Constitution（架构级），不新增 ADR。
> 关联：与 `specs/architecture/Raw_Evidence_Ingestion_V1.md` 一致——RawEvidence Library 保留为 Archive，不升为核心体验。

---

## 1. 诊断（根问题）

Mirror 最大的问题不是"功能太多"或"页面不好看"，而是：

> **整个产品把 Kernel 的内部产物，当成了用户需要消费的产品。**

具体表现（同一根问题）：

- **时间线**：133 条 · 08/14 → 09/03，逐条 ○ 往下堆 → 用户面对"从 133 条里找值得看的"，产生"为什么我要替 Mirror 做这个工作"。
- **证据轨迹**：一张张 Evidence 卡片 → 这是审计工具，不是内容消费单位。Evidence 是证据，不是阅读列表。
- **收件箱**：29 个待处理 → 隐含"你有 29 件事没处理"，把用户推入任务清理状态，而非思考状态。

这三者都是同一种范式：

> Mirror 不断生产东西 → 用户负责阅读、筛选、确认、理解。

与初衷相反。初衷是：**Mirror 帮我减少认知负担，让我发现我自己没发现的东西**。实际变成了：**Mirror 给我制造一个新的认知负担，让我管理 Mirror 产生的大量东西**。

这是典型的 **internal representation leakage**（内部表示泄漏）：

```text
操作系统内部有 process / thread / fd / page / cache / interrupt
但用户打开电脑，不应该看到"今天系统产生了 8,472 个 thread"

Mirror 现在就在干这个：把 RawEvidence / Evidence / Thought / Question / Tension
当成用户应该消费的内容流。
```

"它是不是 Evidence" ≠ "它值得用户以后再看"。这是整个演进中越来越明显的混淆。

---

## 2. 产品铁律（写进产品约束）

> **Mirror 不以"展示系统产生了多少认知对象"为价值。**
> **Mirror 只在它能够减少用户寻找、整理、筛选这些对象的负担时，才展示它们。**

极端版本：

> 如果 100 条 Evidence 里只有 1 条值得用户思考，Mirror 应该**只把那 1 条带到用户面前**。
> 剩下 99 条：系统自己保存，用户不需要负责管理它们。

推论：

> **越强大的 Kernel，越应该让用户越少感受到它。**
> `extract / classify / admit / store / index / measure` 全部是后台机制，用户不应感知。

---

## 3. 哪些 Kernel 能力不应该成为一级用户任务

可以存在，但应成为 **Mirror 的内部 machinery**，不进每日主导航：

- Timeline（研究者审查用，非个人思考用）
- Evidence Trail（审计/溯源用：用户已有判断后可追溯 Mirror 依据了什么，而非"请阅读 183 条 Evidence"）
- Inbox（待确认 Candidate 不应以"任务数"逼用户清理）
- Admission
- Evolution（理解演进）
- Portrait（我的画像）machinery
- 大量单条 Thought / 大量 extracted Evidence / 大量待确认 Candidate

---

## 4. 信息架构（Reset 目标）

```text
Mirror
│
├── 首页        ← 今天 Mirror 有没有什么值得让你停下来看的东西？
│               有 → 一个 Moment / 继续思考（现有 Phase 4 Continuity 卡）
│               没有 → "今天没有什么值得打扰你的。"
│
├── 对话        ← 核心交互循环："我现在想和 Mirror 思考/聊什么？"
│
├── 写入        ← 用户写；背后默默 extract/store，用户不感知
│
├── 我的文字    ← Archive（日记/影评/书评/随笔），RawEvidence 的家，非核心体验
│
├── 思考空间    ← 已有的 Thinking Space 聚合表层
│
└── 我的画像    ← 自我观照入口（"我在 Mirror 中看见的自己"，一面镜子，非 AI 档案）
```

主导航 6 项对应**六种用户意图**，不是六个信息分类：

- 首页 = "现在有什么值得我停下来？"
- 对话 = "现在想和 Mirror 思考/聊什么？"
- 写入 = "主动留下东西"
- 我的文字 = "回看自己的原始材料"
- 思考空间 = "进入已经形成的认知结构"
- 我的画像 = "看见自己是谁"

负担型页面（Evidence Trail / Timeline / Inbox / Evolution / Questions / Tension）**完全移出导航**，仅 URL 可达，不再承担"每天使用 Mirror"的责任。

---

## 5. 首页应有的体验（而非 Moment 之前的中转）

```text
无值得打扰的内容：
  "今天没有什么值得打扰你的。"

有值得停下来看的（目标形态，V2 Cross-Time Contrast 实现后）：
  ┌──────────────────────────────┐
  │ 你以前写过一句话……            │
  │ "……"（2025.03）              │
  │ 最近你又写了……                │
  │ "……"（2026.08）              │
  │ 放在一起，你有什么感觉？       │
  │ [查看原文]                    │
  └──────────────────────────────┘
```

当下（V2 未实现）首页先用已存在的 **Continue 卡（Phase 4 Continuity）** + 平静空状态承载，不提前造 V2。

---

## 6. 边界（本 Reset 不做）

- 不改 Kernel（RawEvidence / Evidence / Thought / Question / Tension / Continuity 全部不动）。
- 不删除任何已有数据。
- 不做 V2 Cross-Time Contrast 开发（Moment 是未来；本 Reset 只收口 UX 表面）。
- 不新增 ADR、不新增架构层、不新增能力。
- 不在收件箱加批量确认、不在时间线加筛选搜索、不优化 Evidence UI——那是在优化错误的方向。
- RawEvidence Library（V1.1）保留，地位降为 Archive。

## 7. 已确认项（2026-09-04）

- 对话（Chat）：**保留在主导航**（选 A）。主导航 = 首页 / 对话 / 写入 / 我的文字 / 思考空间 / 我的画像。对话是核心交互循环，不是"认知记录页面"，不与首页合并（避免首页退化成万能页，重新引入 Reset 想去掉的复杂度）。
- 负担型页面：**完全移出导航（选 B），不做"更多/认知记录"分组**。收件箱 / 时间线 / 证据轨迹 / 理解演进 / 问题 / 张力 从导航消失，仅 URL 可达（研究员 / 溯源用）。设置（Settings，运营/配置非每日思考面）也移出主导航，URL 可达。
- 我的画像：**从负担页摘出，保留为独立自我观照入口**，但重新定义为"镜子"——见 §8。

## 8. 后续（待实现，不在本 Reset 的 UX Gate 范围内）

- **首页 Moment 升级**：V2 Cross-Time Contrast 落地后，首页"继续思考"卡升级为「把你过去说过、但从未同时看到的两段话放在一起」的 Moment（只并置原文，不解释变化，解释权归用户）。
- **我的画像重做（镜子，不是档案）**：从"AI 对你的理解报告"改造成"我在 Mirror 中看见的自己"。呈现三类镜面材料（均可在上下文里展开回 Evidence，不把 Evidence 当目的地）：
  - 反复回来的（你一次又一次谈到的主题）
  - 正在变化的（"你以前倾向于…最近开始…"）
  - 仍然悬着的（某判断已出现 N 次但无稳定结论）
  - 关键：把解释权交还用户。画像可以给出基于 Evidence 的 scientific characterization（含人格 / 行为层面构念、置信度、反例与替代假设），但不得把描述升级为宿命、不得替用户做决定（遵守 `constitution/Constitution.md` Article 18 / `specs/concepts/AI_Capability_and_Sovereignty.md` §3，原 S-6.3 已改为认识论治理而非词汇禁用）。
  这部分需要后端聚合 recurring/changing/unresolved + judgment 层，属独立实现任务，不在本 Reset 前端收口中。
- **Inbox 概念重定义**：从"待办页面"退化为 Ephemeral interaction state——Mirror 在对话/首页/画像里就地提出一次判断（是/不是/以后再说），处理即消失，不累积 backlog。
