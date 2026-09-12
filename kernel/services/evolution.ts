/**
 * Thought Evolution 最小闭环（设计冻结 v0.1）。
 *
 * 设计红线（来自 thought-evolution-design-freeze.md 与 ADR-0028/0029）：
 * - EvolutionTrace 不持 authority（ADR-0028 Q5 Projection 约束），仅为已有事实之间的关系载体，非新事实源。
 * - proposeEvolution 生成候选并落库为 status: proposed（候选态，不构成认知事实，可随时 reject 清除）。
 *   绝不自动把 Evolution 写进 Thought（不 supersede / 改写 Thought 内容），系统不持有 cognitive authority。
 * - confirmEvolution 仅在用户显式确认后才把 status 置为 confirmed，形成有效 Trace。
 * - 不引入 LLM 自动 proposal（propose 是纯规则推导，无网络调用）；Snapshot 比较完全基于 repos，不依赖 LLM。
 * - changeType 是候选标签，不由 AI 强制定义（见设计冻结 §4）。
 * - 本模块纯规则对比，无 LLM 调用、无"判断用户变了"的语义（自然语言叙述留给未来阶段）。
 */
import type { EvolutionTrace, EvolutionPattern, Thought, ThoughtMaturitySnapshot } from '../domain';
import type { Repos } from '../ports/repositories';
import type { LLMClient } from '../llm/LLMClient';
import { createId } from '../utils/id';

const CHANGE_TYPES = [
  'clarification',
  'expansion',
  'tension_added',
  'question_shift',
  'reconsideration',
] as const;

export type ChangeType = (typeof CHANGE_TYPES)[number];

/**
 * 准入守卫（Thought_Admission_Semantics v0.1）：Evolution 只允许从
 * admission.status === 'confirmed' 的 Thought 出发。
 * 系统可提名 candidate，但 candidate / 纯素材 / rejected / superseded
 * 都不能进入 Evolution，从而确保链路是：
 *   Confirmed Thought → Confirmed Evolution → Confirmed Pattern → Portrait
 * 而非 Candidate/裸 Thought 间接泄漏进 Portrait。
 */
export function isAdmittedThought(t: Thought | null | undefined): boolean {
  return !!t && t.admission?.status === 'confirmed';
}

/** 准入拒绝原因（用于 API 错误信息，不暴露内部细节）。 */
export function admissionRejectionReason(t: Thought | null | undefined): string {
  if (!t) return 'Thought 不存在';
  if (!t.admission) return '该 Thought 尚未进入候选（无 admission），不能进入 Evolution';
  if (t.admission.status !== 'confirmed') {
    return `该 Thought 仍是候选（status=${t.admission.status}），需用户确认负责后才能进入 Evolution`;
  }
  return '';
}

export interface EvolutionCandidate {
  fromThoughtId: string;
  toThoughtId: string;
  changeType: ChangeType;
  evidence: string[];
  /** 纯规则推导的支撑信号（不面向用户，仅供调试/未来 UI 解释）。 */
  signal: {
    clarityDelta: number;
    stabilityDelta: number;
    recurrenceDelta: number;
    connectionDelta: number;
    contentLengthDelta: number;
  };
  /**
   * 语义演化核心（Step A）：oldStance/newStance/whatChanged/whyLikely
   * 由 LLM 基于两条 Thought 内容生成；LLM 不可用则回退到纯规则直填。
   * 这是 Evolution 的本质，changeType 仅作辅助标签。
   */
  oldStance: string;
  newStance: string;
  whatChanged: string;
  whyLikely: string;
  /**
   * 可读变化维度（纯规则映射，非 LLM 叙述，非 AI 判断）。
   * 仅把数值 delta 翻译成"变化发生在哪个维度"，不替用户下结论。
   * 这是回答"为什么这两个 Thought 被认为存在变化"的最小可读载体。
   */
  readableSignal: string[];
}

/**
 * 纯规则：把四维 delta + 内容长度变化映射为可读维度描述。
 * 不调用 LLM、不生成自然语言叙述、不替用户定义"你变了"。
 * 仅描述可观测的变化维度（让用户自己判断是否有意义）。
 */
export function buildReadableSignal(s: EvolutionCandidate['signal']): string[] {
  const out: string[] = [];
  if (s.clarityDelta >= 0.15) out.push('这则思考的清晰度提升了');
  else if (s.clarityDelta <= -0.15) out.push('这则思考的清晰度下降了');
  if (s.connectionDelta >= 0.15) out.push('它与其他思考的连接增多了');
  else if (s.connectionDelta <= -0.1) out.push('它与其他思考的连接减少了');
  if (s.contentLengthDelta > 40) out.push('表达的篇幅明显扩展了');
  else if (s.contentLengthDelta < -40) out.push('表达的篇幅明显收缩了');
  if (s.stabilityDelta <= -0.15) out.push('它的确定性下降了（可能进入重新考虑）');
  if (s.recurrenceDelta >= 0.1) out.push('相关的张力或复现度上升了');
  if (out.length === 0) out.push('暂未检测到显著的可量化变化');
  return out;
}

function latestSnapshot(
  repos: Repos,
  thoughtId: string
): ThoughtMaturitySnapshot | null {
  const snaps = repos.thoughtMaturity
    .query({ thought_id: thoughtId })
    .sort((a, b) => String(a.calculated_at).localeCompare(String(b.calculated_at)));
  return snaps.length ? (snaps[snaps.length - 1] ?? null) : null;
}

// ── 候选发现配置（验收条件 1：不引入 Embedding/Ranking）──────────────────────
/** 时间窗口：仅在过去 N 天内的旧 Thought 中找候选。 */
export const CANDIDATE_TIME_WINDOW_DAYS = 30;
/** 关键词重叠最小词数（分词后交集大小）。 */
export const CANDIDATE_MIN_KEYWORD_OVERLAP = 2;
/** 最多返回候选数。 */
export const CANDIDATE_MAX = 5;

// ── 轻量中文分词（n-gram 2~4 字，不引入外部 NLP 依赖）──────────────────────
// 中文无空格，直接对清洗后的连续文本生成所有长度 2~4 的子串，
// 保证"责任""理解"等关键词必然作为独立 token 出现，供重叠匹配。
function tokenize(text: string): Set<string> {
  const cleaned = text.replace(/[\s，。、；：！？“”‘’（）()\[\]【】…—.,;:!?]/g, '');
  const tokens = new Set<string>();
  const n = cleaned.length;
  for (let len = 2; len <= 4; len++) {
    for (let i = 0; i + len <= n; i++) {
      tokens.add(cleaned.slice(i, i + len));
    }
  }
  return tokens;
}

function keywordOverlap(a: string, b: string): number {
  const sa = tokenize(a);
  const sb = tokenize(b);
  let n = 0;
  for (const t of sa) if (sb.has(t)) n++;
  return n;
}

/**
 * 候选发现：新 Thought → 可能的 predecessor 列表。
 * 纪律：候选发现 ≠ Evolution 判断。关键词系统只说"可能相关"，无权说"这就是演化"。
 * 过滤条件：同 user + active + 同 space + 同 lattice + 时间窗口内 + 关键词重叠达标。
 * 不落库、绝不自动确认。
 */
export function findEvolutionCandidates(
  repos: Repos,
  newThought: Thought,
  userId: string,
): Array<{ fromThoughtId: string; overlap: number; score: number }> {
  const windowMs = CANDIDATE_TIME_WINDOW_DAYS * 24 * 3600 * 1000;
  const now = Date.parse(newThought.created_at || new Date().toISOString());
  const found: Array<{ fromThoughtId: string; overlap: number; score: number }> = [];

  const oldThoughts = repos.thought
    .query({ user_id: userId, status: 'active' })
    .filter((t) => t.id !== newThought.id)
    .filter((t) => (t.space_id ?? null) === (newThought.space_id ?? null))
    .filter((t) => t.lattice_level === newThought.lattice_level)
    .filter((t) => {
      const ts = Date.parse(t.created_at);
      return ts < now && now - ts <= windowMs;
    });

  for (const t of oldThoughts) {
    const overlap = keywordOverlap(t.content, newThought.content);
    if (overlap < CANDIDATE_MIN_KEYWORD_OVERLAP) continue;
    const ageDays = (now - Date.parse(t.created_at)) / (24 * 3600 * 1000);
    const recency = 1 - ageDays / CANDIDATE_TIME_WINDOW_DAYS; // 0..1，越近越高
    const score = overlap + recency * 0.5;
    found.push({ fromThoughtId: t.id, overlap, score });
  }

  found.sort((a, b) => b.score - a.score);
  return found.slice(0, CANDIDATE_MAX);
}

// ── LLM 语义演化生成（oldStance/newStance/whatChanged/whyLikely）─────────────
async function generateSemanticEvolution(
  llm: LLMClient,
  fromContent: string,
  toContent: string,
): Promise<{ oldStance: string; newStance: string; whatChanged: string; whyLikely: string }> {
  const systemPrompt = `你是 Thought OS 的 Evolution Analyzer。给定同一个人的两条 Thought（较早的想法 A，较近的想法 B），描述思想如何从 A 演化到 B。

# 硬性约束
- 你绝不下人格诊断、绝不使用心理学术语或思想流派归类。
- oldStance 用第一人称重写 A 的核心立场（"我原来认为…"）。
- newStance 用第一人称重写 B 的核心立场（"我现在认为…"）。
- whatChanged 用一两句话描述"从 A 到 B 发生了什么变化"，聚焦思想内容的转向，而非字数/成熟度。
- whyLikely 推测"为什么可能发生这个变化"（基于 A、B 内容本身的逻辑，不做外部归因），用推测性措辞（"可能""似乎"）。
- 只输出 JSON，不要任何前后缀：{"oldStance": "...", "newStance": "...", "whatChanged": "...", "whyLikely": "..."}`;

  const userMessage = `较早的想法 A：\n${fromContent}\n\n较近的想法 B：\n${toContent}`;
  try {
    const res = await llm.complete(systemPrompt, userMessage, { systemPromptVersion: 'evolution-v001' });
    const parsed = JSON.parse(res.content) as {
      oldStance?: string;
      newStance?: string;
      whatChanged?: string;
      whyLikely?: string;
    };
    return {
      oldStance: parsed.oldStance ?? fromContent,
      newStance: parsed.newStance ?? toContent,
      whatChanged: parsed.whatChanged ?? '立场发生了转移。',
      whyLikely: parsed.whyLikely ?? '基于两条 Thought 的内容变化。',
    };
  } catch {
    // LLM 失败或不可用时，退回内容直填（不阻断候选流程）。
    return {
      oldStance: fromContent,
      newStance: toContent,
      whatChanged: '立场发生了转移（未能生成语义摘要）。',
      whyLikely: '基于两条 Thought 的内容变化。',
    };
  }
}

function delta(a: number, b: number): number {
  return Math.round((b - a) * 100) / 100;
}

/**
 * 纯规则推导变化类型候选（不调 LLM）。
 * 基于两端 Thought 最新 Snapshot 四维差值 + content 长度变化。
 * 这是"候选标签"，最终含义由用户确认时赋予，不由本函数判定。
 */
export function deriveChangeType(
  from: ThoughtMaturitySnapshot | null,
  to: ThoughtMaturitySnapshot | null,
  fromThought: Thought,
  toThought: Thought
): ChangeType {
  const clarityDelta = delta(from?.clarity ?? 0, to?.clarity ?? 0);
  const stabilityDelta = delta(from?.stability ?? 0, to?.stability ?? 0);
  const recurrenceDelta = delta(from?.recurrence ?? 0, to?.recurrence ?? 0);
  const connectionDelta = delta(from?.connection ?? 0, to?.connection ?? 0);
  const contentLengthDelta = toThought.content.length - fromThought.content.length;

  // 规则优先级（仅候选，供用户判断，非权威结论）：
  // 先判 expansion：内容显著增长或连接度增多，表示思考向外扩展。
  if (contentLengthDelta > 40 || connectionDelta > 0.15) return 'expansion';
  if (from && to && clarityDelta > 0.15) return 'clarification'; // 变清晰（无显著扩展时）
  if (stabilityDelta < -0.15) return 'reconsideration'; // 稳定性下降=重新考虑
  if (connectionDelta < -0.1) return 'question_shift'; // 连接度下降=问题偏转
  if (recurrenceDelta > 0.1) return 'tension_added'; // 复现度升=张力浮现
  // 默认：若有任何可测变化则归 expansion，否则 clarification（最小假设）
  return contentLengthDelta !== 0 || clarityDelta !== 0 ||
    stabilityDelta !== 0 || connectionDelta !== 0 || recurrenceDelta !== 0
    ? 'expansion'
    : 'clarification';
}

/**
 * 提议演化（落库为 proposed 候选，不自动确认）。
 * 调 LLM 生成语义演化（oldStance/newStance/whatChanged/whyLikely），
 * LLM 不可用时回退到纯规则直填。绝不自动把 Evolution 写进 Thought。
 */
export async function proposeEvolution(
  repos: Repos,
  llm: LLMClient,
  fromThoughtId: string,
  toThoughtId: string,
  userId: string
): Promise<{ trace: EvolutionTrace; candidate: EvolutionCandidate }> {
  const fromThought = repos.thought.get(fromThoughtId);
  const toThought = repos.thought.get(toThoughtId);
  if (!fromThought || !toThought) {
    throw new Error('proposeEvolution: 两端 Thought 必须存在');
  }
  if (fromThoughtId === toThoughtId) {
    throw new Error('proposeEvolution: from 与 to 不能相同');
  }
  // 准入守卫：两端都必须是 confirmed Thought（Thought_Admission_Semantics v0.1）。
  if (!isAdmittedThought(fromThought)) {
    throw new Error('proposeEvolution: ' + admissionRejectionReason(fromThought));
  }
  if (!isAdmittedThought(toThought)) {
    throw new Error('proposeEvolution: ' + admissionRejectionReason(toThought));
  }

  const fromSnap = latestSnapshot(repos, fromThoughtId);
  const toSnap = latestSnapshot(repos, toThoughtId);
  const changeType = deriveChangeType(fromSnap, toSnap, fromThought, toThought);

  const evidence: string[] = [];
  if (fromSnap) evidence.push(fromSnap.id);
  if (toSnap) evidence.push(toSnap.id);

  // 语义演化：基于两条 Thought 内容生成，而非仅数值 delta。
  const semantic = await generateSemanticEvolution(llm, fromThought.content, toThought.content);

  const trace: EvolutionTrace = {
    id: createId(),
    user_id: userId,
    from_thought_id: fromThoughtId,
    to_thought_id: toThoughtId,
    change_type: changeType,
    old_stance: semantic.oldStance,
    new_stance: semantic.newStance,
    what_changed: semantic.whatChanged,
    why_likely: semantic.whyLikely,
    evidence,
    status: 'proposed',
    proposed_at: new Date().toISOString(),
  };

  const signal = {
    clarityDelta: delta(fromSnap?.clarity ?? 0, toSnap?.clarity ?? 0),
    stabilityDelta: delta(fromSnap?.stability ?? 0, toSnap?.stability ?? 0),
    recurrenceDelta: delta(fromSnap?.recurrence ?? 0, toSnap?.recurrence ?? 0),
    connectionDelta: delta(fromSnap?.connection ?? 0, toSnap?.connection ?? 0),
    contentLengthDelta: toThought.content.length - fromThought.content.length,
  };
  const candidate: EvolutionCandidate = {
    fromThoughtId,
    toThoughtId,
    changeType,
    evidence,
    signal,
    oldStance: semantic.oldStance,
    newStance: semantic.newStance,
    whatChanged: semantic.whatChanged,
    whyLikely: semantic.whyLikely,
    readableSignal: buildReadableSignal(signal),
  };

  // 落库为 proposed（候选状态，不构成认知事实；ADR-0029 Q4：纳入=confirmed）。
  repos.evolutionTrace.put(trace);

  return { trace, candidate };
}

/**
 * 用户确认演化候选 → 落库为 confirmed Trace。
 * 这是 EvolutionTrace 唯一进入长期存储的通道（ADR-0029 Q4：生成≠纳入）。
 */
export function confirmEvolution(repos: Repos, traceId: string): EvolutionTrace {
  const existing = repos.evolutionTrace.get(traceId);
  if (!existing) throw new Error('confirmEvolution: Trace 不存在');
  if (existing.status === 'confirmed') return existing; // 幂等
  const confirmed: EvolutionTrace = {
    ...existing,
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
  };
  repos.evolutionTrace.put(confirmed);
  return confirmed;
}

/** 用户否认候选 → 标记为 rejected（不形成 Trace）。 */
export function rejectEvolution(repos: Repos, traceId: string): EvolutionTrace {
  const existing = repos.evolutionTrace.get(traceId);
  if (!existing) throw new Error('rejectEvolution: Trace 不存在');
  const rejected: EvolutionTrace = { ...existing, status: 'rejected' };
  repos.evolutionTrace.put(rejected);
  return rejected;
}

/** 读取某 Thought 参与的所有已确认演化轨迹（作为连续性载体）。 */
export function getConfirmedEvolutionsForThought(
  repos: Repos,
  thoughtId: string
): EvolutionTrace[] {
  return repos.evolutionTrace
    .query({})
    .filter(
      (t: EvolutionTrace) =>
        t.status === 'confirmed' &&
        (t.from_thought_id === thoughtId || t.to_thought_id === thoughtId)
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step B：Evolution Pattern —— Confirmed Evolution Trace 的轻量聚合
//
// 纪律（用户硬性边界）：
//   - 不读取裸 Thought 推 Pattern（必须 Confirmed Evolution Trace → Pattern）
//   - 不从单条 Evolution 推 Pattern（minimum 3 条 confirmed trace，且涉及 ≥2 个不同 source）
//   - 不引入 Embedding/Ranking/Memory/Knowledge/Profile 系统
//   - Pattern 核心是"变化模式"（source → transformation），不是"主题词频"
//   - LLM 只负责把已存在的重复结构归纳成自然语言，不发现证据
//   - 所有 Pattern 必须可回溯 evidence_trace_ids → Evolution Trace → Thought
//   - 仅 confirmed Pattern 才能进入下一阶段 Portrait
// ─────────────────────────────────────────────────────────────────────────────

/** Pattern 聚合最低证据数（防止单条/两条 Evolution 误聚合）。 */
export const PATTERN_MIN_EVIDENCE = 3;
/** Pattern 最低不同 source Thought 数（防止同一段话拆多条 self-证）。 */
export const PATTERN_MIN_DISTINCT_SOURCES = 2;

/**
 * 确定性：从单条 Evolution Trace 提取核心概念（轻量分词 + 2字以上词）。
 * 不调 LLM，结果可复现。用于 core_concepts 与 transformation 归一化。
 */
function extractConcepts(text: string): Set<string> {
  return tokenize(text);
}

/**
 * 确定性：把一组 confirmed traces 聚合成 Pattern Candidate（不调 LLM）。
 * 返回所有满足最低证据门槛的候选组，每个候选已是完整结构（含 evidence_trace_ids）。
 *
 * 聚合策略（轻量、无聚类算法）：
 *   1. 以 transformation 方向归一化（取 new_stance 的核心概念集合，求交集最大的分组）
 *   2. 同一 transformation 组内，要求 evidence_count ≥ PATTERN_MIN_EVIDENCE
 *      且 distinct source Thought ≥ PATTERN_MIN_DISTINCT_SOURCES
 *   3. 不聚合仅共享普通高频词（如"我""认为"）的 traces
 */
export function aggregateEvolutionPatterns(
  repos: Repos,
  userId: string,
): Array<{
  core_concepts: string[];
  source_pattern: string[];
  transformation_pattern: string;
  evidence_trace_ids: string[];
  evidence_count: number;
  distinct_source_thoughts: number;
}> {
  const confirmed = repos.evolutionTrace
    .query({ user_id: userId, status: 'confirmed' })
    .filter((t: EvolutionTrace) => t.status === 'confirmed');

  if (confirmed.length < PATTERN_MIN_EVIDENCE) return [];

  // 以目标 Thought 的原始 content 概念集合做分组键（确定性，不依赖 LLM 生成的 new_stance 措辞）。
  // 纪律：聚合必须基于用户真实写下的 Thought，而非 AI 重写——避免 LLM 措辞漂移导致误聚合/漏聚合。
  const traceConcepts = confirmed.map((t) => {
    const toThought = repos.thought.get(t.to_thought_id);
    const text = toThought ? toThought.content : t.new_stance;
    return {
      trace: t,
      concepts: extractConcepts(text),
      sourceId: t.from_thought_id,
    };
  });

  // 两两计算概念重叠，构建 transformation 分组（贪心连通）
  const groups: Array<typeof traceConcepts> = [];
  const assigned = new Set<string>();

  for (const tc of traceConcepts) {
    if (assigned.has(tc.trace.id)) continue;
    const group = [tc];
    assigned.add(tc.trace.id);
    for (const other of traceConcepts) {
      if (assigned.has(other.trace.id)) continue;
      // 重叠概念数 ≥ 2 视为同一 transformation 方向（避免仅共享虚词被聚合）
      let overlap = 0;
      for (const c of tc.concepts) if (other.concepts.has(c)) overlap++;
      if (overlap >= 2) {
        group.push(other);
        assigned.add(other.trace.id);
      }
    }
    groups.push(group);
  }

  const result: Array<{
    core_concepts: string[];
    source_pattern: string[];
    transformation_pattern: string;
    evidence_trace_ids: string[];
    evidence_count: number;
    distinct_source_thoughts: number;
  }> = [];

  for (const group of groups) {
    const distinctSources = new Set(group.map((g) => g.sourceId)).size;
    if (group.length < PATTERN_MIN_EVIDENCE) continue;
    if (distinctSources < PATTERN_MIN_DISTINCT_SOURCES) continue;

    // transformation_pattern：组内 new_stance 共享的核心概念（交集）
    let shared = group[0]!.concepts;
    for (const g of group.slice(1)) {
      const next = new Set<string>();
      for (const c of shared) if (g.concepts.has(c)) next.add(c);
      shared = next;
    }
    const transformationConcepts = [...shared].filter((c) => c.length >= 2).slice(0, 5);
    if (transformationConcepts.length === 0) continue; // 无实质共享概念，不聚合

    const coreConcepts = [...new Set([...group.flatMap((g) => [...g.concepts])])]
      .filter((c) => c.length >= 2)
      .slice(0, 12);

    result.push({
      core_concepts: coreConcepts,
      source_pattern: group.map((g) => g.trace.old_stance).slice(0, 5),
      transformation_pattern: `→ ${transformationConcepts.join('、')}`,
      evidence_trace_ids: group.map((g) => g.trace.id),
      evidence_count: group.length,
      distinct_source_thoughts: distinctSources,
    });
  }

  return result;
}

/**
 * 提议 Evolution Pattern：确定性聚合 + LLM 归纳描述（LLM 只翻译，不发现证据）。
 * 落库为 candidate（不自动确认，不进入 Portrait）。
 */
export async function proposeEvolutionPattern(
  repos: Repos,
  llm: LLMClient,
  userId: string,
): Promise<Array<{ pattern: ReturnType<typeof aggregateEvolutionPatterns>[number]; record: EvolutionPattern }>> {
  const aggregates = aggregateEvolutionPatterns(repos, userId);
  const out: Array<{ pattern: any; record: EvolutionPattern }> = [];

  for (const agg of aggregates) {
    const now = new Date().toISOString();
    const record: EvolutionPattern = {
      id: createId(),
      user_id: userId,
      pattern: '', // 待 LLM 填充
      core_concepts: agg.core_concepts,
      source_pattern: agg.source_pattern,
      transformation_pattern: agg.transformation_pattern,
      evidence_trace_ids: agg.evidence_trace_ids,
      evidence_count: agg.evidence_count,
      status: 'candidate',
      proposed_at: now,
      created_at: now,
      updated_at: now,
    };

    // LLM 仅负责把已存在的重复结构归纳成自然语言。
    const systemPrompt = `你是 Thought OS 的 Pattern Synthesizer。下面是一组已被用户确认的 Thought Evolution Trace 的"变化模式"聚合结果。

# 硬性约束
- 你绝不人格诊断、绝不使用心理学术语或思想流派归类。
- 你只做"归纳描述"，不发现新证据——证据已由下面给出的 traces 提供。
- 描述必须聚焦"变化模式"（什么东西被怎样重新理解），而非主题词频统计。
- 用推测性、可被质疑的措辞（"反复出现""似乎"），不替用户下定论。
- 只输出一句话（不超过 60 字），不要任何前后缀或 JSON。

# 聚合数据
核心概念：${agg.core_concepts.join('、')}
转变方向：${agg.transformation_pattern}
证据数：${agg.evidence_count}
原始立场示例：${agg.source_pattern.slice(0, 3).join(' | ')}`;

    try {
      const res = await llm.complete(systemPrompt, '请归纳这个演化模式。', {
        systemPromptVersion: 'evolution-pattern-v001',
      });
      record.pattern = res.content.trim().slice(0, 200);
    } catch {
      // LLM 不可用时，用确定性结构兜底（证据链仍然完整，只是描述降级）
      record.pattern = `在 ${agg.evidence_count} 条已确认演化中，反复出现转变方向「${agg.transformation_pattern}」（核心概念：${agg.core_concepts.slice(0, 4).join('、')}）。`;
    }

    repos.evolutionPattern.put(record);
    out.push({ pattern: agg, record });
  }

  return out;
}

/** 用户确认 Pattern → confirmed（才进入 Portrait 证据）。 */
export function confirmEvolutionPattern(repos: Repos, patternId: string): EvolutionPattern {
  const existing = repos.evolutionPattern.get(patternId);
  if (!existing) throw new Error('confirmEvolutionPattern: Pattern 不存在');
  if (existing.status === 'confirmed') return existing; // 幂等
  const confirmed: EvolutionPattern = {
    ...existing,
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  repos.evolutionPattern.put(confirmed);
  return confirmed;
}

/** 用户质疑 Pattern → challenged（不进入 Portrait，触发重新评估）。 */
export function challengeEvolutionPattern(repos: Repos, patternId: string): EvolutionPattern {
  const existing = repos.evolutionPattern.get(patternId);
  if (!existing) throw new Error('challengeEvolutionPattern: Pattern 不存在');
  const challenged: EvolutionPattern = {
    ...existing,
    status: 'challenged',
    updated_at: new Date().toISOString(),
  };
  repos.evolutionPattern.put(challenged);
  return challenged;
}

/** 用户拒绝 Pattern（不进入 Portrait，标记为 rejected 等价语义用 challenged 区分，这里直接删除候选）。 */
export function rejectEvolutionPattern(repos: Repos, patternId: string): void {
  const existing = repos.evolutionPattern.get(patternId);
  if (!existing) throw new Error('rejectEvolutionPattern: Pattern 不存在');
  if (existing.status === 'confirmed') {
    throw new Error('rejectEvolutionPattern: confirmed Pattern 不能删除，只能 challenge');
  }
  repos.evolutionPattern.delete(patternId);
}

/** 读取所有 confirmed Pattern（Portrait 只消费这一层）。 */
export function getConfirmedPatterns(repos: Repos, userId: string): EvolutionPattern[] {
  return repos.evolutionPattern
    .query({ user_id: userId, status: 'confirmed' })
    .filter((p: EvolutionPattern) => p.status === 'confirmed');
}

/** 读取某条 confirmed Evolution Trace 支撑的所有 confirmed Pattern（provenance 回溯）。 */
export function getPatternsForTrace(repos: Repos, traceId: string): EvolutionPattern[] {
  return repos.evolutionPattern
    .query({})
    .filter(
      (p: EvolutionPattern) =>
        p.status === 'confirmed' && p.evidence_trace_ids.includes(traceId)
    );
}
