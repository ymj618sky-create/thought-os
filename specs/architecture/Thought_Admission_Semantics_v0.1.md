# Thought Admission Semantics v0.1

> Status: PROPOSED DESIGN (not yet ADR, not yet implemented)
> Depends on: C task (Portrait input cut from raw Thought → Confirmed Evolution Pattern)
> Purpose: 把"什么东西有资格成为这个人的思想"这个缺失的产品语义钉死，
>          作为 C 任务真正干净的输入前提，并彻底分离 收件箱 / 思想空间 / Evolution / Portrait 四层。

---

## 0. 核心判据（用户原话提炼）

Mirror 的问题不在展示层，在提炼层。

- **念头** = 出现过的内容。不一定有结论、不一定被坚持、不一定影响选择。
- **思想** = 至少有一个前提、一个冲突、或一个会改变后续判断的结论的判断。

没有"念头 → 思想"的提炼这一步，信息整合得越全，越像把所有噪音装进更漂亮的抽屉。
任何界面都只是给噪音换了个容器。

---

## 1. 两级准入门槛（状态机）

```
念头 (material / content)
        │
        │  ≥1 admission signal detected (系统发现)
        ↓
候选思想 (candidate Thought)
        │
        │  thesis + premises + fails_when 完整 (结构齐备)
        ↓
用户确认负责 (user confirmation)
        │
        ↓
思想 (confirmed Thought → 思想空间)
        │
        ↓
Evolution Trace
        ↓
Evolution Pattern
        ↓
Portrait
```

**关键不变量：**
- `signal ≠ admission`。信号只决定"候选资格"（candidate eligibility），不决定准入。
- `confirmed` 才是人的 authority。系统推断出的候选 **绝不** 等同于用户承担的判断。

---

## 2. 三个信号的语义权重（必须钉死：不等价）

| 信号 | 含义 | 能推出什么 | 不能推出什么 |
|---|---|---|---|
| `recurrence` | 同一东西反复出现 | 这个东西**值得注意** | 这是一个思想 |
| `conflict` | 与另一个念头发生冲突 | 存在需要解决的**认知张力** | 它自身成为思想 |
| `revision` | 推翻/修正过去判断 | 已发生**实际认知变化**（信号最强） | 可绕过 thesis+premises+fails_when+确认 |

**结论：** 三个信号只能把 content 提升为 *candidate*，不能提升为 *confirmed*。
`revision` 权重最高，但仍不能绕过结构化要求 + 用户确认。

---

## 3. 思想的形式化定义

思想空间中的 Thought =

> 一个**用户愿意承担的**、具有**明确 thesis、前提和失效条件**，并且有**认知演化证据支持**的判断。

分解：

| 对象 | 构成 | 落到哪一层 |
|---|---|---|
| 普通素材 | `content` | 收件箱 |
| 候选思想 | `content` + `≥1 admission signal` | 收件箱（candidate 子区） |
| 思想 | `thesis` + `premises` + `fails_when` + `admission signal` + `user confirmation` | 思想空间 |

---

## 4. 数据契约（Thought.admission）

给现有 Thought 增加一个**可选** `admission` 字段（不破坏现有存储/边界，仅新增）：

```jsonc
"admission": {
  "type": ["object", "null"],
  "default": null,
  "description": "提炼层准入语义。null = 尚未进入候选（纯素材）。",
  "properties": {
    "signals": {
      "type": "array",
      "items": { "enum": ["recurrence", "conflict", "revision"] },
      "uniqueItems": true,
      "description": "系统发现的准入证据。空数组不算候选。"
    },
    "thesis": {
      "type": "string",
      "description": "思想的核心主张（一句话）。与 Thought.thesis 同源/冗余，此处强调它是准入结构的一部分。"
    },
    "premises": {
      "type": "array",
      "items": { "type": "string" },
      "description": "支撑判断的前提。空数组 = 结构不完备，不能 confirmed。"
    },
    "fails_when": {
      "type": "string",
      "description": "该判断在什么情况下失效/不成立。为空 = 不能 confirmed。"
    },
    "status": {
      "type": "string",
      "enum": ["candidate", "confirmed"],
      "description": "candidate = 系统已提名但用户未认领；confirmed = 用户承担负责。"
    },
    "confirmed_at": {
      "type": ["string", "null"],
      "format": "date-time",
      "description": "仅当 status=confirmed 时非 null。"
    }
  },
  "required": ["signals", "thesis", "premises", "fails_when", "status"]
}
```

**严格分流规则（前端 / 查询层）：**

```
Inbox            → admission == null  OR  admission.status != 'confirmed'
Thought Space    → admission.status == 'confirmed'
                    AND thesis != ""
                    AND premises.length > 0
                    AND fails_when != ""
Evolution        → 只能从 confirmed Thought 出发
Evolution Pattern→ 只能从 confirmed Evolution 聚合
Portrait         → 只能从 confirmed Evolution Pattern 读取（C 任务已切断裸 Thought，此处补最后缺口）
```

---

## 5. 与现有架构的关系（不引入新层）

- **不改** Thought 的 `status` 机（active/superseded/archived）——`admission.status` 是**正交**的提炼层状态。
- **不改** Relation 层（challenges/contradicts/superseded_by）——它们仍是张力的权威载体；`admission.signals` 只是指向这些证据的**索引/摘要**，不重复存储。
- **不改** Projection / protocol / lattice——这些是展示投影，准入在此之前发生。
- **C 任务重接入前提**：当前 C 已从 `evolutionPattern`（Confirmed Evolution Pattern）读取 Portrait 输入。本语义补上最后缺口——确保进入 Evolution 的 Thought 本身已是 `confirmed`，从而 Pattern 与 Portrait 不可能间接吞入未认领候选。

---

## 6. 不可违反的原则：不要"自动沉底"

- 一个 Thought 没成为思想 ≠ 它没有价值。
- 它只是"目前还没达到我愿意为这个判断负责的标准"。
- 因此：排序可变化、优先级可变化，但**认知历史不能被系统替用户删除或归档**。
- 与 Thought OS authority boundary 一致：系统可提名（candidate），最终确认权永远在人。

正确的 Inbox 结构（非树状丢弃）：

```
Inbox
├── active material      (admission == null)
├── candidate thought    (admission.status == 'candidate')
└── confirmed thought    (admission.status == 'confirmed'，但用户选择留在收件箱视图)
```

错误结构（禁止）：

```
Inbox → 自动整理 → 垃圾桶
```

---

## 7. 实施顺序（用户拍板）

```
A  Evolution
B  Evolution Pattern
→ Thought Admission   ← 本次补的缺口（只给 Thought 加 admission 状态+证据，非新架构层）
C  Portrait           ← 在 Admission 钉死后重新接入，输入为 Confirmed Thought
```

C 已切断"裸 Thought 直接进 Portrait"，但只有在 Thought Admission 就位后，C 的输入才真正干净：
`Confirmed Thought → Confirmed Evolution → Confirmed Evolution Pattern → Portrait`。

---

## 8. 最小实现范围（后续任务，非本笔记）

1. `Thought.schema.json` 增加 `admission` 字段（可选、默认 null）。
2. `repos.thought` 写入时允许 admission；不强制（旧数据 admission=null 合法）。
3. 信号探测：复用现有 `recurrence`（reflectionChallengeService）、`conflict`（Relation challenges）、`revision`（superseded_by）作为 signals 来源，不新写探测逻辑。
4. 前端分流：Inbox 按 admission.status 三区分区；Thought Space 只显 confirmed 且结构完备者。
5. Evolution 入口守卫：创建 Evolution Trace 前校验源 Thought.admission.status == 'confirmed'。

严禁：新增 ADR、新增架构层、改 Runtime 行为、改产品边界（除非 Observation 驱动）。
