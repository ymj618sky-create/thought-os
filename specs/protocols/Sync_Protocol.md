# Protocol: Sync

**所属层**: `specs/protocols/`
**状态**: 仅定义协议（Phase 1 不实现）；实现留待后续 Phase
**范围**: 同一用户的**多设备之间**如何同步其 Thought OS 数据，保证数据主权（Article 4）与端到端保密。**不涵盖**多用户之间的共享/协作——那是 `adr/0007-sharing-boundary-phase1-none.md` 的边界，Phase 1 不做。

---


> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

## Article 0 检验

删掉 Sync 会失去什么？——用户的思想数据被困在单一设备上，"思想永远属于用户"（Article 4）退化为名义主权：换设备即丢数据，或被迫把明文交给平台托管。Sync **不是新增"思想现象"**，而是让 Article 4 的主权在多设备场景下成立的工程地板。因此它属于工程协议层，不进入 Kernel 概念。

## 范围与前提

- 同步对象：6 类实体的全部记录（Evidence / Observation / Interpretation / Thought / Question / Relation）+ 删除标记（tombstone）。
- 单用户、多设备；不涉及把数据交给他人。
- 服务器只承担"密文中转与暂存"，永远看不到明文（见 `(private policy)`）。

## 三个核心决策

### 1. 冲突合并策略：追加式演化直接合并 + 就地状态字段 LWW（混合，推荐）

理由：本模型的演化语义天然接近"只增不改"——

- **Evidence** 写入后不可变，**不存在冲突**；
- **Thought / Relation** 的"演化"是通过**新建**版本 / 新关系（supersede 链）完成的，属**追加操作**，天然符合 grow-only CRDT，直接合并即可；
- 真正"就地修改"的只有少数 `status` 流转（如 `pending→confirmed`、`active→archived`），且几乎都由用户单点触发，并发改同一字段极罕见。

因此：

- **追加类事件**：直接合并，无需解决冲突；
- **就地状态字段**：采用 last-write-wins，确定性收尾——先比 `version`（高者胜）→ 再比 `confirmed_at`/`updated_at`（后者胜）→ 仍并列则比设备 id 字典序（保证各端收敛到同一结果）。

> 诚实标注：为思想图谱引入完整操作交换 CRDT 在 Phase 1 属过度设计，且 supersede 链已接近 grow-only 结构。**该合并策略为推荐方案，最终实现前需再确认一次**（遵循 Article 0 精神，不把"推荐"伪装成"已定"）。

### 2. 端到端加密模型

- 密钥由用户持有、永不离设备；服务器只见密文与最小路由元数据（见 `(private policy)`）。
- 同步 payload 在发送设备加密、接收设备解密；服务器只能"存 / 转"，读不到内容。
- 推论：服务器**不能**替用户做内容级冲突合并——合并逻辑必须发生在持有密钥的客户端。

### 3. 最小同步单元：增量操作日志，非全量快照

- 每次本地变更产生一条同步操作：
  `{seq, entity_type, entity_id, op(create|update|tombstone), payload(encrypted), client_ts}`，`seq` 为单用户单调递增。
- 同步 = 双向交换"自上次已见 seq 之后的增量操作"，不传输全量数据。
- 仅首次接入新设备时做一次全量加密快照导入，之后一律增量。

## 明确排除

- 不做多用户共享/协作（见 ADR-0007）。
- 不在服务器端做内容处理：Extractor / 冲突检测只能运行在持有密钥的客户端侧；若未来要"云端跑 Extractor"，须以"用户授权的临时解密沙箱"另行设计，本期不定义。
- 不承诺实时协作编辑（Thought OS 不是协作文档）。
- 不绑定具体同步后端/协议实现（Article 28 模型无关、Article 26 规范高于实现）。

---

*本文档遵循 Article 4（思想属于用户）、Article 26/28（规范高于实现、模型无关）。任何让服务器获得明文或替用户做内容合并的实现，视为违反本协议的 bug。*
