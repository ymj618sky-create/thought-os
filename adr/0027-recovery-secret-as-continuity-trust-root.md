# ADR-0027: Recovery Secret 作为跨设备数据连续性信任根

- **Status**: ACCEPTED (Implementation Contract — 实现契约，闭环已证明)
- **Date**: 2026-08-14
- **Supersedes / Extends**: Extends [ADR-0026](0026-secure-identity-recovery-multidevice-ownership.md) (边界冻结 → 本 ADR 是其实现契约)；Aligns [ADR-0010](0010-encryption-at-rest-app-layer-aes-gcm.md) / [ADR-0011](0011-sync-lamport-e2e-envelope.md) / [ADR-0020](0020-data-ownership-encryption-key-custody-separation.md)
- **Implementation**: `src/api/container.ts`、`src/identity/identityRoot.ts`、`src/api/routes/sync.ts`、`(Mirror reference product)`

---

## §0 背景与触发

ADR-0026 冻结了四层边界（Identity / Encryption Authority / Device Authorization / Sync），并明确：

> 实现走 ADR-0027。

今晨事故的**根因不是"加密坏了"**，而是**信任根没有被统一**：

- 容器 DEK 由主密码 + 设备 Keychain 解锁；
- Identity Root 的 Recovery Authority 是另一套密钥；
- Sync 口令（`MIRROR_SYNC_PASSPHRASE`，默认 `dev-insecure-sync-passphrase`）是第三个独立秘密。

三者互不认，导致：

1. **忘主密码 = 数据锁死**（Recovery Authority 能恢复身份，但解不开容器 DEK）；
2. **导出被 `if(!crypto) return 409` 卡**，必须已 unlock，忘了密码就导不出 → 换机死；
3. **多端同步要记第二个口令**，与身份脱节。

ADR-0026 的 P3 把修复范围定为"仅修 unlock-failure 覆盖缺陷"。本 ADR 在此之上**完成并扩展了实现契约**：把 Recovery Secret 确立为**唯一跨设备数据连续性信任根**——它**建立（establish）recovery authority**，其余三路信任关系（Identity Root / Container DEK recovery path / Sync authority）**从这一信任关系派生或被其授权**，但各自保持独立职责、可用不同密码学原语实现。

---

## §1 决策（Decision）

### Decision 1 — Recovery Secret 是跨设备数据连续性的唯一信任根

用户**只需持有并离线保存一个 Recovery Secret**。它是：

- Identity Root 的建立种子；
- 容器 DEK 的 recovery 包裹密钥（wrapped-dek-rk）；
- 多端同步信任的授权锚（当未显式提供独立 `MIRROR_SYNC_PASSPHRASE` 时，同一信任根下的设备被授权收敛到同一同步域）。

其余一切（主密码、设备 Keychain、Sync 口令）都是**便利性加速器或可选覆盖**，不得成为数据访问的**唯一**路径。

### Decision 2 — 三路派生，职责分离（冻结架构图）

```
Recovery Secret
      │
      ├── 首次 Identity Root
      │
      ├── Container DEK recovery path
      │
      └── Sync authority
             │
       ┌─────┴─────┐
       ↓           ↓
   Device A     Device B
   Keychain     Keychain
       │           │
       └─────┬─────┘
             ↓
        Local Container
             │
             ↓
         Sync Engine
```

- **Recovery Secret**：灾难恢复 / 新设备恢复凭证。**不是日常登录密码**。
- **Identity Root**：由 Recovery Secret 建立，承载 Recovery Authority（recovery material 不落盘原始 secret）。
- **Container DEK recovery path**：容器 `wrapped-dek-rk` 由 Recovery Secret 包裹；忘主密码时用 `unlockWithRecovery` 解开，数据连续性不因遗忘锁死。
- **Sync authority**：同一 Identity Root 下的设备，默认从本机已解开的容器密钥派生同一 sync key（或显式 `MIRROR_SYNC_PASSPHRASE` 覆盖），Lamport 增量合并（见 ADR-0011）。
- **Device Keychain**：每设备本地的**无感解锁加速器**，由 Root 授权建立、可单独吊销；**不是身份根，也不是同步根**。

### Decision 3 — 首次初始化强制交出 Recovery Secret

首次运行 `IdentityRootStore.establish()` 生成 Recovery Secret，**必须打印/可下载交用户离线保存**。拒绝"静默生成不交付"——这是 ADR-0026 之前的实际缺陷（recovery key 默认生成却不交到用户手里，等于不存在）。

### Decision 4 — 解锁失败不覆盖，回退 Recovery

`unlock(masterPassword)` 失败时，**不 `process.exit` 自毁**，而是回退 `unlockWithRecovery(BOOT_RECOVERY_SECRET)`（运行期来源：首次 establish 暂存 / `MIRROR_RECOVERY_SECRET` 注入）。这与 ADR-0026 Decision 2（解锁失败禁止覆盖加密材料）一致，并补上了"回退路径"。

---

## §2 已闭环（本 ADR 实现范围内已证明）

端到端验证脚本 `(Mirror reference product)` 在**临时目录**跑通完整闭环（不触碰用户真实数据）：

| 用户需求 | 验证结果 |
|---|---|
| 数据连续性（忘主密码不锁死） | ✅ Recovery Secret 解开容器 |
| 换电脑延续（.enc + identity 迁移） | ✅ 新机用 Recovery Secret 恢复 |
| Pro 多端同步（同一信任根派生） | ✅ 双向 Lamport 收敛一致 |

装配层改动（仅接线，未重写加密原语，未触碰三不变量 Data/Process/Lifecycle ownership）：

- `container.ts`：首次 establish + 打印 Recovery Secret；首次建库用 Recovery Secret 包裹容器 DEK；主密码失败回退 recovery；Sync 密钥默认从容器密钥派生。
- `identityRoot.ts`：`load()` 返回既有 Root（原始 secret 不落盘，符合 ADR-0026）。
- `routes/sync.ts`：`/api/unlock` 支持 `{ recovery }` 分支（后端能力已具备）。

---

## §3 明确不属于本次闭环（冻结事实，不误写为架构缺失）

以下三项**已识别、已规划、但明确不属于 ADR-0027 范围**，未来各自走独立变更：

1. **Recovery UI**：`/api/unlock` 后端已支持 recovery 分支，但前端解锁界面尚未接入"使用恢复密钥"输入项。属产品入口接通，非架构缺失。
2. **真实 Cloud Sync**：`HttpTransport` 骨架已在，但 `MIRROR_SYNC_URL` 服务端尚未实现。本地 `LocalFileTransport` 已能跑双库演练收敛，证明引擎逻辑通。属部署服务端，非架构缺失。
3. **Backup UX**：导出/导入产品界面（`.mirrorbackup` 加密包）可后续完善。属产品打磨，非架构缺失。

---

## §4 边界与禁止方向（继承自 ADR-0026，本 ADR 重申）

- **禁止**把 Recovery Secret 当日常登录密码使用（恢复成功后续用主密码/Keychain 无感解锁，不每次输入 recovery）。
- **禁止**解锁失败时覆盖/重建加密材料（ADR-0026 Decision 2 硬约束）。
- **禁止**引入第二套身份体系、云账号 Principal、或平台持明文密钥（ADR-0020 Prohibited）。
- **禁止**数据库文件级复制/合并（ADR-0011 备选 A 否决；Sync 只传输 owned 事件）。

---

## §5 Consequences

### 正向

- **统一信任根**：用户从"记多个独立秘密"降为"持一个 Recovery Secret"，其余自动。
- **数据连续性成立**：忘主密码、换设备均不锁死数据。
- **Pro 多端同步无感**：同一信任根下的设备自动收敛，用户无需第二个口令。
- **闭环已证明**：端到端验证脚本固化，后续改动可回归。

### 负向 / 风险

- **Recovery Secret 丢失 = 数据不可恢复**：这是用户责任，产品 MUST 明确告知"无备份即无救援"。
- **前端入口未接**：当前用户仍只能用主密码解锁，recovery 能力在后端就绪但未暴露（见 §3.1）。
- **真实跨设备仍需 Sync 服务端**：属 §3.2，不在本 ADR 范围。

### 后续行动（按钉死顺序）

1. **（已做）** ADR-0027 接受，闭环固化。
2. **（已做）** 独立 commit：`mirror: establish Recovery-rooted data continuity`（非 hotfix 命名）。
3. **（下一步）** 接前端 Recovery 解锁入口（`/api/unlock` 的 `{ recovery }` 路径接通 UI）。
4. **（再下一步）** E2E 验证 UI 流程。
5. **（最后）** 真实 Cloud Sync 服务端（MIRROR_SYNC_URL）。
