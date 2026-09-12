# Raw Evidence Ingestion — V1 收口文档（CLOSED）

> 状态：**V1 CLOSED**（2026-09-04）。本文档锁定 V1 契约，并冻结 V2 的严格语义边界，防止后续任何上层能力"偷渡"解释。
> 配套实现：`src/ingestion/`、`src/schema/index.ts`（EntityType `raw_evidence`）、`specs/schemas/RawEvidence.schema.json`、`src/api/routes/ingest.ts`、`src/api/routes/rawEvidence.ts`、前端 `ImportMyWriting`（导入面板）+ `Library`（「我的文字」库页）。
>
> **V1.1（RawEvidence Library）已于 2026-09-04 落地**——只补 Information Architecture（让导入的 RawEvidence 有"家"，并加 `type` 这个 provenance 标签），**不改动 §2 任何语义边界**：`type` 由用户/适配器在摄入时提供，绝不来自 AI 语义判断；内容仍不可变；库页只展示原文，无摘要、无解释、无 AI 分类。详见 §8。

---

## 1. V1 是什么

让过去的自己进入 Mirror，而且**保持原样**。

```text
Import My Writing
      │
      ▼
MarkdownAdapter / TextAdapter   （SourceAdapter 接口，可继续挂 Douban / Diary …）
      │
      ▼
RawEvidence                     （source-agnostic 原始材料）
      │
      ▼
EvidenceNormalizer              （只算 content_hash + id，不做解释）
      │
      ▼
RawEvidenceStore                （复用统一 Storage，content 不可变）
      │
      ▼
持久化（异步归档到 SQLite，重启不丢）
```

Kernel 只认识 `RawEvidence { id, author, content, timestamp, source, source_ref, metadata }`，**不知道** Douban / Markdown / Diary 等任何具体源。源越来越多，Kernel 不因此变复杂。

## 2. V1 边界（已钉死，不可后退）

| 规则 | 落地方式 |
|---|---|
| RawEvidence 是 ingestion artifact，不是 Thought | `status='raw'` |
| 不带 interpretation / sentiment / topic / thought / embedding | `RawEvidence.schema.json` 用 `additionalProperties:false` + `not` 块**在 schema 层禁止**这些字段 |
| content immutable | `RawEvidenceRepo.override update()` 抛 `ConstraintViolationError`；写入后只能整条移除 |
| provenance 一等公民 | `source / source_ref / timestamp / content` 全部持久化，重启后保持 |
| 去重键 | `content_hash + user_id + source + source_ref`，避免"重复导入 = 制造重复认知材料" |
| 不自动形成 Thought | 摄入层不调用任何 Kernel 写路径 |

**关键不变量**：`RawEvidence = historical ground truth`。任何后续 pipeline 都不得改写原文；否则"过去 vs 现在"会比较两个经过不同解释/清洗的对象。

## 3. V1 明确不做（non-goals）

- recurrence / tension / revision detection
- semantic relation / graph / similarity
- Relation Engine
- LLM interpretation / summary / embedding / sentiment / topic
- background / silent synchronization
- 自动人格画像或 growth/change 分析

## 4. 使用方式

- Web：侧栏「我的文字」（库页，RawEvidence 的真正 home）→ 时间轴（年 → 月.日 + 标题）为主，不是文件列表；顶部按类型筛选（全部 / 日记 / 影评 / 书评 / 随笔 / 其他）；点开 = 原文，不摘要、不解释；导入入口内嵌在库页内。
  - 导入时由用户选「内容类型」（provenance 标签）：日记 / 影评 / 书评 / 随笔 / 其他。CLI 同样用 `--type` 指定。
  - 粘贴 Markdown / 纯文本（可用 `---` 分段，frontmatter 写 `date:/title:/author:` 会被机械提取）。
- CLI（批量导入真实历史材料）：
  - `mirror import <文件或目录> [--type diary|movie_review|book_review|essay|other]` — 递归导入目录下所有 `.md/.markdown/.txt`，指定 provenance 类型
  - `mirror raw-evidence list [--source <src>] [--limit N]` — 人工浏览已摄入的原始材料（只读，不解释）

## 5. V2 严格定义（FROZEN INTENT，暂未实现）

> V2 研究问题：**当用户看到自己过去和现在的原文并置时，是否会自发产生一个此前没有明确意识到的判断？**

### 5.1 语义钉死

- **Mirror 不解释"你发生了什么变化"，只制造一个让用户自己看见变化的对照面。**
- V2 **不应该**产生：`你以前比较悲观，现在更自信` / `你对事业的态度发生明显变化` / `你的核心价值观正从 A 漂移到 B` —— 这些都已进入 **interpretation**。
- V2 **应该**产生：
  - **过去**：`2024-03-18 "我觉得现在最重要的是先把工作稳定下来……"`
  - **现在**：`2026-08-29 "我越来越觉得稳定本身不是我要的东西……"`
  - 然后只问：`你看到什么了吗？`（或更冷：`这两段放在一起，你有什么感觉？`）

### 5.2 核心对象（刻意极薄）

```text
MirrorMoment
- id
- user_id
- earlier_raw_evidence_id
- later_raw_evidence_id
- created_at
```

- **禁止**把 `difference` / `change_type` / `interpretation` / `significance` 放进去。
- 是否记录用户打开/回应，只作为 instrumentation，不进入语义。

### 5.3 可回溯硬约束

Mirror Moment 必须可追溯到两个 RawEvidence；UI 点进去能回到：

```text
Mirror Moment → Earlier → RawEvidence #123 → Original source / timestamp
             → Later  → RawEvidence #847 → Original source / timestamp
```

### 5.4 selection 保持朴素（第一版不要算法）

- 同一 source
- 明显不同时间
- 足够时间间隔
- 两段文本都有一定长度
- 随机 / 简单规则选 pair

**先验证 Moment 本身有没有价值，而不是先优化"如何找到最精彩的 Moment"。** 不要现在问"怎样算法发现最有意义的两段"——那会重新造 recurrence / similarity / tension / semantic graph。

## 6. 路线

- **V1 — Evidence Ingestion ✅**：让过去的自己进入 Mirror，而且保持原样。
- **V2 — Cross-Time Contrast**：让过去的自己和现在的自己相遇（只并置，不解释）。
- **V3 — User Interpretation**：仅当 V2 证明"用户确实因并置产生新判断"后，再研究如何让用户保存 / 修正 / 关联这些判断。
- **暂不碰**：semantic relation / recurrence / tension / revision detection / portrait interpretation / 自动 change 分析 / 后台同步 / 自动个人画像。

## 7. V2 之前的研究方法（用户自行）

用 V1 导入一批真实历史文字，形成几十到几百条 `RawEvidence`，然后**人工**看：哪些时间跨度的两段原文，单纯并置，就已经产生"操，我以前居然这么想"的瞬间。这批 pair 本身会直接告诉我们 V2 的 selection boundary 应该是什么。

## 8. V1.1 — RawEvidence Library（Information Architecture 补全，不碰 V1 语义边界）

### 8.1 动机（IA 断层，必须在 V2 之前修）

V1 解决了"让过去的自己进入 Mirror 并保持原样"，但导入后 RawEvidence 没有真正的"家"——用户能导入却看不到过去在哪里，造成「Mirror 已经拥有我的过去，我却不知道过去在哪」。这不能作为两个长期并列内容系统（写入 / 导入）的副产品存在。

修正方式：**统一到「我的书写」这一个空间**。
- 「写入」= 用户直接写 → 可即时提取 Evidence（保留）。
- 「导入」= 把已有日记 / 书评 / 影评 / 随笔作为 RawEvidence 带进来 → 成为库页的内容，不是第二个系统。
- 库页是 RawEvidence 的 home；导入是库页内的一个子入口。

### 8.2 新增 `type` 字段（纯 provenance，非 AI）

`RawEvidence` 增加可选 `type`，枚举：`diary | movie_review | book_review | essay | other`。

- 由用户选择（Web 导入面板）或适配器/CLI 提供（`--type`），**绝不来自 AI 语义判断**。
- 缺失类型按 `other` 处理（仅用于筛选，不写入 null，不触发 schema 解释）。
- `type` 不参与任何摘要 / 分类 / 解释 pipeline；它只是"这段原文是什么形式的表达"的机械标签，对应四源模型里的 Monologue（日记）/ Stimulated（书影音 review）/ 其他。

### 8.3 库页 IA（「我的文字」）

- 时间轴为主：按年分组 → 月.日 + 标题（标题取 frontmatter `title` 或首行，机械提取）。
- 类型筛选：全部 / 日记 / 影评 / 书评 / 随笔 / 其他（来自 provenance，非 AI）。
- 点开 = 原文（`pre` 原样展示）+ provenance（source / source_ref / timestamp / 类型 / content_hash 前若干位）。
- **不做**：recurrence / tension / revision / 语义搜索 / AI 分类 / AI 摘要 / Relation / Mirror Moment。库页是 RawEvidence 的 home，不是解释层。

### 8.4 新 API（只读 + 摄入，均不解释）

- `GET /api/raw-evidence?type=<>&source=<>&limit=<N>` — 列出当前用户全部 RawEvidence（按 `timestamp` 倒序），可选按 `type` / `source` 过滤；返回 `{ items, total }`。
- `GET /api/raw-evidence/:id` — 单条原文详情（返回完整 `RawEvidence`，含 `content`）。
- `POST /api/ingest` 增加可选 `type` 字段，原样落库。

### 8.5 不变量保持

- `RawEvidence = historical ground truth` 不变；`type` 只是 provenance 标签，内容不可变（写入后只能整条移除）。
- 库页不调用任何 Kernel 写路径、不触发任何解释；它只是"看见过去"的入口。
- V1.1 是 IA 修复，不是 V2 的前置实现；V2 的 Mirror Moment / selection 仍按 §5 冻结语义，不在库页里偷渡。
