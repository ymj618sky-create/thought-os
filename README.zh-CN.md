# Thought OS — 开放规范与参考内核

> [中文](README.zh-CN.md) · [English](README.md)

**Thought OS 存在的意义是增强人的思考，而非取代它。**

Thought OS 是一个个人认知操作系统。它不是知识库，不是聊天机器人，不是搜索引擎，也不是心理咨询。它是一种基础设施，帮助一个人去发现、整理、连接、检验并演化自己的思考——并且是持续地、随时间地。

本仓库发布的是**开放规范（Open Specification）**与一个**参考内核（reference kernel，即 Thought OS kernel）**，不包含专有的 Mirror 产品。

## 为什么需要 Thought OS

每个人都有能力形成自己的思想体系。AI 的角色不是提供答案，而是帮助一个人去观察、建构、审视并演化自己的思考。Thought OS 的一切都建立在一道坚硬的边界之上——即*能力（capability）*与*权威（authority）*之间的边界：

> **能力是开放的。认知不等于所有权。**
> **刻画不等于身份。建议不等于决定。**
> **思想属于人。**

AI 可以观察、解释、建模、判断、批评、预测、建议。它不能拥有、定义或替用户做决定。整个系统——提示词、智能体、API、模式、界面与商业模式——都以这道边界为衡量标准。

## Thought OS 建模了什么

Thought OS 不存储"笔记"。它把思考建模为彼此分明、可追溯的对象，并带有明确的关系：

| 概念 | 是什么 |
| --- | --- |
| **Evidence（证据）** | 用户的原始表达。不可变；哈希校验；永不覆盖。 |
| **Observation（观察）** | 对证据的客观描述（可核验为真或假）。 |
| **Interpretation（解释）** | 关于用户的推断；必须带有 0–1 的置信度 + 依据。 |
| **Thought（思想）** | 用户确认为自己所有的思想。需要 ≥ 1 条证据。 |
| **Question（问题）** | 一等公民级别的问题；可以没有答案而存在。 |
| **Relation（关系）** | 对象之间的带类型链接（supports / contradicts / refines / …），拥有自己的生命周期。 |

两条最重要的不变量：**Evidence 不可变**，以及**相互矛盾的思想可以共存**——系统绝不悄悄把一个张力合并掉。

## 它如何保持诚实

权威链是严格且单向的：

```
Constitution → Specification → Concept/Schema → Protocol → ADR → Prompt → Implementation
```

如果提示词与规范冲突，那是提示词的 bug。如果代码与规范冲突，那是代码的 bug。`specs/conformance/` 这套用例把核心不变量编码为可执行测试（candidate ≠ thought、proposal ≠ mutation、human authority、provenance、thought ownership）。
**C-005 / C-006 / C-007 是故意标红的**——它们标记的是"思想所有权在存储层如何被强制"这一真实且刻意保留的缺口，而不是通过的行为。

## 本仓库包含什么（开放）

| 路径 | 内容 | 许可 |
| --- | --- | --- |
| `constitution/` | 宪法与使命（最高权威层） | CC BY 4.0 |
| `specs/` | 概念、模式、协议、架构、评测 | CC BY 4.0 |
| `adr/` | 已发布的架构决策记录（精选） | CC BY 4.0 |
| `kernel/` | 参考实现（Thought OS kernel） | MIT |

上面的 conformance 用例位于 `specs/conformance/`；公开发布树中没有顶层的 `tests/` 目录（与 Mirror 耦合的测试被发布闸排除）。

## 本仓库不包含什么（专有）

Mirror 产品（`mirror/`）、智能体提示词（`agents/`）、参考产品（`reference/`）、移动/桌面应用（`apps/`）、网站（`site/`），以及任何 SaaS / 计费层，均为私有，不在本仓库之内。

## 从哪里开始

1. `constitution/Constitution.md` 与 `Mission.md` —— Thought OS 相信什么。
2. `specs/specifications/v0.1.md` —— 行为规则（可测试的 `S-x.x`）。
3. `specs/concepts/` —— 上表背后的数据模型。
4. `adr/` —— 架构决策，以及它们为何如此。
5. `kernel/` —— 参考实现。

## 许可

- 文档与规范 → **知识共享署名 4.0（CC BY 4.0）** —— 见 `LICENSE-DOCS`。你可以阅读、实现、引用并扩展它们，构建你自己兼容或衍生 Thought OS 的系统，但须为 Thought OS 署名，且不得暗示背书。
- 软件代码 → **MIT 许可** —— 见 `LICENSE-CODE`。

开放规范，而非开源工程：价值在于可复用的规范资产，而不在于 fork 这个产品。

Copyright © 2026 Mingjie Ye.
