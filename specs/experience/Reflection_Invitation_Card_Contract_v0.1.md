# Reflection Invitation Card Contract v0.1

**所属层**: `specs/experience/Reflection_Invitation_Card_Contract_v0.1.md`
**前置**: `specs/architecture/Continuity_Invitation_Layer_v0.1.md` (ACCEPTED DESIGN, Runtime CLOSED at commit 42add2f)
**层级关系**: Constitution → Architecture Layer → **本文件（UI 体验契约）** → 前端实现
**状态**: ACCEPTED CONTRACT (UI 前冻结，非实现文档)
**日期**: 2026-08-06

> 本契约在写任何 React/UI 代码之前冻结。目的：防止 Phase 2 实现阶段因展示便利反向要求 Runtime 增加字段，从而污染 Projection 边界。

---

## 0. 阶段定位

```
Phase X — Continuity Invitation Runtime CLOSED   ✅ (commit 42add2f)
Phase 2 — Invitation Experience Layer            ← 当前阶段
```

Runtime 已证明"能力存在"（Projection of Projection 成立、Scheduler 无认知权威、沉默纪律有效）。
本阶段验证的是：**用户是否把这个能力体验成"被理解"，而不是"被提醒"。**

两个体验差异很大，所以先冻结契约再实现。

---

## 1. 卡片的身份（Identity）

**它不是：**
- 消息
- 通知
- 提醒
- AI 主动聊天入口

**它是：**
> 一个未完成思考的入口。

**文案纪律（禁止人格化 AI）：**

❌ `小镜想和你聊聊` — 人格化，暗示 AI 有表达欲
❌ `小镜有一个问题想问你` — 同上
❌ `别忘记思考这个问题` — 说教/提醒口吻

✅ `有一个之前未完成的问题，可以继续思考`
✅ `之前关于 {theme} 的思考还没有结束`

UI 文案来源：仅 `ReflectionPrompt.question` 字段，禁止前端自行拼接、禁止调 LLM、禁止根据历史聊天重新总结。

---

## 2. 卡片内容来源（Source Contract）

严格绑定 Runtime 输出：

```
GET /api/reflection-prompts/pending
  → { id, question, context, sourceReflectionEventId }
```

卡片渲染：
- `question` → 主文案（唯一来源）
- `context` → 可选辅助说明（如 `自由 ↔ 稳定`），不展开为新 UI 元素
- 不调用 `buildReflection` / 不读 Reflection 原始数据 / 不生成新文本

**边界（Critical）：**
- 前端不得要求 Runtime 新增 `originalDate` / `topicLabel` / `historySummary` 等字段
- 若 UI 需要更多信息，应从 `ReflectionPrompt` 已有字段派生，或回到 Architecture Layer 评审，不得静默扩展 Projection

---

## 3. 三个动作语义（Frozen）

### 3.1 继续（"聊聊"）
```
ReflectionPrompt (pending/shown)
   ↓ POST /api/reflection-prompts/:id/respond
   ↓ status: shown → answered
   ↓ 进入 Conversation + ContinueContext（现有通道，不变）
```
- `respond` 明确闭环（AC §15.4）：聊天本身不能推断 answered
- 进入的 Conversation 与用户主动回来完全一致，无特殊分支

### 3.2 稍后（"稍后"）
```
ReflectionPrompt (status 不变)
   ↓ POST /api/reflection-prompts/:id/snooze
   ↓ 仅更新 expires_at
   ↓ 重新进入 cooldown 后由 heartbeat 评估
```
- **不改变 status**（AC §15.8）：snooze ≠ dismissed
- 区别于关闭：稍后可重新浮现

### 3.3 关闭（"关闭这类提醒"）
```
ReflectionPrompt (status: dismissed)
   ↓ POST /api/reflection-prompts/:id/dismiss
   ↓ 更新 ReflectionPreference.enabled = false（若用户选"永久关闭"）
```
- dismissed 是终态，未来不自动恢复
- "永久关闭"写入 `reflection-preference.json`，符合 ADR-0022 部署契约

---

## 4. 展示规则（Display Rules）

- 位置：首页 Continue 区域旁，**不是新页面、不是通知中心**
- 同一时刻最多 1 张（对应 `InvitationPolicy.maxActivePrompts = 1`）
- 不闪烁、不红点、不角标计数
- 安静呈现，用户可忽略而不产生系统压力
- 无动画强调、无"新"标记

---

## 5. 验证指标（极简，非增长指标）

**禁止测（太早）：** 点击率、DAU、留存率

**观察三个信号：**

### Signal 1：第一反应
用户看到卡片后第一句话：
- ❌ `为什么问这个？`（说明被提醒感，Projection 边界可能被误读）
- ✅ `这个问题刚好是我最近想的`（说明被理解，连续性投影成功）

### Signal 2：回答深度
主动邀请后的回答，是否比普通聊天更深入（长度 / 自我展开度）

### Signal 3：主动补充
用户是否主动补充：`其实还有一个原因……` / `之前没说的是……`
- 此信号比满意度更重要
- 它说明用户开始把 Mirror 当成自己的思考空间，而非问答工具

---

## 6. 非目标（Phase 2 边界）

明确不做：
- 通知中心
- 推送系统（Web/Mobile push）
- 主动聊天入口 / AI 人格化表达
- 卡片点击率优化
- 基于邀请响应的 ranking / 推荐

---

## 7. 与 Architecture Layer 的关系

```
Architecture (ACCEPTED, Runtime CLOSED)
   ↓ 定义能力 + 边界
Experience Contract (本文件, ACCEPTED)
   ↓ 定义展示 + 动作语义 + 验证信号
Frontend Implementation
   ↓ 严格消费 ReflectionPrompt，不反向扩展
```

若实现中发现需要 Runtime 新字段：回到 Architecture Layer 评审，不在此文件扩张。
