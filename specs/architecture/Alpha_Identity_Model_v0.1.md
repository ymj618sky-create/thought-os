# Alpha Identity Model v0.1

> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: PROPOSED (Alpha 阶段身份模型定义 — 非决策冻结，供 P0 动作对齐)
**Date**: 2026-08-10
**领域**: 安全 / 数据主权 / 身份
**上游**: `adr/0026-secure-identity-recovery-multidevice-ownership.md`（四层边界，ACCEPTED）
**下游**: P0（Alpha data rescue / recovery）、未来 Web/Mobile 身份设计

---

## §1 本文档只回答一个问题

> **Mirror 的用户身份到底是什么？**

不定义同步协议、不定义设备注册流程、不定义云服务。只定义 Alpha 阶段"用户身份"的最小事实集合，使 P0 的主密码动作**不会固化一个未来需要迁移的 UX**。

---

## §2 核心定义

### 2.1 用户身份 ≠ 设备凭据

用户身份是**跨设备稳定存在**的抽象，不依附于任何单台设备的 OS Keychain / Secure Enclave / Passkey。

```
                User Identity (跨设备稳定)
                     |
        -----------------------------
        |                           |
 Recovery Root                Device Authorization
        |                           |
 password / recovery key      keychain / passkey / device key
        |                           |
 解开 owned data container     本机无感解锁加速器
```

- **Recovery Root**：用户持有的、独立于任何设备的恢复根。Alpha 阶段 = 主密码 + 一次性 recovery key（对应 `crypto.json` 的 `salt_pw` / `salt_rk` + `wrapped_dek_*`）。它解开的是 **owned data**（`.enc` 容器）。
- **Device Authorization**：某台设备被授权访问的凭证，是 Recovery Root 的**派生缓存**，不是身份根。设备凭据丢失/漂移，不得降低 Recovery Root 的解锁能力。

### 2.2 当前（`app.ts` + `keyStore.ts`）与定义的偏差

| 维度 | 定义要求 | 当前实现 | 偏差 |
|---|---|---|---|
| 解锁优先级 | Recovery Root 为主，Device 为加速 | `tryDeviceUnlock` 优先（`app.ts:182`），主密码环境变量兜底 | Device 优先于 Recovery Root，违背 §2.1 |
| 解锁失败语义 | 保留状态、给 recovery 入口 | `openContainer` 失败 → 归档 `.enc` + 建空容器（`app.ts:204-235`） | 静默降级为全新空库，降低可恢复性（ADR-0026 Decision 2 已禁止，待 ADR-0027 修） |
| DEK 来源一致性 | `.enc` 与 `crypto-meta` 必须同一把 DEK | `tryDeviceUnlock` 解出 DEK 直接 `unlockWithRawDek`；若该 DEK 解不开 `.enc` 则空库降级 | 二者无关联校验，单设备漂移即掉入空库陷阱 |

> 注：今晨事故的根因不是"unlock 覆盖了 wrapped-dek"（覆盖发生在首次 `initV2`，非本次），而是 **Keychain 返回了一把能解 `crypto-meta` 但解不开 `.enc` 的 DEK，系统静默以全新空容器启动**。这仍是 ADR-0026 Decision 2「解锁失败不得降低可恢复性」的违反实例——只是破坏路径在 `openContainer` 降级分支而非 `provisionDeviceUnlock`。ADR-0027 须覆盖此分支。

### 2.3 Alpha 阶段用户身份的最小事实

1. 一个 `crypto.json`（Recovery Root 的包裹材料，离线可迁移）。
2. 一把用户自存的 recovery key（一次性显示，不落盘）。
3. 一个主密码（用户设置，用于本机/跨设备解锁）。
4. 上述三者共同定义"这个数据属于谁"，**不依赖**任何设备的 Keychain。

---

## §3 与 P0（Alpha data rescue / recovery）的关系

P0 的"设主密码 + 导出 recovery key"**必须被明确定义为**：

> **Alpha data rescue / recovery** —— 第一版 Recovery Root 的激活，是临时止血与本地数据保全动作，**不是**最终身份方案。

具体约束：

- P0 不引入"账户""登录""用户档案"等终态身份 UX。
- P0 产出的 `crypto.json` + recovery key 在未来多端身份模型中**应被吸收为 Recovery Root 的既有材料**，而非作废重写。
- P0 的 UX 文案须明确告知用户："这是本地恢复根，未来可在多设备间携带；现在只是先保住本机数据。"
- P0 不得固化"必须主密码才能用"的强绑定（未来 Web 端可经 Session Key + Server relay，见 ADR-0026 Layer 3）。

---

## §4 不在本文档范围

- 账户系统、用户注册/登录流程
- 设备注册 / 吊销协议
- 事件同步协议（属 ADR-0011 / ADR-0026 Layer 4 / P4）
- 服务端 relay 细节

这些留待 Web/Mobile 真正启动前单独设计。

---

## §5 后续

1. 本模型被接受后，P0 按 §3 定义执行（Alpha data rescue / recovery）。
2. ADR-0027 按 ADR-0026 Decision 2 + 本文 §2.2 覆盖 `openContainer` 降级分支，冻结 Recovery Integrity Invariant。
3. Web/Mobile 启动前，基于本文 §2.1 扩展 Device Authorization 与 Sync 身份边界。

---

## §6 Step 4–5 Boundary Decision（冻结模型，不实现）

> 本节为 **Alpha Identity Boundary Decision**：只冻结所有权模型，不实现、不引入实现选择。对应 ADR-0026 的边界已 ACCEPTED，本节是其落地判定，非新 ADR。

### 6.1 根因重定性（非 crypto bug，是 Ownership Model 缺失）

今晨事故（旧库不可续用 → 新空库）暴露的不是 `Keychain` / `wrapped-dek` / `unlock` 的具体缺陷，而是：

> **Alpha 没有定义"谁拥有数据"，系统退化为 `Device owns data`。**

于是 `Device problem → data problem`。这与 COO 剃刀后的认知层原则同构：

| 层 | 错误模型 | 正确边界 |
|---|---|---|
| 认知层 | System chooses operation & owns conclusion | System governs operation, **User owns conclusion** |
| 数据层 | Device provides access & owns data | Device provides access, **User owns identity/data** |

两个原则是同一边界在两层上的投影。修补 `Keychain 漂移 / DEK 覆盖 / unlock 隐式初始化 / crypto meta 备份` 都是必要修复，但不是根因；根因是缺失 User Identity Root。

### 6.2 冻结的模型（必须存在）

```
User Identity Root
   ├── Recovery Authority        （恢复能力，跨设备稳定）
   └── Device Authorization Set  （日常访问，可增删/吊销）
```

- **User Identity Root**：用户拥有的、能证明对 Cognitive Data 所有权的根（抽象锚点，非 email/device/password/account 任一单项）。
- **Recovery Authority**：解开 owned data 的恢复能力（主密码 + recovery key 是候选形态，非必选）。
- **Device Authorization**：某设备被 Root 派生的访问授权（Keychain/passkey 仅作本机存储载体，不是身份源）。

### 6.3 暂不决定的实现选择（留待 Step 6）

以下属于**实现选择**，本节明确冻结"存在性"但开放"形态"：

- Recovery Root 是否以密码为 root
- 是否采用 passkey
- 是否引入账号 / 云端 identity provider
- 是否本地-only recovery phrase

> 纪律依据（与 COO 教训同构）：不要为解决一个边界问题，引入一个更大的中心机制。Recovery Root 是必要概念，实现形式未定前不落地。

### 6.4 三问判定（Alpha Identity Boundary Check）

**Q1 — 用户有 Desktop + Mobile，数据归谁？**
- ❌ 错误：`Desktop owns local DB` + `Mobile owns another DB` + `sync later`（设备拥有数据，sync 时继承错误边界）。
- ✅ 正确：`User owns cognitive events`；`Devices hold authorized projections`（设备只是授权投影）。

**Q2 — Laptop lost，系统应发生什么？**
- ❌ 错误：`data lost`（设备=身份，丢设备丢数据）。
- ✅ 正确：`device authorization revoked`；`user identity survives`（撤销授权，不撤销所有权）。

**Q3 — 未来加入 Web，Web 是什么？**
- ❌ 错误：`Web = another database client`（又一个数据客户端）。
- ✅ 正确：`Web = another authorized projection / execution surface`（又一个授权投影/执行面）。

若 Q1/Q2/Q3 均取正确方向，则 Recovery Root 的形态决策（Step 6）才有合法边界可依。

### 6.5 archive 触发路径的归类

今晨 archive 真实触发路径（哪段 `app.ts` 把旧库归档为新空库）的查证：
- **归类为 `Incident RCA`**（事故复盘输入），**不是** Identity Architecture 输入。
- 它回答"为什么 Alpha 今天失败"，不回答"为什么 Cognitive OS 未来不会失败"。
- 优先级低于 Identity Boundary；须在 Step 5/6/7 完成后，作为独立 RCA 处理，不阻塞架构演进。

### 6.6 演进顺序（采纳用户建议）

```
Step 4  Identity Boundary Review        ✅ 完成
Step 5  Alpha Identity Boundary Decision（本节，只冻结模型）✅
Step 6  决定 Recovery Root v0.1 形态        ⏳ 待 Step 5 接受后
Step 7  实现前 ADR（如解锁失败恢复完整性）   ⏳ 待 Step 6
最后    修 archive/unlock 具体代码（RCA）    ⏳ 最低优先级
```

> 收敛原则：不要因为一个 failure mode 出现，就马上创建一个 runtime 机制；先确认它属于哪个边界问题。Mirror 的关键问题已从"如何保护本地数据库"升级为"Cognitive OS 的数据所有权模型应该是什么"。

---

## §7 Step 6 Recovery Authority v0.1 Contract（冻结契约，不实现）

> 本节**不选择**任何 credential 形态（password / recovery phrase / passkey），只冻结 Recovery Authority 作为一个独立于 Device Authorization 的契约。credential 形态属 Step 7 实现选择，不在本节。

### 7.1 先问对问题

Step 6 不应问"Alpha 用什么作为 Recovery Root"，而应问：

> **Alpha 是否需要一个独立于 Device Authorization 的 Recovery Authority 表达？**

答案：**需要**。此判断即可冻结，无需先定形态。

### 7.2 冻结的契约

```
          User Identity Root
                 |
        Recovery Authority
                 |
        +--------+--------+
        |                 |
     Device A          Device B
   Authorization     Authorization
```

**Recovery Authority v0.1 定义**：存在一个 **User-controlled recovery secret**，其生命周期**独立于 Device Authorization**，可用于重新建立设备授权。

其唯一职责：

> 证明用户有权重新获得访问能力。

它**不负责**：登录、社交身份、账号体系、云同步、AI 权限、数据解释权（认知主权仍归 COO 边界）。

### 7.3 四条不可变契约

**① 独立性 Invariant**
```
Loss of device MUST NOT equal loss of identity.
```
Recovery Authority 独立于 Device Authorization；设备丢失 ≠ 身份丢失。

**② 非日常访问**
```
Recovery:    "I can regain ownership"
Device Auth: "This device may act for me"
```
Recovery Authority 不代表日常访问；二者职责分离。

**③ 非账号**
```
禁止：email = identity root
禁止：server account = ownership root
```
至少 Alpha 阶段不冻结账号/云端 identity 作为 Root。

**④ 多端同步前置**
同步前必须回答 `Who owns the events?`。若无独立 Recovery Authority（即 User-owned 锚点），则：
```
Device A DB + Device B DB = two competing truths
```
Recovery Authority 是未来 Event Sync（ADR-0011 / Layer 4）的前置条件，非同步的一部分。

### 7.4 为什么现在不绑定 credential 形态

| 候选 | 隐含风险（若现在冻结为 Root） |
|---|---|
| password | `User Identity = memorized secret` → 强度/迁移/多端输入体验问题 |
| recovery phrase | `User Identity = wallet-like bearer secret` → 钱包式 UX、丢失风险、普通用户理解成本 |
| passkey / biometric | 风险最大 → 易滑回 `Device = Identity`（刚刚纠正掉的问题） |

故 Step 6 只冻结"存在独立 Recovery Authority"，credential 形态推迟到 Step 7 由产品约束选择，避免把 Alpha 临时方案误升级为 Cognitive OS 身份模型。

### 7.5 与 COO 剃刀的同构收敛

| 维度 | 错误方向 | 留下 |
|---|---|---|
| COO | `COO = central cognitive scheduler` | `COO = governance contract` |
| Identity | `Identity = device credential` | `Identity = ownership boundary contract` |

两处收敛完全同构：**先建立不可被实现吞掉的边界合同，再引入运行机制**。当前最有价值的不是赶快做加密/账号/同步，而是继续建立这些边界契约。

### 7.6 更新后的演进链

```
Step 5  Identity Boundary              ✅
Step 6  Recovery Authority Contract    ✅（本节，不实现）
Step 7  Implementation Choice
        (password / phrase / passkey / hybrid)  ⏳ 产品约束驱动
Step 8  Multi-device Sync Model        ⏳ 依赖 Step 6/7
```

---

## §8 Step 7 Recovery Authority v0.1 Implementation Design（最小实施）

> 本节是**实施设计**，非抽象 Review。仅输出三样：① 最小数据模型 ② 解锁流程状态机 ③ 迁移策略。不引入账号/云/Sync。范围控制见 §8.4。

### 8.1 最小数据模型

新增身份根文件 `mirror.identity.json`（落 Data Root，与 `thoughtos.db` 同目录；**非**用户账号、非云同步、非登录）：

```jsonc
{
  "identity_version": 1,
  "recovery": {
    "kdf": "argon2id",          // 派生参数（与 CryptoProvider 一致）
    "salt_recovery": "<base64>",
    "wrapped_dek_recovery": "<base64, AES-GCM(DEK) under KEK_recovery>",
    "verify_dek": "<base64, AES-GCM(VERIFY) under DEK>"
  },
  "devices": []                 // 未来：authorized devices metadata；本版留空
}
```

职责：
- 表达 **User-controlled recovery secret → Data Encryption Root → Device Authorization** 的权属链；
- `recovery` 段独立于任何设备 Keychain；
- `devices` 段为未来 Device Authorization（Step 8）预留，本版不写。

不负责：用户账号、云同步、登录会话、AI 权限、数据解释权。

### 8.2 解锁流程状态机

冻结核心不变式（来自 §7.3）：`Device Authorization failure ≠ Identity failure`。

```
                ┌─────────────┐
                │  Startup    │
                └──────┬──────┘
                       │
            ┌──────────┴──────────┐
            │                     │
     Device Auth cache      No device cache
     (Keychain/passkey)     (or cache miss)
            │                     │
            ▼                     ▼
     Unlock via device      Recovery Root required
            │                     │
        Success?             (user recovery secret
            │  │ No             → derive KEK → DEK)
            │  │                  │
            │  └──┐               ▼
            │     │          Unlock via Recovery
            │     │             │
            │     │         Success?
            │     │         │  │ No
            │     │         │  └──► STOP + show recovery path
            │     │         │           (NEVER new empty state)
            │     │         ▼
            │     │      Open Data
            │     ▼         │
            │  Open Data ◄──┘
            ▼
        Application Ready
```

**最关键修复**（对应 §7.3②与用户要求）：
- 旧行为：`unlock fail → new empty state`（今晨事故同构）。
- 新行为：`unlock fail → STOP → request recovery`（绝不生成空库/新 DEK/覆盖既有 material）。
- 此状态机同时覆盖 `app.ts` 的 `openContainer` 降级分支与 `tryDeviceUnlock` 失败分支（属 P4 Incident RCA 的具体修法，但状态机本身在 Step 7 冻结）。

### 8.3 迁移策略（Alpha 无身份 → 有 Recovery Root）

当前事实（2026-08-10 探查）：生产 Alpha 为明文模式（`MIRROR_CONTAINER_ENCRYPTION=0`），`thoughtos.db.enc` 实为明文 SQLite，**无 `crypto.json`、无 Keychain 参与、三层身份均未建立**。故迁移不是"激活已有 root"，而是"从无身份态建立 Recovery Root"——这是一次性边界建立，非补丁。

步骤：
1. **首次建立**：在 Data Root 生成 `mirror.identity.json`（§8.1），由用户提供的 recovery secret 派生 KEK → 包裹既有数据 DEK（明文库则先建立 DEK 再 wrap）。
2. **保留明文兼容**：本版不强制开启 `MIRROR_CONTAINER_ENCRYPTION`；`mirror.identity.json` 先作为"所有权锚点"存在，加密为可选 Projection（避免重演 P0 错把"加密码"当 rescue）。
3. **Device Auth 作缓存**：Keychain 仅缓存由 Recovery Root 派生的设备解锁材料，移除 Keychain 后仍能经 Recovery Root 恢复（§7.3①）。
4. **零数据迁移风险**：不重建库、不覆盖 `.enc`、不触碰 335KB 归档旧库（字节完整，待 RCA 后独立判定）。

### 8.4 范围控制（硬性禁止）

Step 7 **只做**：
- §8.1 身份根文件格式；
- §8.2 解锁状态机（冻结"失败即停、请求恢复"）；
- §8.3 从无身份到 Recovery Root 的一次性迁移。

Step 7 **不做**：
- ❌ Sync / 云账号 / 服务端 / 冲突解决 / 实时同步（Sync 依赖 Step 6 刚冻结的 ownership，未到时机）；
- ❌ 选择 credential 终态形态（password/phrase/passkey 仍属 Step 7 实现时的产品约束，不在本设计定死）；
- ❌ 改 Thought/Reflection/Resolver 任何业务层；
- ❌ 引入新事实源或新实体（除 `mirror.identity.json` 这一身份锚点）。

### 8.5 实施优先级对齐

```
P0  Identity Boundary        ✅ (ADR-0026 ACCEPTED, Step 4/5/6 frozen)
P1  Recovery Root (Step 7)   ⏳ 本设计落地
P2  Device Authorization     ⏳ Step 8
P3  Sync Boundary            ⏳ Step 9 (depends on Step 6/7)
P4  Incident RCA (archive)   ⏬ 最低优先级，Identity 修好后价值下降
```

> 收敛原则（与 COO 同构）：边界已冻结，现在让它落地——先冻结边界 → 最小实现 → 真实运行暴露问题。不要再把 Identity 变成第二个 COO。
