# Observation Projection Implementation v0.1

**Status:** IMPLEMENTATION CONTRACT — v0.1
**Date:** 2026-08-09
**Layer:** Implementation (downstream of ADR-0025, which is ACCEPTED; Cognitive_Layering_Review.md is CONCLUDED)
**Upstream:** `adr/0025-cognitive-layering-semantic-boundaries.md` (ACCEPTED), `specs/architecture/Cognitive_Layering_Review.md` (CONCLUDED)

> 本文档是一份**薄的实现契约**，只规定输入 / 输出 / 映射 / provenance / 确定性身份 / 重算语义 / v0.1 启用范围 / 非目标 / 验证用例。
> 不讨论命名、五层链、Fact 是否删除等架构问题——那些已在 ADR-0025 冻结。
> 不冻结任何关系检测算法或阈值（ADR-0025 §1.4）。

---

## 1. Input Contract

- **唯一输入来源**：已有 `Evidence` 表（`EvidenceLinkingService.locateOrCreate` 已落库的 `raw_content` + `content_hash`，不可变）。
- **不改动** `Evidence` schema、`EvidenceLinking` 逻辑、Evidence 写入路径。
- v0.1 仍经 `ExtractionService.extract()` 触发（对话抽取流水线），但 extractor 输出契约需对齐 §3 的 `relationType`。

---

## 2. Projection Output Contract

v0.1 的 Observation Projection 最小结构（落 `observation` 表，但语义为 Projection/cache，见 §8）：

```text
ObservationProjection {
  relationType: 'recurrence' | 'contradiction'   // v0.1 仅开放这两个
  evidenceIds: string[]                            // 规范化排序后的支持 Evidence
  observation: string                              // 人类可读的关系描述，不含解释/意义
}
```

对应到 `Observation` schema 字段映射（实现时）：
- `relationType` → `pattern_type`（字段名复用，但枚举值按 §3 重定义）
- `evidenceIds` → `evidence_ids`
- `observation` → `content`

---

## 3. relationType Mapping（旧 → ADR，明确映射而非改名）

**核心纪律**：不是把 `pattern_type` 字符串重命名即完成。必须建立"旧 Observation → ADR relationType"的显式映射，再让新 Projection contract 成为唯一输出语义。

| 旧 `pattern_type` | ADR-0025 `relationType` | v0.1 处理 |
|---|---|---|
| `recurring_pattern` | `recurrence` | 映射为 `recurrence`，启用 |
| `explicit_contradiction` | `contradiction` | 映射为 `contradiction`，启用 |
| `single_mention` | — | **淘汰**：单条 Evidence 不构成 relationship，不得以 Observation Projection 名义生成（见 §9 验收条件） |
| `concept_drift` | （不机械映射 `trend`） | v0.1 **不启用**；语义不等价 `trend`，留待后续扩展 cycle 单独定义 |
| `lattice_synthesis` | — | **不动**：属 ADR-0013 独立通道，非 relationship Projection，保持原样 |
| `trend` / `contrast` / `correlation` / `absence` | 同左 | v0.1 **不启用**（见 §7 扩展顺序） |

实现动作：
1. extractor prompt (`(private agent capability)`) 输出契约改为只产出 `recurrence` / `contradiction` 两类关系（v0.1）。
2. `extraction.ts` 的 `PATTERN_TYPES` 闭集与 `Observation.schema.json` 的 `pattern_type` 枚举，v0.1 阶段收敛为 `['recurrence', 'contradiction', 'lattice_synthesis']`（`lattice_synthesis` 保留不动）。`single_mention` / `concept_drift` 从 v0.1 生成端移除（存量数据按 §6 重算语义处理）。

---

## 4. Provenance Contract

- 任何 Observation Projection 必须能回答"你为什么认为这是一个模式"：回指 `evidenceIds[]`。
- `evidenceIds` 为空 = 非法（违反 ADR §1.3.1），整条丢弃。
- `observation` 文本只描述关系（如"关于周会的回避感在多个时间点重复出现"），**不得**包含意义解释（不得出现"你不喜欢 X" / "你正在失去投入"等 Interpretation 措辞）。
- 不进入 Thought lifecycle，不修改 Evidence。

---

## 5. Deterministic Identity / Dedup

逻辑键（实现层）：

```text
relationKey = relationType + ":" + sort(evidenceIds).join(",")
```

- `evidenceIds` **必须规范化排序**后再比较：`[E3,E1,E2]` 与 `[E2,E3,E1]` 视为同一 relationship。
- 以 `relationKey` 做幂等 upsert：同 key 重复出现 → 更新 `observation` 文本 / `evidenceIds`，不新建行。
- **禁止**用 `content === content` 去重（旧逻辑 `extraction.ts:217`）：Projection 因重算导致 `observation` 文本变化，不应被视为"新认知对象"打扰用户。

---

## 6. Recomputation Semantics

- Projection 的 `evidenceIds` 集合允许随重新计算扩张：今天 `recurrence(E1,E2)`，明天 `recurrence(E1,E2,E3)` 视为**同一关系获得新支持证据**，按 `relationKey` 合并，不新建。
- v0.1 不实现复杂"增量合并算法"，但必须明确：旧 Projection 不能因 content 改变就被视为新对象（依赖 §5 的 `relationKey`）。
- 删掉 Observation row 后，必须能从 Evidence 重新计算出来；**不能因 Observation 消失而丢失认知事实**。这是比"是否持久化"更重要的边界（§8）。

---

## 7. v0.1 Enabled Relationship Types

```text
ENABLED:  recurrence, contradiction
DEFERRED: trend, contrast, correlation, absence, concept_drift
```

扩展顺序（验证驱动，不提前）：
```text
recurrence / contradiction
   → 验证 Projection 是否真的产生增量
   → trend / contrast
   → 最后 correlation / absence
```

`absence` 的 `observation_window` 字段**不在本契约范围**：等真正实现 `absence` 时再落地，不为 schema 完整提前做（避免 extractor 生成 → UI 无法表达 → 又补 UX/ranking/confidence 的连锁）。

---

## 8. Persistence Semantics（关键边界澄清）

"Projection 不成为事实源" **≠** "实现上绝对不能写数据库"。

- 允许为 Inbox 去重 / 展示 / 生命周期暂存而将 Projection 写入 `observation` 表。
- 但架构上它必须被视为：
  ```text
  Evidence → Projection computation → Observation projection/cache
  ```
  而非：
  ```text
  Evidence → Observation → Observation 成为新的 Evidence-like fact source
  ```
- 数据库里的 Observation row 必须遵守 §6：可重新计算、删除不丢认知事实。

---

## 9. Explicit Non-Goals (v0.1)

```text
DO NOT
✗ 不改 Evidence schema / EvidenceLinking
✗ 不改 Questioner
✗ 不改 Inbox UX
✗ 不改 Fact lifecycle
✗ 不实现 Interpretation confirmation（accept/reject/correct）
✗ 不实现 correlation
✗ 不实现 absence（含 observation_window 字段）
✗ 不实现复杂 trend detection
✗ 不冻结算法 / 阈值
✗ 不为 concept_drift / single_mention 生成 Projection
```

**核心验收条件**：任何只有单条 Evidence、没有跨 Evidence relationship 的输出，不得以 Observation Projection 名义生成。这条是整个架构重构的验收底线。

---

## 10. Validation Cases

### V1 recurrence（正确边界）
```text
E1: "周一又不想参加那个会议。"
E2: "今天想到周会就有点烦。"
E3: "下周的会议我还是不太想去。"
→ relationType: recurrence
  evidenceIds: [E1,E2,E3] (排序后)
  observation: "关于周会的回避感在多个时间点重复出现。"
```
断言：`observation` 不含 "你不喜欢周会" / "你正在失去投入"。

### V2 contradiction（正确边界）
```text
E1: "我其实很喜欢带这个项目。"
E2: "最近越来越不想碰这个项目。"
→ relationType: contradiction
  evidenceIds: [E1,E2]
  observation: "不同时间的记录中，对这个项目的态度出现明显不一致。"
```
断言：不直接生成 Thought；仅可后续触发 Interpretation Candidate。

### V3 单 Evidence 淘汰
```text
E1: "我有点不想开会。"
→ 无跨 Evidence relationship → 不得以 Observation Projection 名义生成
```
断言：`single_mention` 类输出在 v0.1 被丢弃。

### V4 确定性去重
```text
抽取1: recurrence([E3,E1,E2])
抽取2: recurrence([E2,E3,E1])
→ 同 relationKey → upsert 一次，不重复
```

### V5 证据集扩张
```text
今天: recurrence([E1,E2])
明天: recurrence([E1,E2,E3])
→ 同 relationKey 合并，evidenceIds 扩张为 [E1,E2,E3]，不新建
```

### V6 lattice_synthesis 不动
```text
现有 pattern_type='lattice_synthesis' 的 Observation 保持原样，不受 v0.1 映射影响
```

---

*IMPLEMENTATION CONTRACT v0.1 — 直接进入实现，不再开架构确认轮。*
