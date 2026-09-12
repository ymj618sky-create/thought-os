# ADR-0032 — Rendered Web Evidence

**Status**: Proposed（2026-09-10）
**Stage**: Step 1 — **本阶段不改生产代码**
**Track**: A（Reality）——阻断真实使用的问题

---

## 1. Context：诊断证据

2026-09-10，用户把一个 `chatgpt.com/share/...` 链接丢进对话，Mirror 回复「打不开链接」，
但引用区却显示 **HTTP 200 + 正确标题**。实测该 URL：

| 指标 | 实测值 |
|---|---|
| HTTP status | `200` |
| HTML 体积 | `637,546` 字节 |
| 剥离 script/style 后可见文本 | **20 字符**（仅标题） |
| 对话关键词「维特根斯坦」原样 | 不存在（index = -1） |
| 同上，`\uXXXX` unicode 转义形式 | 不存在（index = -1） |
| `linear_conversation` 字段处 | 仅为 RSC/Flight **字段名常量表**（如 `[118,119,...]`），无对话数据 |

**结论**：该页面是重度 SPA，初始 HTML 只含应用骨架与数据结构定义；
**正文需浏览器执行 JS 后再异步拉取**。HTTP fetch 无法获得正文。

这与 `UrlFetchTool` 自身文档一致（ADR-0030 §0.5）：

> 已知局限：不解析 JS 渲染的 SPA —— 抓到的可能是空壳 HTML；
> SPA 由未来 ADR-0032 处理。

---

## 2. Problem：`UrlFetchTool` 的实际语义窄于其承诺

P0/P1/P2 建立的核心承诺是：

> 用户把外部材料带进对话，Mirror 能把它转化成 Evidence。

而当前实际能力是：

```text
静态网页  → HTTP Fetch → Evidence ✓
SPA/动态页 → HTTP Fetch → 200 ✓ → 标题 ✓ → 正文 ✗ → 「打不开」✗
```

即 **URL → Evidence** 实际退化为
**URL →「若服务器直接给正文，则 Evidence」**。

用户视角的断裂在于：系统已经返回 HTTP 200、标题、Citation，
却告诉用户「打不开」——**Tool Runtime 的核心承诺与用户体验之间出现断裂**。

> 注意：Mirror 没有假装看过（没有瞎评）是**对的**；
> 缺陷在于它**拿不到**内容，以及失败表述不准确（不是「打不开」，而是「拿到了但正文需渲染」）。

---

## 3. Decision：HTTP Fetch 为主，Rendered Fetch 为 **fallback**

```text
        HTTP Fetch
             ↓
        正文充分？
      ┌──────┴──────┐
     Yes            No
      ↓              ↓
   Evidence    render_required
                    ↓
            Rendered Fetch (browser)
                    ↓
                 Evidence
```

**Playwright 不是替代 HTTP Fetch，而是 fallback。**
绝大多数普通网页仍走现有轻量路径；只有检测到需要渲染时才启动浏览器。
目标：**不把每一次 URL Fetch 都变成启动 Chromium。**

---

## 4. 六项裁定

### 裁定 1 — Rendering Trigger：不是「HTTP 失败」，而是「正文不足」

本案例中 HTTP **成功了**，因此触发条件不能是 `HTTP fetch 失败 → Playwright`。

草案触发条件（全部满足才 `render_required`）：

```text
① HTTP 2xx 且 Content-Type 为 text/html / application/xhtml+xml
② 剥离 script/style 后的可见文本 < 阈值（草案：500 字符）
③ 原始 HTML > 阈值（草案：20 KB）——即「大而空」
④ 无 <article> / <main> 实质内容
```

命中 → `render_required`。

### 裁定 2 — Browser Runtime：Playwright + Chromium，但范围受限

首选 `Playwright + Chromium`。ADR 必须同时裁定：

- Node runtime / Tauri desktop / Web deployment
- packaging、binary size、cold start、lifecycle
- **Desktop / Web Runtime 承担 Rendered Web Evidence**
- **Mobile 暂不承担 browser runtime**（不得默认把同一 Chromium runtime 带进移动端）

### 裁定 3 — Security 必须**继承 P0**，而不是另起炉灶

`UrlPolicy` 是 **前置约束**，不是可被浏览器路径绕过的一层。

浏览器渲染会显著扩大 SSRF 面——尤其是**页面 JS 自己发出的请求**：

```text
initial URL → navigation → redirect → subresource → iframe → XHR/fetch → 内部地址
```

**Browser Context 必须有自己的 network boundary**，所有出网请求（含页面自发请求）
均须过 `UrlPolicy`。不得因为「UrlPolicy 已存在」就认为安全问题已解决。

### 裁定 4 — Prompt Injection：渲染内容仍然是 **Untrusted External Evidence**

```text
Rendered Page → Untrusted External Evidence   ✅
Web Page JS / Text → Agent instruction        ❌
```

渲染后能拿到更多内容，意味着也能拿到更多恶意内容。此约束**不得**因引入渲染能力而松动。

### 裁定 5 — Citation 必须标注 `retrievalMode`

```jsonc
{
  "source": "external",
  "retrievalMode": "rendered",   // 或 "http"
  "url": "...",
  "title": "...",
  "excerpt": "...",
  "retrievedAt": "..."
}
```

用户据此知道：Mirror 不只是抓了 HTML，而是**实际渲染了页面**。这对可解释性是必要的。

### 裁定 6 — 范围控制：Rendered Fetch **不是** Browser Agent

**ALLOW**

```text
Navigate → Render → Read → Extract Evidence
```

**DENY**

```text
click / type / login / upload / download / purchase / submit
execute arbitrary JS
```

否则 `URL Fetch → Browser Rendering` 会悄然变成 Computer Agent，范围瞬间失控。

---

## 5. 执行顺序

| Step | 内容 | 状态 |
|---|---|---|
| **1** | 写 ADR-0032（本文件） | ✅ 进行中 |
| **2** | **Spike**：验证 `chatgpt.com/share` 渲染后能否获得完整 conversation text；同时测一个静态页，确认不无条件走 Chromium | 待启动 |
| **3** | 实现 `UrlFetchTool` → static → insufficient → `RenderedUrlFetchTool` | 依赖 Step 2 |
| **4** | Track A E2E：用户发 ChatGPT Share URL → Mirror 实际读取 → 回答内容问题 → Citation 正确 | 依赖 Step 3 |

---

## 6. Spike 验收标准（先写死，避免事后自欺）

**判定为成功（继续 Step 3）**，须同时满足：

1. 渲染后能提取到该分享页的**对话正文**（含 user 与 assistant 文本，非仅标题）
2. 对一个普通静态网页，**不触发**渲染路径（仍走 HTTP fetch）
3. 资源与耗时在可接受范围（需记录：冷启动、单次渲染耗时、内存峰值）

**判定为失败（重新评估，不强行推进）**：

- 若该站点仍需 **session / 内部 API / 反爬对抗 / 登录态** 才能取到正文
  → **不为「能打开」无限堆工程**。回到 ADR 重新评估价值/成本，或降级为「提示用户粘贴」。

Spike 结论必须落回本文件，作为 Step 3 的准入依据。

---

## 6.1 Spike 结果（2026-09-10 执行）

### 结论：**PASS**

| 项 | 结果 |
|---|---|
| 对照 A · HTTP fetch 分享页 | `200` / 638,221 字节 / **可见文本 20 字符**（仅壳）→ 复现问题 |
| 对照 B · HTTP fetch 静态页（InfoQ） | 可见文本 **9,049 字符** → `render_required = NO` ✅ 不触发渲染 |
| 渲染后 · 分享页 | messageNodes 12（user 6 / assistant 6）；补充验证 assistant 正文 **1,489 / 1,460 / 1,988 字符** |
| renderedVisibleTextLen | **6,526**（HTTP 路径仅 20） |

**三项指标（不设阈值，供 Step 3 决策）**

| 指标 | 实测 |
|---|---|
| Chromium 冷启动 | **4,287 ms** |
| navigation → conversation 可读 | **12,341 ms**（首轮）／**15,844 ms**（含滚动触发） |
| Chromium 进程内存 | `chrome-headless-shell` 主进程 ≈ **387 MB**，全部子进程合计 ≈ **650 MB** |

### 关键发现（Step 3 的实现约束）

1. **首轮 assistant `len=0` 的真正原因是视口高度不足（900px）导致懒加载未触发**，
   不是流式渲染未完成——改为 viewport 2400 + 滚动后，**41 ms** 即读到正文。
2. 等待条件必须是「**正文非空**」，而非「DOM 节点出现」——否则会拿到空节点误判成功。
3. 单次渲染总耗时 **12–16 秒**（含冷启动 4.3 秒）。同步阻塞对话不可接受，
   Step 3 必须设计异步 / 进度呈现。
4. 内存 ≈ 387 MB（主进程）：**桌面可接受；Web / Mobile 不成立**——与裁定 2 一致
   （Mobile 不承担 browser runtime）。

### 准入结论

证据支持进入 Step 3。但 Step 3 涉及：Playwright 进入项目依赖、Chromium 分发/打包、
Browser Context 网络边界、超时与并发控制、异步呈现。
**建议在 ADR 补充实现计划后再解冻生产代码。**

> 附：Spike 在 `thought-os` 项目外的临时目录执行
> （`D:\Claudecode\Mirror\_spike-adr0032`），Chromium 下载至全局缓存
> `%LOCALAPPDATA%\ms-playwright`，**未污染项目依赖与打包链路**。

---

## 6.2 Step 3a 实现与验收（2026-09-10 完成）

### 实现内容（生产代码，限定 Rendered Web Evidence 这条 Track A）

| 文件 | 改动 |
|---|---|
| `src/tools/types.ts` | `Citation.retrievalMode: 'http' \| 'rendered'`（ADR 裁定 5：必须标注获取方式） |
| `src/tools/RenderedUrlFetchTool.ts` | **新建**。Playwright Chromium 渲染；viewport 2400 + 滚动（Spike 发现的懒加载正确性参数）；就绪条件是「正文非空」非「节点存在」；硬超时 25s 降级；渲染产物仍是 Evidence |
| `src/tools/UrlFetchTool.ts` | HTTP 主路径 + fallback 判定：`HTTP 2xx 且可见文本 < 500` → 渲染补齐，单一 URL 位替换空壳 citation |
| `src/api/container.ts` | 装配 `RenderedUrlFetchTool`（可选能力：playwright 缺失时自行降级，不阻断启动） |
| `scripts/build-runtime.mjs` | `playwright` / `playwright-core` 标为 external，运行时从 node_modules 动态解析（不并入 bundle） |

### 验收门槛（5 个真实行为）

| Gate | 验证方式 | 结果 |
|---|---|---|
| **R1** 静态网页 → HTTP，不启动 Chromium | mock fetch（2000 字符正文）+ fake renderer → `rendered_count=0` | ✅ PASS |
| **R2** ChatGPT Share → HTTP insufficient → Rendered | mock fetch（空壳）+ fake renderer → 触发渲染 | ✅ PASS |
| **R3** 渲染拿到 user + assistant 正文 | **真实 Chromium** 渲染 chatgpt.com/share → user=2 / assistant=3 / 中文对话 6158 字符 | ✅ PASS |
| **R4** Citation 标注 `retrievalMode=rendered` | R2/R3 的 citation = `rendered` | ✅ PASS |
| **R5** 页面恶意/异常子请求不破 UrlPolicy | fake page + 真实 UrlPolicy：云元数据 `169.254.169.254` → `abort`，外部 `example.com` → `continue` | ✅ PASS |

### 回归契约

`tests/tool-rendered-fetch.test.ts`：R5 + R1/R2/R4 为确定性、无需 Chromium、始终跑；
R3 为 `RENDERED_INTEGRATION=1` 手动触发的真实 Chromium 集成测试。

### 部署

`(Mirror reference product)` 已同步至 `releases/Alpha-0/dist-runtime/`，
并随包复制 `playwright` / `playwright-core`。发布 runtime 语法校验通过、playwright 可解析 chromium。

### 仍为 3a 之外（按裁定不做）

Chromium 打包分发 / 首次下载 / Web / Mobile / 多实例 / 长期缓存 / Browser Agent。
异步呈现目前以「硬超时 25s + 超时降级」兜底（< ToolInvocationGuard 35s），
**真正的后台异步/进度推送**留作后续独立项——3a 已满足「Runtime 不把普通聊天请求变成 16 秒同步长阻塞」的底线，但未做流式可见进度。

---

## 7. 开放问题（实现前须裁定）

- Chromium 打进 Tauri / SEA 的**体积与更新策略**（安装包增量、分发、升级）
- 子资源加载策略：全允许 / 仅同源 / 仅文档请求
- 渲染**超时**与**并发上限**（防止拖垮 Runtime）
- 每次渲染的 CPU / 内存 / 时间成本，是否需要缓存与配额
- 失败降级路径：渲染超时或崩溃时，如何向用户诚实呈现

---

## 8. 与双轨纪律的关系

本 ADR 属于 **Track A**——修阻断真实使用的问题。

> **Observation Gate 的意义不是禁止修复真实阻断问题。**

若真实使用已证明 `URL Fetch` 在用户**最自然的 URL 类型之一**上失效，
那么修它本身就是 Observation 的一部分，而不是逃避 Observation。

但仍严格遵守：

```text
先 ADR → Spike → 真实证据 → 再决定是否引入 Playwright
```

**不在证据出现前引入 150MB 的 Browser Runtime。**
