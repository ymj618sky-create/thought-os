# Backup / Export / Import UX Contract v0.1

> **性质**:Track A 用户语义与数据所有权边界契约(非实现、非 ADR)
> **阶段**:Stage 1 Architecture Checkpoint(`7d9d1ab`)之后,下一阶段唯一推进项
> **定位**:冻结"用户闭环语义",而非实现。本 Contract 先于代码与 ADR。
> **纪律**:本 Contract 不要求改 SyncEngine / CryptoProvider;不新增 ADR;不写实现。
> **前驱边界**:
> - ADR-0026 — unlock failure MUST NOT destroy existing encrypted material(数据主权原则)
> - ADR-0027 — Recovery Secret 是 Recovery Authority,非网络凭证
> - `Cloud_Sync_Server_Contract_v0.1.md` — Cloud 非认知事实源;Lamport = client conflict ordering
> **现状注记**:`src/api/routes/backup.ts` 已有导出/导入骨架实现(整库加密为 `.mirrorbackup`)。
>   本 Contract 不描述该代码,而是把用户语义钉死,**回头作为该实现的约束基线**(实现不得违反本 Contract)。

---

## §0 核心产品原则(Contract 总纲)

> **Export belongs to the user. Import restores ownership, not merely files.**

Track A 不是"数据库备份工具"。它完成的是从"技术 Data Continuity"到"用户拥有的 Data Continuity"的跨越:

```
技术 Data Continuity
        ↓
Backup(用户可拥有 / 可携带)
        ↓
用户可理解
        ↓
用户可操作
        ↓
用户可验证
        ↓
用户真正拥有 Data Continuity
```

---

## §1 用户闭环(冻结路径)

```
                    当前设备
                       │
                 ┌─────▼─────┐
                 │   Mirror  │  (已 unlock session)
                 └─────┬─────┘
                       │
                  Export Backup
                       │
                       ▼
                .mirrorbackup
                       │
             用户自己保存 / 搬运(任意介质)
                       │
          ┌────────────┴────────────┐
          │                         │
       原设备                    新设备
          │                         │
          │                    Import Backup(显式动作)
          │                         │
          │                         ▼
          │                  Recovery Secret(恢复权)
          │                         │
          │                         ▼
          │                   Identity Recovery
          │                         │
          │                         ▼
          └──────────────→ 数据恢复(已验证)
```

---

## §2 七件必须冻结的事

### §2.1 Backup 是什么
`.mirrorbackup` 是**用户拥有、可携带、可独立恢复的数据包**,不是数据库文件的简单复制。
- 它是一个自包含包:metadata + 加密数据库 + integrity,可脱离原设备独立恢复。
- "独立恢复"含义:仅凭该包 + Recovery Secret 即可在新设备重建 Identity + Data,不依赖 Cloud、不依赖原设备在线。
- 包内数据为密文;Backup 的保护材料必须允许持有 Recovery Authority 的用户在新设备独立完成恢复,不依赖原设备的运行时密钥状态。

### §2.2 Export 不要求重新输入主密码
只要当前 Mirror 处于 **unlocked session**,用户可直接 Export。
- **禁止**:`"我已解锁,但导出我的数据还要再次证明我知道密码。"`
- 原理:unlock 已确立当前会话的数据主权;Export 是该主权的自然延伸,不应二次质询。
- 例外边界:若会话本身未解锁(进程刚启动未认证),应先走正常 unlock,而非在 Export 流程内嵌主密码二次收集。

### §2.3 Recovery Secret 是恢复权,不是网络凭证(继承 ADR-0027)
```
Recovery Secret
   ├── 可以 → 恢复 Identity / 数据
   ├── 可以 → 授权新设备
   └── 不可以 → Cloud HTTP Authorization
```
- Backup Import 中的 Recovery Secret 仅用于本地 Identity/Data 恢复,**绝不**作为 Cloud 网络鉴权。
- 与 Track B 铁律一致:新设备加入 Cloud 必须经 `Recovery Authority → 授权新设备 → Device Credential → Cloud`,而非 `Recovery Secret → Cloud login`。

### §2.4 Import 必须是显式用户动作
**禁止**自动覆盖:
```
插入备份 → Mirror 自动覆盖当前数据   ❌
```
**必须**显式确认链:
```
Import → 确认目标 → 验证 backup → 确认恢复 → restore   ✅
```
- **尤其不能因恢复失败而覆盖现有 `.enc`**。恢复失败必须落到原状,不得破坏既有加密材料。
- 此条与 ADR-0026「unlock failure MUST NOT destroy existing encrypted material」属同一**数据主权原则**:任何恢复/导入失败,既有数据主权优先于操作完成。

### §2.5 Import 目标是 "恢复 Identity + Data",不是 "恢复文件"
用户意图是:
> "这是我的 Mirror 数据,我要在这台设备继续我的思考。"
而非:
> "我要把 thoughtos.db.enc 拷过去。"

UX 必须围绕:
- 我的数据 / 我的 Identity / 我的 Recovery / 继续我的 Mirror
**而非**围绕数据库文件名。

### §2.6 三种恢复场景(必须全部定义)
| 场景 | 设备状态 | 流程 | 关键约束 |
|---|---|---|---|
| **A. 新电脑** | 空 Mirror | Import → Recovery → 完整恢复 | 全新 Identity 重建 |
| **B. 重装系统** | 空 Mirror(系统清空但用户持有包) | Import → Recovery → 完整恢复 | 同 A,设备指纹变化但包可恢复 |
| **C. 当前设备仍有数据** | 非空 Mirror | Import → **明确选择**:替换 / 新建恢复实例 | **最关键** |

**C 场景铁律**:
- Backup Restore **默认不等于 Merge**。
- Merge 是 **Sync 层语义**(多设备增量收敛);Restore 是 **用户明确的数据恢复操作**(整包重建)。两者必须保持分离。
- 当用户在已有数据的设备上 Import:必须让用户显式选择 `替换(覆盖当前)` 或 `新建恢复实例(隔离)`,**不得默认 Merge、不得静默覆盖**。

### §2.7 Backup 必须有 "恢复成功" 的确定性验证
不能只显示 `Import successful.`。必须验证至少:
1. **Backup integrity** — 包体未损坏、格式版本匹配、签名/校验通过;
2. **Identity integrity** — 恢复出的 Identity 与 Recovery Secret 一致;
3. **Database integrity** — 导入的加密库可正常打开(不要求解密全部内容,但结构完整);
4. **Record count / manifest** — 包内 manifest 记录数可核对(导出时记录,导入后比对);
5. **Recovery authority** — 确由持有 Recovery Secret 的一方完成恢复。

全部通过后,才宣布:
> **"你的数据已经恢复,可以继续使用。"**

---

## §3 与既有边界的关系(不得冲突)

| 边界 | 来源 | 本 Contract 立场 |
|---|---|---|
| 数据主权优先于操作完成 | ADR-0026 | §2.4 恢复失败不覆盖现有 `.enc` |
| Recovery Secret 非网络凭证 | ADR-0027 | §2.3 严格继承 |
| Cloud 非认知源 | Cloud_Sync_Server_Contract | Backup 包独立于 Cloud,可离线恢复 |
| Merge = Sync 语义 / Restore = 用户操作 | 本 Contract 新立 | §2.6-C 分离 |
| Local-first 数据边界 | Stage 1 假设 #1 | Backup 强化"用户可携带",不依赖云 |

---

## §4 明确不做(护栏)

- 不做自动云备份(属 Track C / Production Cloud Service)。
- 不做 Backup 内嵌 Cloud 同步(保持 Local-first 可携带语义)。
- 不引入新密码学原语(复用既有 container 加密 + Recovery Secret,不动 CryptoProvider)。
- 不改动 SyncEngine(Import/Export 与 Sync 是两条独立路径,Restore≠Merge)。
- 不新增 ADR(本 Contract 已是边界冻结,若未来实现需变更边界再走 ADR)。

---

## §5 下一步(实现前门槛)

1. 本 Contract review 通过 → 冻结用户语义与所有权边界。
2. 再决定最小实现改动:核对 `src/api/routes/backup.ts` 现有骨架是否满足 §2.1–§2.7(尤其 §2.4 失败不覆盖、§2.6-C 显式选择、§2.7 确定性验证)。
3. 实现改动若触及边界(如需要新字段/新失败模式),回本 Contract 修订或升 ADR;否则按 Contract 直接收敛。

---

## §6 引用
- ADR-0026(unlock failure MUST NOT destroy)
- ADR-0027(Recovery Secret = Recovery Authority)
- `specs/architecture/Cloud_Sync_Server_Contract_v0.1.md`
- `analysis/architecture-product-capability-audit-v0.1.md`(Track A 第一优先级来源)
- 实现核对目标:`src/api/routes/backup.ts`
