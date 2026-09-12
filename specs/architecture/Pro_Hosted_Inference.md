# Pro 托管推理（Hosted Inference）ADR



> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。
- 状态：Phase 2 · 已实现（客户端 + 可插拔端点）
- 范围：Questioner / Extractor 的推理可交由平台托管端点运行
- 决策依据：Article 4「服务端不读明文」的有意例外，需用户显式授权

## 1. 背景与目标

本地推理（OpenAI 兼容 / Anthropic / Mock）已就位。但部分用户希望：

- 不在本机跑大模型（省电、省显存、跨设备一致）；
- 用平台提供的更强推理能力（尤其 Questioner 的苏格拉底式追问需要推理模型）。

于是引入 **Pro 托管推理**：用户 opt-in 后，把指定角色的推理请求发给平台端点。

## 2. 与 Article 4 的边界

设计核心约束（Article 4）：**默认情况下，服务端绝不读取、存储、分析用户的明文内容。**

Pro 托管推理是这条约束的**唯一有意例外**，且必须满足：

1. **显式授权**：仅当 `INFERENCE_MODE=pro` 或 `PRO_EXTRACTOR` / `PRO_QUESTIONER` 被打开时才启用；默认关闭。
2. **知情同意**：用户已知晓「开启后，本次发送给平台的明文仅用于生成该次推理结果」。
3. **不持久化**：平台侧承诺不在请求生命周期之外保留任何明文（SLA / 合规约束，实现方负责）。
4. **最小外泄**：客户端请求日志（既有 `RequestLog`）只存 `inputHash`，**不存原文**（见 `HostedInferenceClient`）。
5. **等价产出**：平台返回内容须满足既有 `LLMClient` 契约（可解析 JSON），证据 / 审查 / 收件箱链路与本地模式完全一致——托管只换「算力在哪」，不换「产物形态」。

## 3. 接口契约（与平台端约定）

```
POST {PRO_INFERENCE_URL}
Authorization: Bearer {PRO_INFERENCE_KEY}
Content-Type: application/json

{ "system_prompt": "...", "user_message": "..." }

→ 200 { "content": "<模型输出文本>" }
```

客户端实现：`src/llm/HostedInferenceClient.ts`。它实现与本地客户端完全相同的 `LLMClient` 接口，因此 `createLLM()` 可在不改动任何上层服务的前提下切换算力来源。

## 4. 配置

| 变量 | 说明 |
|------|------|
| `INFERENCE_MODE=pro` | 两角色都用托管推理 |
| `PRO_EXTRACTOR=1` | 仅 Extractor 用托管推理 |
| `PRO_QUESTIONER=1` | 仅 Questioner 用托管推理 |
| `PRO_INFERENCE_URL` | 平台端点 |
| `PRO_INFERENCE_KEY` | 平台颁发的 API Key |

## 5. 风险与未决

- **传输安全**：必须 HTTPS；明文仅在内存短暂存在，落地即焚。
- **审计**：客户端保留每次请求的 `inputHash` + `parseSucceeded`，便于事后核对模型是否返回了可解析结构。
- **未决**：平台侧「临时解密沙箱」的合规实现细节（如何在不持久化前提下运行本地加密库的解密）——留待平台工程阶段，与加密 P2 / Sync 共用同一份主密码派生方案。
