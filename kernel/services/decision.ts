/**
 * DecisionService —— ADR-0020 P2（Decision）。
 *
 * 完整链路：
 *   问题 → 选项 → 假设 → Evidence → 反方证据 → 结果预期 → **用户决定** → Review
 *
 * ## 宪法边界（本服务最重要的部分）
 *
 * > **Thought OS 不替用户决定。**
 *
 * 系统帮助用户：定义问题、找证据、找隐含假设、找反例、比较方案、暴露不确定性、
 * 预测结果、记录决定。**最后一步只能由人做。**
 *
 * 落地为三条硬约束：
 *   1. `decision` / `rationale` / `decided_at` 只能经 `decide()` 写入，且该方法只接受用户传入的值；
 *   2. 没有"系统建议的最终决定"这种 API——建议只能落在 `options`（标 `proposed_by='mirror'`）、
 *      `assumptions`、`risks`、`counter_evidence`；
 *   3. `status='decided'` 但 `decision` 为空时，schema 直接拒绝（见 Decision.schema.json 的 allOf）。
 *
 * ## V0 的诚实边界
 *
 * `suggestRelated()` 只做**词面匹配**召回相关 Thought/Evidence，不宣称"这些证据支持/反对哪个选项"。
 * 语义级比较（找隐含假设、找反例）属于 L4 Challenge，需要 LLM 且必须用户显式发起，
 * 不在 V0 假装能做。
 */
import { createId } from '../utils/id';
import type { Repos } from '../ports/repositories';
import type { Decision, Evidence, Thought } from '../domain';
import type { Logger } from '../ports/logger';
import { extractTerms, matchTerms } from '../util/terms';
import { summarizeAtSentence } from '../util/summarize';

/** 与问题相关的既有判断（词面召回，非语义判定）。 */
export interface SuggestedThought {
  id: string;
  thesis: string;
  matched: string[];
  /** 最近一次被现实检验的时间；null = 从未检验。 */
  lastTested: string | null;
  untested: boolean;
}

/** 与问题相关的既有证据。 */
export interface SuggestedEvidence {
  id: string;
  preview: string;
  origin: 'self' | 'world' | 'action';
  /**
   * 谁说/提出了这条 Evidence——透传 Evidence.speaker，不在此重新定义来源语义。
   * Kernel 约定：Mirror 回复落成 Evidence 时置 'mirror'；既有记录无此字段视为 'user'。
   * UI 必须据此标注：把 Mirror 说的话标成「你自己」是数据语义错误，
   * 会破坏刚建立起来的来源透明性。
   */
  speaker: 'user' | 'mirror';
  matched: string[];
}

export interface DecisionSuggestions {
  thoughts: SuggestedThought[];
  evidence: SuggestedEvidence[];
}

/** 用户做出决定时传入的内容。**不含任何系统推断**。 */
export interface DecidePayload {
  decision: string;
  rationale?: string | null;
  decided_option_id?: string | null;
  review_date?: string | null;
}

export class DecisionService {
  /** 持有 repos 工厂而非快照：容器解锁切库后仍读到当前库。 */
  constructor(
    private readonly getRepos: () => Repos,
    private readonly logger?: Logger,
  ) {}

  /** 起草一个决策（status=drafting）。 */
  create(problem: string, userId: string, opts: { spaceId?: string | null } = {}): Decision {
    const now = new Date().toISOString();
    const decision: Decision = {
      id: createId(),
      user_id: userId,
      problem,
      status: 'drafting',
      options: [],
      assumptions: [],
      evidence_ids: [],
      thought_ids: [],
      expected_outcomes: [],
      risks: [],
      counter_evidence: [],
      ...(opts.spaceId ? { space_id: opts.spaceId } : { space_id: null }),
      created_at: now,
      updated_at: now,
    };
    this.getRepos().decision.put(decision);
    this.logger?.log({
      service: 'decision',
      operation: 'create',
      outcome: 'ok',
      user_id: userId,
      decision_id: decision.id,
    });
    return decision;
  }

  get(id: string): Decision | null {
    return this.getRepos().decision.get(id);
  }

  list(
    userId: string,
    opts: { status?: Decision['status']; spaceId?: string | null } = {},
  ): Decision[] {
    let rows = this.getRepos().decision.query({ user_id: userId });
    if (opts.status) rows = rows.filter((d) => d.status === opts.status);
    if (opts.spaceId) rows = rows.filter((d) => (d.space_id ?? null) === opts.spaceId);
    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  /**
   * 更新起草中的内容。**已决定的决策不可再改问题/选项等实质内容**
   * （改了就不是同一个决策了，应新建）。
   */
  updateDraft(
    id: string,
    patch: Partial<
      Pick<
        Decision,
        | 'problem'
        | 'options'
        | 'assumptions'
        | 'evidence_ids'
        | 'thought_ids'
        | 'expected_outcomes'
        | 'risks'
        | 'counter_evidence'
        | 'review_date'
        | 'space_id'
      >
    >,
  ): Decision {
    const repos = this.getRepos();
    const current = repos.decision.get(id);
    if (!current) throw new Error(`Decision ${id} 不存在`);
    if (current.status !== 'drafting') {
      throw new Error(`只有起草中的决策可以修改（当前 status=${current.status}）`);
    }
    return repos.decision.update(id, { ...patch, updated_at: new Date().toISOString() });
  }

  /**
   * **用户做出决定。**这是本服务唯一能写入 decision/decided_at 的入口。
   *
   * 同时把决策 id 回写到相关 Thought 的 `decisions_influenced`，
   * 使「过去的判断 → 当下的决策」首次可追溯（ADR-0020 §6.2）。
   */
  decide(id: string, payload: DecidePayload): Decision {
    const repos = this.getRepos();
    const current = repos.decision.get(id);
    if (!current) throw new Error(`Decision ${id} 不存在`);

    const decisionText = payload.decision?.trim();
    if (!decisionText) {
      // 明确失败而非静默：系统不得在用户没决定的情况下标记为已决定。
      throw new Error('decision 不能为空——决定必须由用户做出');
    }

    const now = new Date().toISOString();
    const updated = repos.decision.decide(id, {
      status: 'decided',
      decision: decisionText,
      ...(payload.rationale !== undefined ? { rationale: payload.rationale } : {}),
      ...(payload.decided_option_id !== undefined
        ? { decided_option_id: payload.decided_option_id }
        : {}),
      ...(payload.review_date !== undefined ? { review_date: payload.review_date } : {}),
      decided_at: now,
      updated_at: now,
    });

    // 反向索引：让被这条决策影响的 Thought 知道它参与了决策
    for (const thoughtId of current.thought_ids ?? []) {
      const t = repos.thought.get(thoughtId);
      if (!t) continue;
      const influenced = t.decisions_influenced ?? [];
      if (influenced.includes(id)) continue;
      repos.thought.update(thoughtId, { decisions_influenced: [...influenced, id] });
    }

    this.logger?.log({
      service: 'decision',
      operation: 'decide',
      outcome: 'ok',
      user_id: current.user_id,
      decision_id: id,
      influenced_thoughts: (current.thought_ids ?? []).length,
    });
    return updated;
  }

  /** 标记已回顾（结果对照后）。仅已决定的决策可标记。 */
  markReviewed(id: string): Decision {
    const repos = this.getRepos();
    const current = repos.decision.get(id);
    if (!current) throw new Error(`Decision ${id} 不存在`);
    if (current.status !== 'decided') {
      throw new Error(`只有已决定的决策可以标记回顾（当前 status=${current.status}）`);
    }
    return repos.decision.update(id, {
      status: 'reviewed',
      updated_at: new Date().toISOString(),
    });
  }

  /** review_date 已到期的已决定决策——Notice「decision worth revisiting」的候选来源。 */
  dueForReview(userId: string, now: Date = new Date()): Decision[] {
    const iso = now.toISOString();
    return this.getRepos()
      .decision.query({ user_id: userId })
      .filter((d) => d.status === 'decided' && !!d.review_date && d.review_date <= iso)
      .sort((a, b) => (a.review_date ?? '').localeCompare(b.review_date ?? ''));
  }

  /**
   * 词面召回与问题相关的既有判断与证据。
   *
   * **不判断**这些材料支持还是反对某个选项——那需要语义理解，
   * 交给用户在 Decide 界面里自己看。这里只负责把可能相关的材料找出来。
   */
  suggestRelated(problem: string, userId: string, limit = 5): DecisionSuggestions {
    const repos = this.getRepos();
    const terms = extractTerms(problem);
    if (terms.length === 0) return { thoughts: [], evidence: [] };

    const thoughts: SuggestedThought[] = [];
    for (const t of repos.thought.query({ user_id: userId })) {
      if (t.status !== 'active') continue;
      const matched = matchTerms(`${t.thesis ?? ''} ${t.content}`, terms);
      if (matched.length === 0) continue;
      thoughts.push({
        id: t.id,
        thesis: t.thesis ?? summarizeAtSentence(t.content, 120),
        matched: matched.slice(0, 8),
        lastTested: t.last_tested ?? null,
        untested: !t.last_tested,
      });
    }
    thoughts.sort((a, b) => b.matched.length - a.matched.length);

    const evidence: SuggestedEvidence[] = [];
    for (const e of repos.evidence.query({ user_id: userId })) {
      const matched = matchTerms(e.raw_content, terms);
      if (matched.length === 0) continue;
      evidence.push({
        id: e.id,
        preview: summarizeAtSentence(e.raw_content, 120),
        origin: e.origin ?? 'self',
        // 透传 Kernel 已有的 speaker（既有记录无此字段时按 Kernel 约定视为 'user'）。
        speaker: e.speaker ?? 'user',
        matched: matched.slice(0, 8),
      });
    }
    evidence.sort((a, b) => b.matched.length - a.matched.length);

    return { thoughts: thoughts.slice(0, limit), evidence: evidence.slice(0, limit) };
  }
}

/** 便于 UI 判断：一条决策是否已到回顾期。 */
export function isDueForReview(d: Decision, now: Date = new Date()): boolean {
  return d.status === 'decided' && !!d.review_date && d.review_date <= now.toISOString();
}

/** 类型再导出，便于路由层引用而不必直接 import schema。 */
export type { Decision, Evidence, Thought };
