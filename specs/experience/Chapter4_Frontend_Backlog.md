# Chapter 4 → 前端改造 Backlog（对照 `public/app.js` + `chat.js` 现状）

> 目的：把《Cognitive Experience Layer v0.1》Chapter 4 的 5 屏 + 跨屏规则，逐条对照当前 Web UI 实现，列出**真实缺口**与落地工作量。所有条目均不引入新认识论实体（Article 0），仅新增查询 / 呈现 / 路由。
> 审计基线：`(Mirror reference product)`、`(Mirror reference product)`、`thought-os/src/api/app.ts`（46 条路由，无 `reflection`）。

## 0. 总览

| 章节 | 规范要求 | 现状 | 缺口大小 | 优先级 |
|---|---|---|---|---|
| 4.1 首页 Landing | "继续 / 新建"双路径 + 主题聚类 + 首启空状态 | 默认路由渲染 `viewCapture()`（写入屏），非 Landing；`/chat` 仅 `loadRecall()` 单条横幅 | 中 | P0 | **✅ 已实现**（2026-07-30） |
| 4.2 Chat | 选项式澄清 + S-3.4"系统注意到（依据 #Ex）" + 上下文条 + [修改]/[丢弃] | 纯文本气泡，无选项按钮、无 S-3.4 框架、无上下文条 | 中 | P0 | **✅ 已实现**（2026-07-30） |
| 4.3 Reflection | 生成思考记录页（主题/关注/张力/问题 + [保存]） | **完全缺失**：无 `/api/reflection`、无 `/reflection` 路由、无 Generator | 大 | P0 | **✅ 已实现**（2026-07-30） |
| 4.4 我的思考空间 | 汇总头部（最近关注/长期价值/最近变化）+ 入口卡片 + Belief 视图 | `viewSpace()` 罗盘/列表/详情/Review 已存在；缺汇总头部、入口矩阵、Belief 独立视图 | 小-中 | P1 |
| 4.5 Timeline | 按月聚合 + 变化点高亮 | **完全缺失**：无路由、无视图 | 中 | P0 | **✅ 已实现**（2026-07-30） |
| 4.6 S-3.4 跨屏 | 每屏 AI 内容"系统注意到（依据 #Ex）"+ [修改]/[丢弃] | 收件箱三选项等权（精神符合）；但缺显式措辞 + [修改]改写入口（ADR-0012 未在 UI 暴露） | 中 | P0/P1 贯穿 |

---

## 1. 4.1 首页 Landing（P0）

**现状**（`app.js`）：
- 默认路由 `/` 由 `boot()` 渲染 `viewCapture()`（`app.js:284`，Layer 0 写入），是"写下此刻脑子里的话"的捕获屏，不是规范要求的"落地页"。
- `/chat` 的 `loadRecall()`（`chat.js:164`）只取**单条**最新已确认 Thought 显示横幅，无主题聚类、无"继续昨天的思考"列表。
- `index.html` 是 SPA 壳，无独立 Landing 视图。

**缺口**：
1. 新增 Landing 视图（或把默认层改为 landing）：查询最近 `active` `Thought`，按 `lattice_level`/主题聚类出"最近关注"，读取会话游标（`pending_slots`/`stalled_prompts` 或上次会话时间窗）→ "继续昨天的思考"主题列表（`app.js:262` 数据来源描述）。
2. 点击主题 → 进 `/chat` 并带入该主题上下文（呼应 §3.8 连续体验，复用 `chat.js:300` 的 `loadResume` 机制）。
3. 首启空状态：无历史时仅显示"开始新的思考 [输入]"，不渲染空主题列表。

**工作量**：纯前端 + 一个聚合查询端点（`/api/thoughts` 已可返回全部，前端聚类即可，无需新后端）。约 0.5–1 天。

**✅ 已实现（2026-07-30）**：`public/app.js` + `public/chat.js` + `public/style.css`。
- 默认落地页改为 Landing（非 chat-first）：`state.layer` 初始 `landing`，`render()` 新增 `case 'landing'`，NAV 首位加「首页」入口，`boot()` 在 `thoughts`/`stalled` 加载后重渲染以展示主题聚类。
- Landing 视图（`viewLanding`）按规范 §4.1：查询最近 active 且未被取代的 `Thought`，按 `lattice_level` 聚类出「最近关注」主题卡片（晶格名 + 该主题最近一条 Thought 预览 + 数量）；叠加 `stalled_prompts` 作为「上次没聊完」继续项；空状态仅显示「开始新的思考 [输入]」。
- 「继续昨天的思考」点击 → 写入 `sessionStorage.mirror.resume = { topic, preview, prompt }` 并跳转 `/chat`；`chat.js` 的 `loadResume()` 扩展支持 `topic` 模式，进入对话即显示「你之前在思考『主题』：预览」横幅并预填承接语（呼应 §3.8 连续体验）。
- 「开始新的思考」输入回车/点击 → 若非空则携带开头内容进 `/chat`（recall 显示「你带来了一个开头」），空白则直接新建会话（兜底走原 `loadRecall` 单条横幅）。
- 未做：独立的 `index.html` 静态 Landing（仍是 SPA 内部视图）；主题聚类用晶格层而非语义标签（系统无 topic 字段，引入即违反 Article 0，故克制）。

---

## 2. 4.2 Chat 页面（P0，需补 S-3.4 重框 + 选项式澄清）

**现状**（`chat.js`）：
- `send()`（`chat.js:184`）把 `/api/chat` 返回的 `data.reply` 作为**纯文本气泡**渲染（`msgHtml`，`chat.js:82`），不解析结构。
- 后端其实已经返回结构化信号：`data.presentedSlot`（`chat.js:213`）、`data.slot`（`216`）、`data.sideEffects`（`217`）、`data.runtime`（`227`）——但前端**只**用 `runtime` 画了 [换一个]/收束提示（`chat.js:103`），其余未用。
- Questioner 的澄清问题**不参与 chat**：`/api/questioner/*` 只在 dashboard 的 `viewCapture()` 触发（`app.js:462`），chat 页没有"Understanding Mode 选项式澄清"。

**缺口**（对照 §4.2 线框）：
1. **选项式澄清 UI**：当 `presentedSlot.kind === 'questioner_clarify'`（或等价结构）时，把 A/B/C/D 渲染为可点击选项，点击即作为下一条 user 消息发送（`chat.js:200` 的 `send` 复用）。需先确认后端 `presentedSlot` 是否携带 `options[]` —— 若未携带，需 `Orchestrator` 在 Understanding Mode 下附带选项（后端小改）。
2. **S-3.4 呈现重框**：AI 气泡内容前缀"系统注意到（依据 Evidence #x）"，并标注"这是系统的观察，你可改写或丢弃"（§3.12.5）。目前气泡只显示"小镜"说话人（`chat.js:83`），无任何"依据"标注。
3. **上下文条**：会话顶部显示"职业方向 · 上次关注成长感"（§4.2 线框首行），当前 chat 页只有 `recallEl` 横幅（`chat.js:37,164`），非常驻上下文条。
4. **[修改]/[丢弃]**：每条 AI 节点带 affordance（§3.6）。当前 chat 页无此入口（`chat.js` 全文无 `修改`/`丢弃` 字样）。

**工作量**：前端为主（选项渲染 + 气泡模板改造 + 上下文条 + [修改]/[丢弃] 抽屉）；选项数据若后端未给则需 Orchestrator 小改。约 1–2 天。

**✅ 已实现（2026-07-30）**：`public/chat.js` + `public/chat.html` + `public/style.css`。
- `presentedSlot` 不再只是气泡分隔线，而是渲染成 **S-3.4 系统观察卡片**：`interpretation_confirm` → "系统注意到（这是系统的观察，不是定论）" + [符合我的想法][部分符合][不是这样]；`thought_wording_confirm` → "系统把上面的观察改写成你的口吻" + [就这么说][改成我自己的话]；`question` → "系统想多理解你一点" + [采纳这个问题][暂不采纳]；`clarify_retry` → "我有点没抓准" + [换种方式再问]。按钮点击通过 `/api/chat` 的 `action` 字段（后端早已支持 `actionOverride`）直接作用于下一个待解 slot，无需自然语言。
- [不是这样]/[改成我自己的话] 展开输入框，提交 `reject(reason)` / `wording_edit(content)`，对应 ADR-0012 的"用户改写措辞"。
- **关于"选项式澄清 A/B/C/D"**：规范示例是 Understanding Mode 的多选题。本次落地为"结构化可选项卡片"（点击式确认/追问），已经是选项式交互；真正的"AI 生成 A/B/C/D 选项"需要 Questioner 产出 `options[]`（后端增强），列为后续项，不在本次范围。
- 未做：常驻"上下文条"（当前关注主题）——属锦上添花，未实现。

---

## 3. 4.3 Reflection 页面（P0，核心差异，目前 100% 缺失）

**现状**：
- `src/api/app.ts` 搜索 `reflection`：**0 匹配**。无 `/api/reflection` 端点。
- 路由表（`app.ts:1015-1025`）：仅 `/`、`/chat`、`/review`(→`/#review`)、静态资源。`/review` 是 dashboard 的"沉底候选"面板（`app.js:702`），**不是**会话反思总结。
- 无任何 Reflection Generator / delta 聚合逻辑存在于 `src`。

**缺口**（对照 §4.3 线框 + §3.4/§3.5）：
1. **触发**：Runtime `stop`/`switch` 或用户主动结束时（`chat.js:103` 已能感知 `runtime.decision`），显示 `[生成我的思考记录]`。当前 stop 只弹一行淡提示（`chat.js:122`），不引导进 Reflection。
2. **生成端点** `/api/reflection`：聚合本次会话时间窗内的新 `Observation`/`Interpretation`/`Thought`/`Relation` **delta** + `Relation(challenges)` 张力 + `lattice` 聚类出"当前关注"，产出 Reflection Summary（新 prompt，遵守 S-3.2 三层可区分 + S-9.3 可查依据）。**这是后端最大新工作。**
3. **Reflection 页面**：渲染 主题 / 当前关注 / 张力 / 未决问题，每条洞察带 [修改]/[丢弃]，底部 [保存为我的思考记录]。
4. **空状态**：会话未产生足够节点 → 提示"这次还没沉淀出明确想法"，不强行生成。

**工作量**：后端（delta 聚合 + 生成 prompt）为主，前端（新页面 + 路由）为辅。**最大单块缺口，约 3–5 天。**

**✅ 已实现（2026-07-30）**：后端聚合 + 前端浮层均已落地。
- 后端：`src/services/reflection.ts` → `buildReflection(repos, userId, since)`：按晶格层聚类"当前关注"（演化掉的旧版本不计入）、复用 `TensionMapService` 出"张力"、未归档 Question 出"未决问题"、被 superseded 的想法出"变化点"。克制设计——**仅聚合已落库实体，不做 LLM 二次生成**（mock 模式也可稳定产出），不引入新认识论实体（Article 0）。`src/api/app.ts` 新增 `GET /api/reflection?since=<会话起点>`。
- 前端：`chat.js` 顶栏"⤓ 记录"按钮 + stop 时的"生成这次的思考记录"链接 → `fetchReflection()` → 右侧滑出 Reflection 浮层，分"当前关注 / 张力（仍共存）/ 未决问题 / 变化点"四段，底部 [收下这份记录]。思考产物本就是已确认实体，故"保存"= 收下查看（artifact 已沉淀），不重复落库。
- 测试：`tests/reflection.test.ts`（3 例）验证聚合 + `since` 过滤 + 空数据，全过；`tsc --noEmit` 通过。

---

## 4. 4.4 我的思考空间（P1，基础已具备）

**现状**（`app.js:669` `viewSpace()`）：
- 12 晶格罗盘（`buildCompass`，`app.js:737`）+ 列表/详情（`thoughtList`/`thoughtCard`/`thoughtDetail`）+ 沉底候选 Review 面板（`app.js:702`）已完整。
- Tension Map（`viewTension`，`app.js:876`）、Questions（`viewQuestions`，`app.js:949`）已独立存在。
- Belief：仅 `state.synthesis` 一条 nudge（`app.js:690`），**无独立 Belief 视图**（§3.12.3 标注"部分实现"）。

**缺口**：
1. **汇总头部**：`最近关注 / 长期价值 / 持续探索 / 最近变化`（§4.4 线框）目前没有；需对 `state.thoughts`/`tensions`/`questions` 做轻聚合。
2. **入口卡片矩阵**：`[Thought Map][Conflict Map][Belief][未决问题]` 跳转块（目前靠左侧 NAV 分散进入，无 §4.4 的集中入口卡片）。
3. **Belief 独立视图**：基于 `superseded` 链 + `synthesis` 的前后对照（§4.5 变化点链接目标）；当前仅 nudge。

**工作量**：纯前端聚合 + 入口卡片 + Belief 视图（复用 `/api/thoughts` + `/api/synthesis`）。约 1–2 天。

---

## 5. 4.5 Timeline 页面（P0，完全缺失）

**现状**：无 `/timeline` 路由、无对应 `viewXxx`。`app.js` NAV 无 timeline 项（仅 `capture/inbox/space/tension/questions/evidence/users/settings`）。

**缺口**（对照 §4.5 线框）：
1. 新路由 `/timeline` + `viewTimeline()`：按 `created_at` 月桶聚合 `Thought`/`Interpretation`/`Observation`（`/api/thoughts` 等已返回全量，前端按月分组）。
2. S-4.3 优先展示关系变化；`superseded` 链标注"变化点"（★），点开链接到 Belief 前后对照（与 4.4#3 共用）。
3. 首启空状态："你的认知时间线会在这里慢慢长出来"。

**工作量**：纯前端聚合（数据已齐）。约 1 天。

**✅ 已实现（2026-07-30）**：作为 P0 第一刀的"低风险快赢"，先落地以验证 Chapter 4 的落地方式。改动：
- `public/app.js`：NAV 加「时间线」入口；`render()`/`boot()` 加 `timeline` 分支与 `#timeline` 深链；新增 `viewTimeline()`——按 `confirmed_at||created_at` 月桶聚合 `state.thoughts`，`status==='superseded' || superseded_by` 标 ★ 变化点；复用 `thought` 动作（已增强：从时间线点开跳到思想空间详情）。
- `public/style.css`：追加 `.tl-month/.tl-list/.tl-star` 等样式，遵循视觉系统（层级靠排版、琥珀仅给张力信号）。
- 限制：v1 仅聚合 Thought（确认后的认知历史）。Interpretation/Observation 的月聚合、以及 ★ 变化点点击展开"前后措辞对照"（需配合 4.4 Belief 视图）留作后续；synthesis 漂移 nudge 暂不进时间线。
- 校验：`node --check public/app.js` 通过。

---

## 6. 4.6 跨屏 S-3.4 落地（贯穿 P0/P1）

**现状**：
- 收件箱三选项等权 + "不是这样"rebuttal 存证（`app.js:578` `interpCard`、`:1359` `reject-confirm`）——**精神符合** S-3.4（AI 不替用户决定）。
- 但缺：① 显式措辞"系统注意到…（依据 Evidence #x）"（§3.12.5 要求）；② **[修改] 改写措辞入口**——ADR-0012 的 `thought_wording_confirm`（把 AI 推测语气改写为第一人称陈述句）**未在 UI 暴露**，用户只有"不是这样"（存新证据）而无法直接"改写 AI 的措辞为我的措辞"。

**缺口**：
1. 所有 AI 生成内容统一前缀"系统注意到（依据 #Ex）"+ 标注"这是系统的观察，你可改写或丢弃"。
2. 收件箱 Interpretation 卡片增加 `[修改]`：打开输入框让用户用自己的话改写，落为 user-confirmed `Thought`（满足 S-3.2）；当前只有"认同并存起来/认同先不存/不是这样"。
3. Chat 气泡（见 §2#2/#3）同步 [修改]/[丢弃]。

**工作量**：前端模板改造（收件箱 + chat）。约 1 天。

---

## 7. 建议落地顺序（MVP 关键路径）

```
P0 第一刀：4.3 Reflection Generator + 页面   ← 核心差异，最大缺口，先定后端契约（**已完成**）
P0 第二刀：4.2 Chat S-3.4 重框 + 选项式澄清   ← 对话层即用户体验入口，纯前端可先动（**已完成**）
P0 第三刀：4.1 Landing + 4.5 Timeline          ← 纯前端聚合，低成本补完"闭环两端"（**4.5 已完成**；**4.1 已完成**）
P0/P1 贯穿：4.6 S-3.4 [修改]/[丢弃] 入口       ← 与 4.2/收件箱同步
P1：4.4 汇总头部 + 入口卡片 + Belief 视图
P2：移动端（§4.6 已知 Hono 绑 127.0.0.1 限制）
```

**关键风险**：4.3 Reflection 是唯一需要**新后端逻辑**（delta 聚合 + 生成 prompt）的屏；其余 4 屏均为"已有 6 实体查询 + 前端新呈现"，风险低、可并行。建议先写 4.3 的后端契约（输入=会话时间窗，输出=delta + Summary），再让前端 4.2/4.5/4.1 并行推进。

---

*本 backlog 为 Chapter 4 的实现对齐清单，遵循 Article 27（Specification 高于实现）。任何界面迭代不得反向变更 6 实体模型或 S-x.x 规则（S-9.1）。*

---

## 领域演进 Phase 1：Space Aggregate（Product Experience Core Spec v0.1）

**决策（已与用户拍板）**：这不是推翻 Chapter 4，而是领域模型从 Artifact-centric → Space-centric 的"补层"。
- **保留（Kernel 不动）**：6 实体、12 晶格 `lattice_level`、Cognitive Protocol、原 Chat、原 Timeline 基础。
- **新增（Product Aggregate Layer）**：`ThinkingSpace` 聚合、`CognitivePosition {what×how}`、`Reflection` 持久化、Artifact↔Space 关联。
- **双层关系**：`CognitivePosition` 不替换 12 晶格，而是"体验层坐标" map 到 12 晶格 + Protocol；`thinking_spaces` / `reflections` 走 `storage.getDb()` 聚合表（与 PendingSlot/StalledPrompt 同模式），**不进 6 实体 ajv 校验管线**。

**✅ 已实现（2026-07-30）**：
- `specs/schemas/Thought.schema.json` / `Question.schema.json`：因 `additionalProperties:false`，显式声明 `space_id`（及 Thought 的 `source_reflection_id`）为可选字段 → 旧记录无此字段仍合规，新写入携带 `space_id` 通过 ajv。
- `src/schema/index.ts`：Thought/Question 接口新增 `space_id?` / `source_reflection_id?`。
- `src/models/SpaceStore.ts`：聚合层建表（`thinking_spaces`、`reflections`）+ Space/Reflection CRUD + `CognitivePosition` 枚举与中文标签（`what∈{decision,identity,value}`、`how∈{business,psychology,philosophy}`）。
- `src/services/space.ts`：`SpaceService` 编排——聚合表走 `SpaceStore`，Artifact 归属（associate）经 `repos.*.update` 复用 6 实体 ajv 校验；非法 `what/how` 抛 `SpaceValidationError`。
- `src/api/app.ts`：启动期 `spaceService.ensureSchema()` 幂等建表；新增路由 `GET/POST /api/spaces`、`GET/PATCH /api/spaces/:id`、`GET/POST /api/spaces/:id/reflections`、`POST /api/spaces/:id/associate`。

**验证**：`tsc --noEmit` 全绿；内存库冒烟测试覆盖建表 / Space+Reflection CRUD / 带 `space_id` 的 Thought·Question 落库 / associate 更新路径 / 非法位置被拒。

**⏸ Phase 2（前端闭环，未做）**：
- 新用户 Landing 创建 Space；老用户 Home=Thinking Spaces 列表（4.1 Landing 改身份，不删除）。
- Space View（汇总 + Position 展示）、Conversation View 会话 → Reflection 提交 → Space Position 更新。
- Reflection 从只读浮层升级为事件：`reflections` 落库并反向写入 Thought `source_reflection_id`、Space `current_what/how`。
- 不重做 12 晶格 UI 主页、不做复杂认知地图、不做全量数据迁移。
