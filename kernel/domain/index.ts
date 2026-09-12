/**
 * Schema 即权威（设计 §4.1）。
 * 启动时直接加载 specs/schemas/ 下 6 个 JSON Schema 注册到 ajv；
 * 每个 repo 的 put 写入前必过校验，失败即明确错误，绝不用默认值/占位符绕过。
 *
 * 说明（与设计的偏差）：设计建议用 json-schema-to-ts 派生 TS 类型。这里改为
 * 显式 TS 接口——它们是 6 个 schema 的镜像，运行时真正的权威仍是 ajv 校验
 * （schema 文件是唯一事实源）。显式接口更稳、不引入额外依赖的类型推导不确定性。
 */
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { ValidateFunction } from 'ajv';
import { SchemaViolationError } from '../errors';

import evidenceSchema from '../../specs/schemas/Evidence.schema.json';
import observationSchema from '../../specs/schemas/Observation.schema.json';
import interpretationSchema from '../../specs/schemas/Interpretation.schema.json';
import thoughtSchema from '../../specs/schemas/Thought.schema.json';
import questionSchema from '../../specs/schemas/Question.schema.json';
import relationSchema from '../../specs/schemas/Relation.schema.json';
import reflectionSchema from '../../specs/schemas/Reflection.schema.json';
import thoughtMaturitySchema from '../../specs/schemas/ThoughtMaturitySnapshot.schema.json';
import evolutionTraceSchema from '../../specs/schemas/EvolutionTrace.schema.json';
import evolutionPatternSchema from '../../specs/schemas/EvolutionPattern.schema.json';
import portraitCandidateSchema from '../../specs/schemas/PortraitCandidate.schema.json';
import rawEvidenceSchema from '../../specs/schemas/RawEvidence.schema.json';
// ADR-0020 §6.2 / §16 P4：思考进入现实的接口与现实反馈闭环。
import decisionSchema from '../../specs/schemas/Decision.schema.json';
import outcomeSchema from '../../specs/schemas/Outcome.schema.json';

export type EntityType =
  | 'evidence'
  | 'observation'
  | 'interpretation'
  | 'thought'
  | 'question'
  | 'relation'
  | 'reflection'
  | 'thoughtMaturity'
  | 'evolutionTrace'
  | 'evolutionPattern'
  | 'portraitCandidate'
  | 'raw_evidence'
  // ADR-0020：Decision（思考→现实）与 Outcome（现实→反馈）
  | 'decision'
  | 'outcome';

export interface Evidence {
  id: string;
  user_id: string;
  raw_content: string;
  content_hash: string;
  /** 输入渠道。web_research = ADR-0020 P1 外部世界检索材料（配套 origin='world'）。 */
  source_type:
    | 'chat_message'
    | 'voice_transcript'
    | 'uploaded_text'
    | 'uploaded_file'
    | 'web_research';
  captured_at: string;
  created_at: string;
  /**
   * Bidirectional Thought Formation（Phase A）：Evidence 的说话方。
   * 历史/既有记录无此字段，默认视为 'user'；Mirror 回复落成 Evidence 时置 'mirror'。
   * 仅用于溯源——Evidence 本身仍不可变，不表示其归属已变成用户思想。
   */
  speaker?: 'user' | 'mirror';
  /** 指向原始 Conversation Event（CONVERSATION_TABLE.id），用于 Mirror 回复溯源（Phase A）。user 来源通常为 null。 */
  conversation_event_id?: string | null;
  /**
   * C-004 Provenance：指向产生此 Evidence 的原始材料 RawEvidence（specs/schemas/RawEvidence.schema.json）。
   * 当 Evidence 由导入文字（diary / essay / movie_review / book_review …）经 RawEvidence 派生时，须回填此锚点，
   * 使 provenance 链 Evidence ← RawEvidence 闭合（否则链条断在 Evidence 这一环）。
   * chat_message / voice_transcript 等直接来自对话的 Evidence 无 RawEvidence 来源，置 null（改用 conversation_event_id 溯源）。
   * 可选、可空、不可变（Evidence 写入后禁止 update，仅随整条删除移除）。
   */
  raw_evidence_id?: string | null;
  /**
   * ADR-0020 §5：来源世界维度。self=用户自身；world=外部世界；action=行动与结果。
   * 与 source_type（输入渠道）正交：同一条 chat_message 可能是 self（自述经历），
   * 也可能是 world（转述外部事实），由 origin 决定它参与哪类认知。旧记录缺省视为 'self'。
   */
  origin?: 'self' | 'world' | 'action';
  /**
   * ADR-0020 §5 细分类型。
   * self: statement|experience|observation|reflection
   * world: fact|event|research|market|other_opinion|change
   * action: decision|action|outcome
   */
  evidence_kind?: string | null;
  /**
   * ADR-0020 §5：origin='world' 时的外部来源，使信息可核查。
   * 不可核查的 world 证据不得驱动 Challenge——这是 world evidence 与主观表达的关键区别。
   */
  world_ref?: {
    source: string;
    url?: string | null;
    retrieved_at?: string | null;
    publisher?: string | null;
    credibility?: 'primary' | 'reputable' | 'unknown' | 'contested' | null;
  } | null;
}

export interface Observation {
  id: string;
  user_id: string;
  content: string;
  evidence_ids: string[];
  /**
   * Observation pattern_type（ADR-0025 下游：Observation = relationship projection）。
   * v0.1 生成端只产出 'recurrence' | 'contradiction'（见 Observation_Projection_Implementation_v0.1.md）。
   * 'lattice_synthesis' 是 ADR-0013 后台合成通道，独立保留，不受 v0.1 关系闭集约束。
   * 旧值 'single_mention' | 'recurring_pattern' | 'explicit_contradiction' | 'concept_drift'
   * 保留在类型中以兼容存量数据，但 v0.1 抽取层不再生成。
   */
  pattern_type?:
    | 'recurrence'
    | 'contradiction'
    | 'lattice_synthesis'
    | 'single_mention'
    | 'recurring_pattern'
    | 'explicit_contradiction'
    | 'concept_drift';
  /** Runtime v2.0：所属思考空间（用于观察流按空间过滤）。由抽取/合成流水线从会话上下文写入。 */
  space_id?: string | null;
  status: 'active' | 'dismissed';
  dismissed_at?: string | null;
  created_at: string;
}

export interface Interpretation {
  id: string;
  user_id: string;
  content: string;
  evidence_ids: string[];
  observation_ids: string[];
  confidence: number;
  confidence_rationale?: string;
  /** Runtime v2.0：认知张力摘要（用于 Confirmation 时计算 Thought 的 projection.tension）。 */
  tension?: string | null;
  status: 'pending' | 'confirmed' | 'rejected' | 'superseded';
  /** Bidirectional Thought Formation (Phase B)：认知来源。
   *  'user' = 来自用户表达（默认/历史兼容）；'mirror' = 来自 Mirror 回复、经用户确认前仅为 pending 候选。
   *  source=mirror 不代表归属用户——必须经 Phase C 用户确认才可能经 confirmation 落 Thought。 */
  source?: 'user' | 'mirror';
  superseded_by?: string | null;
  /** 所属 Thinking Space id（Product Aggregate Layer v0.1）。抽取时归属，确认后继承给 Thought。 */
  space_id?: string | null;
  created_at: string;
  confirmed_at?: string | null;
}

export interface Thought {
  id: string;
  user_id: string;
  content: string;
  /** 重构新增：核心主张的一句话提炼，用于思想列表/卡片标题；为空时前端回退到 content 摘要。 */
  thesis?: string | null;
  /** 重构新增：支撑这条思想的理由（用户认可的前提）。 */
  premises?: string[];
  /** 重构新增：这条思想回应/化解的张力（Relation/Interpretation id 或张力文本）。 */
  tension_ref?: string | null;
  lattice_level: number;
  /** 触发该 Thought 落库时生效的 Cognitive Protocol（十二晶格 × Protocol 二维坐标的「How」轴）。 */
  protocol?: string | null;
  lattice_levels_secondary?: number[];
  status: 'active' | 'superseded' | 'archived';
  version: number;
  superseded_by?: string | null;
  evidence_ids: string[];
  origin_type: 'user_authored' | 'derived_from_interpretation';
  origin_interpretation_id?: string | null;
  confirmed_at: string;
  related_thought_ids?: string[];
  related_question_ids?: string[];
  /** 所属 Thinking Space id（Product Aggregate Layer v0.1）。上层聚合归属，不参与 Kernel 校验。 */
  space_id?: string | null;
  /** 触发该 Thought 落库的 Reflection id（Phase 1 预留：关联 Artifact ↔ Reflection）。 */
  source_reflection_id?: string | null;
  /** Runtime v2.0：多坐标投影（由 Interpretation + Observations 在 Confirmation 时计算）。 */
  projection?: {
    lattice: Array<{ level: number; weight: number }>;
    protocol: Array<{ protocol: string; weight: number }>;
    tension: string | null;
  } | null;
  /** Runtime v2.0：该 Thought 主关联 Interpretation 的张力摘要。 */
  tension?: string | null;
  /** 重构 v2：指向生成此 Thought 候选的 Reflection（Reflection→Thought 桥梁引用）。 */
  origin_reflection_id?: string | null;
  /** 重构 v2：成熟度阶段（冗余派生字段）；真相在 ThoughtMaturitySnapshot 四维向量。不叫 status。 */
  maturity_stage?: 'emerging' | 'developing' | 'stable' | 'core';
  /**
   * 提炼层准入语义（Thought_Admission_Semantics v0.1）。
   * null = 纯素材，尚未进入候选。系统可提名 candidate，confirmed 只能由用户确认动作产生。
   */
  admission?: {
    signals: Array<'recurrence' | 'conflict' | 'revision'>;
    thesis: string;
    premises: string[];
    fails_when: string;
    status: 'candidate' | 'confirmed';
    confirmed_at: string | null;
  } | null;
  /** 提炼层准入语义：该判断在什么情况下失效/不成立（思想可负责结构的一部分）。 */
  fails_when?: string | null;
  /** ADR-0020 §6.1：成立条件/适用范围。与 fails_when 共同界定认知模型边界。 */
  applies_when?: string | null;
  /**
   * ADR-0020 §6.1：最近一次被现实检验的时间。
   * **刻意替代 confidence 字段**——schema 顶层 not 约束禁止 confidence/importance_score，
   * 因置信度若由系统写入即构成认知越权。可信度改由『是否已被现实检验』客观表达。
   */
  last_tested?: string | null;
  /** ADR-0020 §6.2：受本 Thought 影响的 Decision id（与 Decision.thought_ids 互为反向索引）。 */
  decisions_influenced?: string[];
  /** ADR-0020 §16 P4：检验过本 Thought 的 Outcome id（权威数据在 Outcome.thought_ids）。 */
  outcome_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface Reflection {
  id: string;
  user_id: string;
  /** Reflection Event 的概要（原 content 字段语义降级为 summary；事件本身不是"一段总结文本"）。 */
  content: string;
  triggers?: string[];
  emotional_context?: string;
  initial_question?: string;
  related_experiences?: string[];
  conversation_ids?: string[];
  /** Reflection Event 的产出：本次事件直接生成的 Thought id 列表（事件溯源，无产出则为空数组）。 */
  generated_thought_ids?: string[];
  space_id?: string | null;
  created_at: string;
}

export interface ThoughtMaturitySnapshot {
  id: string;
  user_id: string;
  thought_id: string;
  clarity: number;
  stability: number;
  recurrence: number;
  connection: number;
  calculated_at: string;
}

export interface EvolutionTrace {
  id: string;
  user_id: string;
  from_thought_id: string;
  to_thought_id: string;
  change_type:
    | 'clarification'
    | 'expansion'
    | 'tension_added'
    | 'question_shift'
    | 'reconsideration';
  // ── 语义演化核心字段（Step A：替代纯数值 delta）──
  // oldStance/newStance/whatChanged/whyLikely 才是 Evolution 的本质，
  // changeType 降为辅助标签（ADR-0032 §Evolution 语义化）。
  old_stance: string;
  new_stance: string;
  what_changed: string;
  why_likely: string;
  evidence?: string[];
  status: 'proposed' | 'confirmed' | 'rejected';
  proposed_at: string;
  confirmed_at?: string;
}

export type ChangeType = EvolutionTrace['change_type'];

// ── Evolution Pattern（Step B：Confirmed Evolution Trace 的轻量聚合）─────────────
// 不是新架构层，不是 Memory/Knowledge/Profile/Ranking 系统。
// 只是对多条 confirmed Evolution Trace 的确定性聚合 + LLM 归纳描述。
// 核心捕获"变化模式"而非"主题"：source → transformation 的重复结构。
export interface EvolutionPattern {
  id: string;
  user_id: string;
  /**
   * 自然语言归纳描述（LLM 生成，仅负责把已存在的重复结构翻译成文字）。
   * 例如："在多个关系议题中，反复将情感或互动问题重新理解为双方责任关系。"
   */
  pattern: string;
  /**
   * 核心概念（确定性抽取：从 evidence trace 的 old/new stance 中提取的归一化概念）。
   * 例如：["理解", "责任", "关系"]。
   */
  core_concepts: string[];
  /**
   * 变化模式结构（确定性聚合结果，不依赖 LLM）：
   * source_pattern：反复出现的"原始立场"形态（如 ["关系中的理解", "关系中的信任"]）
   * transformation_pattern：反复出现的"转变方向"（如 "→ 责任关系"）
   */
  source_pattern: string[];
  transformation_pattern: string;
  /** 可回溯证据：所有支撑本 Pattern 的 confirmed Evolution Trace id。 */
  evidence_trace_ids: string[];
  evidence_count: number;
  status: 'candidate' | 'confirmed' | 'challenged';
  proposed_at: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
}

// ── Portrait Candidate（Step C：Confirmed Evolution Pattern 的再聚合）──────────
// 不是新架构层，不是心理诊断 / 人格分类 / Memory / Profile 系统。
// 只是对 ≥2 条 confirmed Evolution Pattern 的跨情境认知层归纳 + LLM 人格/认知倾向描述。
// 核心纪律：
//   - 裸 Thought 不是 Portrait 输入（只接受 Confirmed Evolution Pattern）
//   - Portrait 是"认知画像"不是"心理诊断"（主权红线拦截本质身份断言/替用户决定）
//   - candidate → confirmed 必须用户显式确认，绝不自动确认
//   - 每条 Portrait 必须可回溯 evidence_pattern_ids → EvolutionPattern → EvolutionTrace → Thought
export interface PortraitCandidate {
  id: string;
  user_id: string;
  /**
   * LLM 跨 Pattern 归纳出的认知/人格层描述（推测性、可被质疑）。
   * 例如："从已确认的思想演化记录来看，你在面对关系议题时，似乎倾向于把情感经验进一步结构化为责任关系。"
   */
  portrait: string;
  /**
   * 支撑本 Portrait 的 confirmed Evolution Pattern id 列表（provenance 锚点）。
   * 必须 ≥2 条（PORTRAIT_MIN_PATTERNS 门槛）。
   */
  evidence_pattern_ids: string[];
  evidence_count: number;
  /** 从 evidence pattern 聚合出的核心概念（确定性，便于 UI 展示与 forbidden 检查）。 */
  core_concepts: string[];
  /**
   * 各 Pattern 的归纳摘要拼合（确定性，供 UI 展开"为什么系统这样认为"）。
   * 形如：[{ patternId, summary }]
   */
  pattern_summaries: Array<{ pattern_id: string; summary: string }>;
  /** 主权红线（forbidden_hits）命中记录（若 LLM 越界，记入但不自动确认，等待用户裁决）。 */
  forbidden_hits: string[];
  status: 'candidate' | 'confirmed' | 'challenged';
  proposed_at: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  user_id: string;
  content: string;
  status: 'pending' | 'open' | 'archived';
  origin_type: 'user_authored' | 'ai_suggested';
  evidence_ids?: string[];
  parent_question_id?: string | null;
  /** 所属 Thinking Space id（Product Aggregate Layer v0.1）。上层聚合归属，不参与 Kernel 校验。 */
  space_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Relation {
  id: string;
  user_id: string;
  from_id: string;
  from_type: 'thought' | 'question' | 'interpretation';
  to_id: string;
  to_type: 'thought' | 'question';
  relation_type:
    | 'supports'
    | 'contradicts'
    | 'refines'
    | 'merged_from'
    | 'answers'
    | 'raises'
    | 'decomposes'
    | 'challenges';
  origin_type: 'user_authored' | 'ai_suggested';
  status: 'pending' | 'confirmed' | 'rejected' | 'superseded';
  confidence?: number | null;
  evidence_ids?: string[];
  superseded_by?: string | null;
  created_at: string;
  confirmed_at?: string | null;
}

/** 内容类型（provenance，来自用户 / 导入适配器指定，绝不来自 AI 语义判断）。 */
export type RawEvidenceType = 'diary' | 'movie_review' | 'book_review' | 'essay' | 'other';

export interface RawEvidence {
  id: string;
  user_id: string;
  author?: string | null;
  content: string;
  timestamp: string;
  source: string;
  source_ref?: string | null;
  /** 内容类型：日记 / 影评 / 书评 / 随笔 / 其他（provenance，非解释）。缺省视为 'other'。 */
  type?: RawEvidenceType | null;
  metadata?: Record<string, unknown> | null;
  content_hash: string;
  created_at: string;
  updated_at?: string | null;
  status?: string | null;
}

// ── Decision（ADR-0020 §6.2：思考进入现实的接口）─────────────────────────────
/**
 * Thought OS 帮助用户定义问题、找证据、找隐含假设、找反例、比较方案、暴露不确定性、
 * 预测结果、记录决定——**但不替用户决定**。
 * 宪法落点：`decision` / `rationale` / `decided_at` 只能由用户动作写入，
 * 系统推断的建议只能落在 options / assumptions / risks / counter_evidence。
 */
export interface Decision {
  id: string;
  user_id: string;
  problem: string;
  status: 'drafting' | 'decided' | 'reviewed' | 'abandoned';
  options: Array<{
    id: string;
    label: string;
    description?: string | null;
    proposed_by?: 'user' | 'mirror';
  }>;
  assumptions: string[];
  evidence_ids: string[];
  /** 参与本次决策的过去判断（与 Thought.decisions_influenced 互为反向索引）。 */
  thought_ids: string[];
  expected_outcomes: string[];
  risks: string[];
  /** 已经存在的不利事实（区别于 risks 的『未来可能发生』）。Challenge 的落点。 */
  counter_evidence?: string[];
  /** 用户最终选择。**只能由用户动作写入**，系统不得自动填充。 */
  decision?: string | null;
  decided_option_id?: string | null;
  rationale?: string | null;
  decided_at?: string | null;
  /** 回顾日期；到期后由 Notice Engine 提出『decision worth revisiting』。 */
  review_date?: string | null;
  outcome_ids?: string[];
  space_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ── Outcome（ADR-0020 §16 P4：现实反馈）─────────────────────────────────────
/**
 * 『当时怎么判断 → 做了什么 → 结果怎么样』。
 * 没有 Outcome，Thought 永远只是观点；有了 Outcome，Thought 才成为可检验的模型。
 * 宪法落点：`learned` 只由用户写入（系统可追问，不得替用户总结『你学到了 X』）。
 */
export interface Outcome {
  id: string;
  user_id: string;
  decision_id?: string | null;
  /** 本次结果所检验的 Thought（『判断 vs 现实』的连接点）。 */
  thought_ids?: string[];
  evidence_ids?: string[];
  action: string;
  outcome: string;
  /** 允许 unknown——信息不足时强行下结论比不下结论更糟。 */
  outcome_type: 'as_expected' | 'better' | 'worse' | 'mixed' | 'unknown';
  /** 预期与实际的差距。校准（calibration）能力的核心输入。 */
  expected_vs_actual?: string | null;
  /** 学到了什么。**只由用户写入**。 */
  learned?: string | null;
  /** 被本次结果证伪/削弱的 Thought（区别于 thought_ids 的『参与检验』）。 */
  invalidates_thoughts?: string[];
  /** 超出预期、事先没想到的部分。发现『假设错误』最直接的来源。 */
  surprises?: string[];
  recorded_at: string;
  occurred_at?: string | null;
  space_id?: string | null;
  created_at: string;
}

export type AnyRecord =
  | Evidence
  | Observation
  | Interpretation
  | Thought
  | Question
  | Relation
  | Reflection
  | ThoughtMaturitySnapshot
  | EvolutionTrace
  | EvolutionPattern
  | PortraitCandidate
  | RawEvidence
  | Decision
  | Outcome;

const SCHEMAS: Record<EntityType, object> = {
  evidence: evidenceSchema,
  observation: observationSchema,
  interpretation: interpretationSchema,
  thought: thoughtSchema,
  question: questionSchema,
  relation: relationSchema,
  reflection: reflectionSchema,
  thoughtMaturity: thoughtMaturitySchema,
  evolutionTrace: evolutionTraceSchema,
  evolutionPattern: evolutionPatternSchema,
  portraitCandidate: portraitCandidateSchema,
  raw_evidence: rawEvidenceSchema,
  // ADR-0020
  decision: decisionSchema,
  outcome: outcomeSchema,
};

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validators = {} as Record<EntityType, ValidateFunction>;
for (const type of Object.keys(SCHEMAS) as EntityType[]) {
  validators[type] = ajv.compile(SCHEMAS[type]);
}

/** 用对应 schema 校验记录；失败抛 SchemaViolationError（带字段级细节）。 */
export function validateRecord(type: EntityType, record: unknown): void {
  const validate = validators[type];
  if (!validate(record)) {
    throw new SchemaViolationError(type, ajv.errorsText(validate.errors));
  }
}
