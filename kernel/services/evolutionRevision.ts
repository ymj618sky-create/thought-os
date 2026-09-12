/**
 * Evolution Revision（修正回流 · Thought_Admission_Semantics v0.1 延伸）。
 *
 * 设计红线（来自用户拍板 2026-08-25）：
 * - Evolution 只能"提出修正候选"，绝不替用户决定"新 Thought 就是真的"。
 * - proposeRevision 产出的是一个 admission.status='candidate' + signal='revision'
 *   的 Thought，而非 raw、更非 confirmed（E2：revision candidate，不直接 confirmed）。
 * - 真正的 confirmed 只能由用户显式 confirmAdmission 产生（E3）。
 * - 用户裁决后才写回连续性：原 Thought.superseded_by + Relation
 *   （refines/contradicts/supports，复用已有字段，**不新建 Evolution graph**，E4）。
 * - 本服务不新增任何架构层，只是把现有 admission + superseded_by + Relation 串成闭环。
 * - 不调用 LLM（纯规则），content 由用户提供或由冲突上下文直填；自然语言叙述留给未来阶段。
 */
import type { Repos } from '../ports/repositories';
import type { Thought, Relation } from '../domain';
import type { LLMClient } from '../llm/LLMClient';
import { createId } from '../utils/id';
import { detectSignals, confirmAdmission } from './admissionService';

export type RevisionDecision = 'revise' | 'reject' | 'keep';

export interface RevisionProposal {
  newThoughtId: string;
  originalThoughtId: string;
  /** 候选态（candidate），需用户确认才 confirmed。 */
  status: 'candidate';
}

/**
 * 提出修正候选：基于一个"被发现冲突/需要修正"的原 Thought，
 * 创建一个待用户裁决的 candidate Thought（带 revision 信号）。
 * 不自动 confirmed，不改动原 Thought。
 */
export function proposeRevision(
  repos: Repos,
  _llm: LLMClient,
  originalThoughtId: string,
  userId: string,
  content: string,
): RevisionProposal {
  const original = repos.thought.get(originalThoughtId);
  if (!original) throw new Error('proposeRevision: 原 Thought 不存在');
  if (!original.admission || original.admission.status !== 'confirmed') {
    throw new Error('proposeRevision: 原 Thought 必须是 confirmed 才能提出修正（保持认知权威边界）');
  }
  if (!content || !content.trim()) {
    throw new Error('proposeRevision: 修正内容不能为空（用户必须自己写下新判断）');
  }

  const now = new Date().toISOString();
  const newId = createId();
  const candidate: Thought = {
    id: newId,
    user_id: userId,
    content: content.trim(),
    lattice_level: original.lattice_level,
    protocol: original.protocol ?? null,
    status: 'active',
    version: 1,
    superseded_by: null,
    evidence_ids: [],
    origin_type: 'user_authored',
    confirmed_at: now,
    created_at: now,
    updated_at: now,
    space_id: original.space_id ?? null,
    // 系统提名 candidate（signal=revision），绝不 confirmed。
    admission: {
      signals: ['revision'],
      thesis: '',
      premises: [],
      fails_when: '',
      status: 'candidate',
      confirmed_at: null,
    },
  };
  repos.thought.put(candidate);

  return { newThoughtId: newId, originalThoughtId, status: 'candidate' };
}

/**
 * 用户裁决修正候选：先确认 candidate → confirmed（E3），再写回连续性（E4）。
 * decision 决定原 Thought 与新 Thought 的关系语义：
 *  - revise：原被新修正 → 原.superseded_by=新；Relation(新→原, refines)
 *  - reject：否定原 Thought → 原.superseded_by=新；Relation(新→原, contradicts)
 *  - keep：保留两者，原不标记 superseded；Relation(新→原, supports)
 * 全部复用已有 superseded_by + Relation 字段，不新建任何结构实体。
 */
export function applyRevisionDecision(
  repos: Repos,
  newThoughtId: string,
  originalThoughtId: string,
  decision: RevisionDecision,
  admissionInput?: { thesis?: string; premises?: string[]; fails_when?: string },
): { newThought: Thought; originalThought: Thought; relation: Relation } {
  const newThought = repos.thought.get(newThoughtId);
  const original = repos.thought.get(originalThoughtId);
  if (!newThought || !original) throw new Error('applyRevisionDecision: Thought 不存在');
  // 新 Thought 应已处于"待裁决"状态：candidate（用户尚未 confirm）或 confirmed（用户已 confirm 后裁决）。
  // 不允许对 raw 素材直接裁决——那意味着 Evolution 自动确认了，违反核心边界。
  const st = newThought.admission?.status;
  if (st !== 'candidate' && st !== 'confirmed') {
    throw new Error('applyRevisionDecision: 新 Thought 必须是 candidate 或 confirmed（不能对 raw 素材直接裁决）');
  }

  // E3：用户确认承担 → confirmed（要求结构完备，否则 confirmAdmission 抛错）。
  // 幂等：若已被用户确认过（已是 confirmed），不再重复 confirm。
  const confirmed =
    newThought.admission?.status === 'confirmed'
      ? newThought
      : confirmAdmission(repos, newThoughtId, admissionInput);

  let relationType: 'refines' | 'contradicts' | 'supports';
  if (decision === 'revise') relationType = 'refines';
  else if (decision === 'reject') relationType = 'contradicts';
  else relationType = 'supports';

  // E4：连续性写回。
  if (decision === 'revise' || decision === 'reject') {
    repos.thought.update(originalThoughtId, { superseded_by: newThoughtId, status: 'superseded' });
  }

  const relation: Relation = {
    id: createId(),
    user_id: original.user_id,
    from_id: newThoughtId,
    from_type: 'thought',
    to_id: originalThoughtId,
    to_type: 'thought',
    relation_type: relationType,
    origin_type: 'user_authored',
    status: 'confirmed',
    created_at: new Date().toISOString(),
    confirmed_at: new Date().toISOString(),
  };
  repos.relation.put(relation);

  const updatedOriginal = repos.thought.get(originalThoughtId)!;
  return { newThought: confirmed, originalThought: updatedOriginal, relation };
}

/** 复用 admission 信号探测（供路由层 detect 展示 revision 候选 eligibility）。 */
export function revisionSignalsFor(repos: Repos, thought: Thought) {
  return detectSignals(repos, thought);
}
