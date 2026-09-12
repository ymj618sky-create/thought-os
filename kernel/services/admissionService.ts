/**
 * Admission Service（提炼层准入语义 · Thought_Admission_Semantics v0.1）。
 *
 * 纪律（来自 spec + 用户拍板）：
 * - 本服务**不新增架构层**，只给现有 Thought 增加 admission 状态 + 证据结构。
 * - 信号探测**复用现有能力**：recurrence（归一化内容聚类）/ conflict（Relation challenges|contradicts）
 *   / revision（Thought.superseded_by 或 status=superseded）。不重新造检测系统。
 * - signal ≠ admission：信号只决定 candidate eligibility，绝不自动 confirmed。
 * - 系统可提名 candidate；confirmed 只能由用户显式确认动作产生。绝不自动确认。
 * - 不删除、不自动沉底、不自动归档素材。
 */
import type { Repos } from '../ports/repositories';
import type { Thought } from '../domain';

export type AdmissionSignal = 'recurrence' | 'conflict' | 'revision';

export interface AdmissionState {
  signals: AdmissionSignal[];
  thesis: string;
  premises: string[];
  fails_when: string;
  status: 'candidate' | 'confirmed';
  confirmed_at: string | null;
}

function norm(s: string): string {
  return s.trim().replace(/\s+/g, '').toLowerCase();
}

/**
 * 探测单个 Thought 的准入信号（复用现有数据，纯规则，无 LLM）。
 * 返回去重后的信号数组；空数组表示尚未达到候选资格。
 */
export function detectSignals(repos: Repos, thought: Thought): AdmissionSignal[] {
  const signals = new Set<AdmissionSignal>();

  // 1) recurrence：同 user 下归一化内容聚类 ≥2 条（含自身则 >1）。
  const siblings = repos.thought
    .query({ user_id: thought.user_id })
    .filter((t) => t.id !== thought.id)
    .filter((t) => t.status !== 'superseded' && t.status !== 'archived')
    .filter((t) => norm(t.content) === norm(thought.content) && norm(thought.content) !== '');
  if (siblings.length >= 1) signals.add('recurrence');

  // 2) conflict：该 Thought 作为被挑战方（to_id）出现在 challenges/contradicts Relation。
  //    按 Relation schema，challenges 的 to_type 必为 thought，contradicts 同理，故以 to_id 命中。
  const rels = repos.relation.query({});
  const hasConflict = rels.some(
    (r) =>
      (r.relation_type === 'challenges' || r.relation_type === 'contradicts') &&
      r.to_id === thought.id,
  );
  if (hasConflict) signals.add('conflict');

  // 3) revision：该 Thought 被 superseded（已推翻/修正过去判断）。
  if (thought.status === 'superseded' || thought.superseded_by) {
    signals.add('revision');
  }

  return [...signals];
}

/**
 * 把 Thought 推进到 candidate（若存在信号）。
 * 不覆盖已有的 confirmed（confirmed 不可逆降为 candidate）。
 * thesis/premises/fails_when 若未提供则从 Thought 现有字段继承（thesis 优先用 Thought.thesis）。
 * 返回更新后的 Thought；若无可探测信号且当前无 admission，则保持原样（纯素材）。
 */
export function promoteToCandidate(
  repos: Repos,
  thoughtId: string,
  input?: { thesis?: string; premises?: string[]; fails_when?: string },
): Thought {
  const thought = repos.thought.get(thoughtId);
  if (!thought) throw new Error('promoteToCandidate: Thought 不存在');
  if (thought.admission?.status === 'confirmed') return thought; // 不降级

  const signals = detectSignals(repos, thought);
  if (signals.length === 0 && !thought.admission) {
    // 尚未达到候选资格，保持纯素材。
    return thought;
  }

  const prior = thought.admission;
  const admission: AdmissionState = {
    signals: prior?.signals?.length ? prior.signals : signals,
    thesis: input?.thesis ?? prior?.thesis ?? thought.thesis ?? '',
    premises: input?.premises ?? prior?.premises ?? thought.premises ?? [],
    fails_when: input?.fails_when ?? prior?.fails_when ?? '',
    status: 'candidate',
    confirmed_at: null,
  };
  return repos.thought.update(thoughtId, { admission });
}

/**
 * 用户确认承担 → confirmed。
 * 严格要求结构完备（thesis/premises/fails_when 非空），否则拒绝。
 * 这是唯一能把 Thought 送进思想空间的通道。
 */
export function confirmAdmission(
  repos: Repos,
  thoughtId: string,
  input?: { thesis?: string; premises?: string[]; fails_when?: string },
): Thought {
  const thought = repos.thought.get(thoughtId);
  if (!thought) throw new Error('confirmAdmission: Thought 不存在');

  const thesis = input?.thesis ?? thought.admission?.thesis ?? thought.thesis ?? '';
  const premises = input?.premises ?? thought.admission?.premises ?? thought.premises ?? [];
  const fails_when = input?.fails_when ?? thought.admission?.fails_when ?? '';

  if (!thesis.trim()) throw new Error('confirmAdmission: thesis 为空，不能 confirmed');
  if (!premises.length || premises.some((p) => !p.trim())) {
    throw new Error('confirmAdmission: premises 为空或不完备，不能 confirmed');
  }
  if (!fails_when.trim()) throw new Error('confirmAdmission: fails_when 为空，不能 confirmed');

  const signals = thought.admission?.signals?.length
    ? thought.admission.signals
    : detectSignals(repos, thought);
  if (signals.length === 0) {
    throw new Error('confirmAdmission: 无任何准入信号，不能 confirmed');
  }

  const admission: AdmissionState = {
    signals,
    thesis,
    premises,
    fails_when,
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
  };
  return repos.thought.update(thoughtId, { admission });
}

/** 查询分流辅助：按 admission 状态归类（前端 Inbox 三区分区用）。 */
export function classifyThought(t: Thought): 'material' | 'candidate' | 'confirmed' {
  if (t.admission?.status === 'confirmed') return 'confirmed';
  if (t.admission && t.admission.status === 'candidate') return 'candidate';
  return 'material';
}
