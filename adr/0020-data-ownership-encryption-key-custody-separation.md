# ADR-0020: Data Ownership and Encryption Key Custody Separation

> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: ACCEPTED (Frozen 2026-08-03. Architecture decision complete; implementation deferred to future ADR.)
**Date**: 2026-08-03
**领域**: 安全 / 数据主权 / 密钥托管边界
**关联文档**: `adr/0010-encryption-at-rest-app-layer-aes-gcm.md`（应用层信封加密）、`adr/0019-multi-platform-architecture-and-runtime-boundary.md`（Data Root 所有权）、`adr/0016-tauri-as-desktop-runtime-host.md`（设备身份归属）、`adr/0017-node-runtime-sidecar-architecture.md`、`adr/0018-sync-as-premium-capability.md`、`src/crypto/CryptoProvider.ts`（实现）、`src/api/app.ts`（Container at-rest 开关）

## Context

Thought-OS 采用 Local-first 存储与应用层信封加密（ADR-0010）。数据机密性依赖**密码学密钥托管（cryptographic key custody）**，而非账户凭证。当前实现中：

- 整库经 at-rest Container 加密（默认开，`MIRROR_CONTAINER_ENCRYPTION`）；
- `keytar`（OS Keychain）只存**包裹后的密钥材料**，不存明文；
- 真正解密思想数据的是 Data Custody Key（容器密钥 / DEK），用户名仅作身份标识。

然而"用户名/密码"在直觉上极易被当作数据的恢复前提，尤其在 Cloud Sync、多设备、商业化订阅等需求出现时，工程与产品方可能默认退化成传统 SaaS 模型：

```
user/password -> server -> data
```

这会破坏 Local-first 与"思想属于用户"的根本立场——平台虽不持明文，却可能通过"控制账户即控制恢复"间接触碰数据主权。本 ADR 在同步/云化之前冻结边界，防止该退化。

本 ADR 是**架构纪律冻结**，不实现任何恢复流程，也不修改 Phase 2 的 Runtime 代码。

本决策在 Phase 2 验收中得到工程印证：Tauri Host 注入 `THOUGHT_OS_DATA_DIR` 控制 Data Root，而账户（`account` 表）落在 Data Root 下的库——即"账户 ≠ 数据根、数据由托管密钥控制"的分离已在运行时事实层面成立。ADR 从 PROPOSED 直接 ACCEPTED，理由是架构决策已完成，非因实现完成。

### 术语（命名纪律）

为避免与既有身份体系混淆，本 ADR 明确弃用 `Account Identity` / `Encryption Identity`：

- **Account Principal**：用户在同步、订阅、账户协调层面的主体（`user_id` / `email` / `subscription` / `device discovery`）。它**不拥有数据解密权**。
- **Data Custody Key**：对 Thought 数据拥有实际控制权的密钥材料（container decrypt / data recovery / device authorization）。重点不是"谁是谁的身份"，而是"谁持有什么钥匙、谁能控制数据"。

两者均正交于此前的 `deviceId` 设备身份归属（ADR-0016/0017/0018）——`deviceId` 解决"哪个设备"，本 ADR 解决"谁控制密钥"。

## Decision

1. **Thought 数据所有权 MUST 通过 Data Custody Key 的控制来落实（enforced by cryptographic custody），而非通过 Account Principal 凭证。** 数据所有权由密码学托管强制，不是"绑定到某个 key 对象"的简单归属——key 是控制机制，不是所有权的本体。

2. **Account Principal（`user_id` / `email` / `subscription` / `device discovery`）仅为账户、同步与服务协调目的存在。它 MUST NOT 成为数据可解密性的唯一前提。**

3. **未来多设备或云后端部署 MUST 提供用户自持的恢复机制（user-controlled recovery mechanism），该机制能恢复 Data Custody Key 的访问，且不要求平台持有明文密钥。**

4. **所有权模型：**

   ```
   Account Principal
          +
   Data Custody Key
          +
   Recovery Mechanism
          =
   Data Ownership Model
   ```

   账户系统可以证明"你是谁"，但不能天然获得"你的思想是什么"。

## Prohibited

- 将 `user/password -> data` 设计为唯一恢复路径。
- 平台托管的明文密钥保管（platform-controlled plaintext key custody）。
- 将同步身份（Account Principal）与数据可解密性（Data Custody Key）耦合。

## Out of Scope (Phase 2)

- 恢复短语（recovery phrase）生成。
- 恢复校验流程（recovery validation flow）。
- 云后端恢复服务（cloud-backed recovery service）。
- 多设备密钥分发实现（multi-device key distribution）。

## Trigger

当 Cloud Sync、多设备支持或商业订阅需要持久数据可移植性（persistent data portability）时，本 ADR 的恢复要求 MUST 转入实现规划，并通过一条专用 ADR 落地。届时第 3 条由"冻结原则"升级为"必须实现"。

## Relations

- **Extends ADR-0019**（Data Root 所有权）：ADR-0019 冻结"数据落在哪（Host 注入 Data Root）"，本 ADR 冻结"谁能解（密钥托管归属）"。
- **Orthogonal to `deviceId` 身份模型**（ADR-0016/0017/0018）：设备身份解决归属，密钥托管解决控制权，两者维度不同、互不替代。
- **Depends on ADR-0010**（应用层信封加密）：本 ADR 的 Data Custody Key 即 ADR-0010 信封加密中的 KEK/DEK 控制链末端。
