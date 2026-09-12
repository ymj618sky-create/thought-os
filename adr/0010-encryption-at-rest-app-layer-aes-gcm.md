# ADR-0010: At-Rest 加密采用应用层信封加密（AES-256-GCM），不依赖 SQLCipher



> **Copyright © 2026 Mingjie Ye (叶明杰). Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。

**Status**: Accepted
**Date**: 2026-07-30
**领域**: 安全 / 存储层
**关联文档**: `(private policy)`（要求）、`src/crypto/CryptoProvider.ts`（实现）、`src/crypto/codec.ts`（DataCodec 接口）、`src/storage/SqliteStorage.ts`（消费方）、Constitution Article 4（数据主权）

## Context

`(private policy)` 自项目之初就要求 SQLite 数据库整体经 SQLCipher（AES-256）加密。该政策的底线是"平台运营方在任何时刻都无法读取用户内容明文"。

但 Phase 1 存储层选用的是 Node 24 内置的 `node:sqlite`（`DatabaseSync`），原因如 `SqliteStorage.ts` 头注释所述：`better-sqlite3` 在本机 Node 24.18.0 上无预编译二进制、且无 C++ 工具链导致 `node-gyp` 编译失败。`node:sqlite` 是同步模型、零依赖、零编译，语义与 `better-sqlite3` 最接近。

问题在于：`node:sqlite` 不支持 SQLCipher 扩展——SQLCipher 要求编译期链接 OpenSSL 并替换 SQLite 的 VFS 层，而 `node:sqlite` 链接的是 Node 内置的 SQLite 副本，无扩展加载 API。这意味着**"SQLite 整体加密"这条路在 `node:sqlite` 上不通**。

另一个独立维度：`Encryption_Policy.md` 要求用户主密码经 Argon2id 派生密钥、密钥永不发送到服务器、换设备时通过恢复密钥解出数据。这些"密钥管理"需求独立于"加密发生在哪一层"——即使用了 SQLCipher，派生、包裹、恢复、轮换仍需自己实现。

因此需要决定：当存储层（`node:sqlite`）不提供原生加密时，加密应该做在哪一层，密钥管理如何设计。

## Decision

### 加密做在应用层，不换存储引擎

**不换 `node:sqlite`**。在 `SqliteStorage` 的"落盘前 / 读出后"插入一刀 `DataCodec` 接口：

```typescript
interface DataCodec {
  encode(plain: string): string;  // 明文 JSON → 落盘串
  decode(cipher: string): string;  // 落盘串 → 明文 JSON
}
```

- 默认：`IdentityCodec`（透传，Phase 1 明文模式，零开销）
- 加密模式：`CryptoProvider` 实现 `DataCodec`，对每条记录的完整 JSON 做 AES-256-GCM 加密后写入 `data` 列
- `id` / `user_id` / `status` 等索引列保持明文（设计明确允许——这些是路由元数据，不含思想内容；Encryption_Policy.md 的"同步路由所需的元数据服务器可见"与之一致）

**选择应用层加密而非存储层加密（SQLCipher）的理由**：

1. **`node:sqlite` 不支持 SQLCipher**——换 `better-sqlite3` 需回退到有编译依赖的技术栈，这在跨平台（Windows/macOS/Linux/ARM）分发时会成为持续痛点
2. **应用层加密与存储引擎解耦**——未来若 `node:sqlite` 某版本支持扩展加载，或换用其他存储（如 IndexedDB / OPFS for Tauri），`DataCodec` 保持不变，只需替换 `SqliteStorage` 的 `put/get` 中的 `encode/decode` 调用
3. **加密粒度与业务语义一致**——整条记录（Observation/Interpretation/Thought 等）是一个"思想原子"，应用层加密意味着这条原子的所有字段（content、confidence_rationale、evidence_quotes 等）整体进入密文，无需逐字段判断"哪个字段该加密"

### 密钥管理：信封加密（Envelope Encryption）

```
DEK（数据加密密钥，32 字节随机）──直接加密每条记录（AES-256-GCM）
  ├── 被 KEK_pw 包裹（wrap）  → 存 sidecar（crypto.json）
  └── 被 KEK_rk 包裹（可选）   → 存 sidecar

KEK_pw = Argon2id(主密码, salt_pw)
KEK_rk = Argon2id(恢复密钥, salt_rk)

verify_dek = AES-GCM("mirror-dek-ok") under DEK  → 解锁后校验 DEK 正确性
```

**选择信封加密而非"主密码直接派生数据密钥"的理由**：

| 方案 | 换密码 | 恢复密钥 | 数据重加密 |
|---|---|---|---|
| 密码→派生密钥→直接加解密 | 需重加密全部历史数据 | 无法实现独立恢复路径 | 每次 |
| **信封加密（采用）** | 仅重新包裹 DEK | DEK 被恢复密钥独立包裹 | 零 |

信封加密的"rotate 只需重包裹 DEK"是刚需——用户可能改主密码、添加或移除恢复密钥，这些操作不应触发全库重加密（Phase 1 数据量小尚可接受，但设计不应依赖"数据少"的假设）。

### 恢复密钥（Recovery Key）

- 32 字节随机（base64url），`mirror init` 时生成并**仅显示一次给用户**，不落盘
- 与主密码互不依赖：任一即可解出 DEK
- `mirror keys rotate` 可更换恢复密钥（重新包裹 DEK）
- 空串 `''` 可移除恢复密钥（删除 `wrapped_dek_rk` + `salt_rk`）

**恢复密钥不被主密码替代表述为"主密钥"的理由**：主密码是用户记忆的秘密（可能弱、可能被多个服务复用）；恢复密钥是机器生成的强随机（32 字节 ≈ 256 位熵）。二者在密码学上是平等的——都能解出 DEK——但恢复密钥提供了一条不依赖用户记忆的备份路径。这是端到端加密产品（Signal、1Password、Bitwarden）的标准实践。

### Argon2id 参数

```
parallelism: 1      // Node 单线程，高并行度无收益
iterations: 16      // 在解锁耗时 ~1-2s 与暴力破解抵抗间取平衡
memorySize: 64 MiB  // 普通设备可承受；可按设备调高
hashLength: 32      // 256 位 AES 密钥
```

参数硬编码在 `CryptoProvider` 常量中，**不留用户可调空间**——因为参数改变会导致相同密码派生出不同密钥，而用户不理解这种 trade-off。这是 1Password 的做法（固定参数、版本化）、而非 KeePass 的做法（暴露迭代次数给用户）。

### Meta 版本化（v1 → v2）

- **v1**（遗留，Phase 1 早期）：密码→派生密钥→直接用于 AES-GCM。无 DEK 层，无恢复密钥
- **v2**（当前）：信封加密模型，`salt_pw` + `wrapped_dek_pw` + `verify_dek`，可选 `salt_rk` + `wrapped_dek_rk`

`unlock()` 自动检测 meta version 并走对应路径。v1 仅用于兼容旧库（如果存在），新 `init` 只产 v2。未来若升级 KDF 参数或算法，走 v3 并保持旧 version 的兼容路径。

## 备选方案（被否决的）

### A. 换 `better-sqlite3` + SQLCipher

**否决理由**：
- Windows 上需 Visual Studio Build Tools + Python + node-gyp，跨平台分发时这是持续的安装故障源
- Tauri bundle 需额外处理原生模块的交叉编译（Windows → macOS 交叉编译 `better-sqlite3` 几乎不可行）
- 密钥管理（派生、包裹、恢复）仍需自己实现，SQLCipher 只解决"数据怎么落盘"这一层
- 应用层加密通过 `DataCodec` 已实现同等级别的机密性，且与存储引擎解耦

### B. Web Crypto API（SubtleCrypto）

**否决理由**：
- `SqliteStorage` 的 `put/get` 是同步调用（`node:sqlite` 的 `DatabaseSync` 要求同步 I/O）
- Web Crypto API 全部是异步 Promise 接口
- 将 `put/get` 改为异步会连锁影响所有 Service → CLI/API 层的调用链——代价远超收益

### C. 不对每条记录加密，只加密"敏感列"

**否决理由**：
- 违反 JSON Schema 原则——Schema 是全量校验，部分密文部分明文会让 `ajv` 校验在密文上失效
- 逐列判断"哪个字段算敏感"是脆弱的手工枚举——新增一个字段（如 `confidence_rationale`）若忘记加入加密列表就是泄露
- 整条记录加密保证"Schema 校验完成 → 序列化 → 加密 → 落盘"是一条原子路径，不存在"校验了部分字段但另一些字段已在密文中"的中间状态

### D. 硬编码主密钥（无用户密码）

**否决理由**：直接违反 Encryption_Policy.md 第 3 节（"主密码与任何派生密钥永远不发送到服务器"）和 Article 4（"思想永远属于用户"）。若密钥由代码/配置文件提供，任何能读取该文件的进程都能解密数据库——这与明文无异。

## Consequences

### 正向

- **与 `node:sqlite` 兼容**：零编译依赖，纯 JS + WASM (`hash-wasm`) + Node 内置 `crypto` 模块
- **对上层完全透明**：6 个 Service、7 个 CLI 命令、全部 API 路由——无需任何修改；`SqliteStorage` 是唯一感知 `DataCodec` 的模块
- **密钥轮换成本恒定**：O(1)——只重写 ~200 字节的 `crypto.json`；数据库不管多大都不需重加密
- **恢复密钥提供独立备份路径**：不会因为忘主密码而丢数据；符合 Encryption_Policy.md "诚实权衡"（"主密码丢失 = 不可恢复"的代价可被恢复密钥缓解）
- **Meta 是自包含的备份单元**：一个 JSON 文件包含恢复数据库所需的一切（盐 + 包裹后的 DEK + 校验串）；配合主密码或恢复密钥即可解锁

### 负向 / 风险

- **未经过第三方安全审计**：本方案是自研实现（Node `crypto` + `hash-wasm` + 自定义 meta 格式），未经密码学专家审查。在审计完成前，**不得声称数据库"已加密"**——应明确告知用户当前为"应用层加密，未审计，Phase 2 开发过程中可能发现缺陷"
- **索引列明文泄露元数据**：`id`（UUID，无信息量）、`user_id`（Phase 1 固定 `default`）、`status`（`pending`/`confirmed` 等状态名）是明文。攻击者虽读不到思想内容，但可以：统计记录数、按状态分组、追踪实体创建频率——这些元数据本身也是一种信息泄露。缓解：Phase 2 可将 `status` 也编入加密的 `data` 列（代价是查询 `WHERE status = ?` 无法走索引）
- **`hash-wasm` 供应链风险**：`hash-wasm` 是唯一非内置依赖，提供 Argon2id 的 WASM 实现。若该包被篡改或放弃维护，需换用 Node 内置的 `crypto.scrypt`（语义不同但等级接近）或自行编译 Argon2 WASM
- **记录级加密 + 全表扫描**：当前 `query()` 先 `SELECT data FROM t` 全表、再逐行 `decode` 后过滤——数据量大时需改为"先按明文索引列过滤再解码"或引入加密索引（盲索引）。Phase 1 几十条记录不成问题
- **v1 兼容路径未测试**：`CryptoProvider.unlock()` 的 v1 分支用于兼容旧 meta 格式，但当前没有 v1 格式的实际库可测，也未写 v1 兼容测试。应在添加真实加密数据前至少补一条"v1 meta → v2 迁移 → 数据仍可读"的测试
- **加密开关是环境变量，非持久化状态**：当前靠 `MIRROR_ENCRYPTION=1` 判断是否启用加密。若用户首次以 `ENCRYPTION=1` 运行后下次忘记设这个变量，服务将以 `IdentityCodec` 启动——此时 `put()` 写入明文 `data` 列，而 `get()` 会尝试解码明文（`IdentityCodec.decode` 是透传，不会报错），数据库静默变成明文/密文混合。**应在 `mirror init` 后持久化"此库已加密"的标记**（如写入 `__sync_meta` 或 `mirror.state.json`），启动时检测到已加密标记但无 codec → 拒绝启动
- **非对称多设备场景未定义**：当前设计假设"一个 DEK 加密全部数据"。若两台设备各自 `init` 产生不同 DEK，Sync 合并时会互相收到对方 DEK 加密的密文——当前的 `applyRemoteOp` 不做解密，无法处理。这在多设备同步场景下需要升级为"每设备有自己的 DEK，或引入共享群组密钥"

### 后续行动

1. **安全审计**（Phase 2 中期）：邀请至少一位有密码学背景的审阅者审查 `CryptoProvider.ts` 的 AES-GCM 使用、IV 管理、Argon2id 参数、verify 机制
2. **持久化加密标记**（Phase 2 早期）：在 `mirror.state.json` 中写入 `encryption_enabled: true`，启动时检测标记与 codec 是否一致
3. **v1 兼容测试**（可立即做）：构造一个 v1 meta + 加密记录，验证 `unlock` → `decode` 往返
4. **Sync + 加密集成测试**（Phase 2 中期）：两台设备不同 DEK 时 Sync 应报错而非静默写入不可解密数据
5. **Argon2id 参数可配置**（Phase 3）：对高安全需求用户允许 `MIRROR_ARGON_MEMORY=256` 提高内存成本；参数本身存入 meta version 字段以支持自动迁移
