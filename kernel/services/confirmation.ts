/**
 * 确认服务 —— Confirmation_Protocol + 张力生命周期的核心编排（设计 §6.4）。
 *
 * 覆盖四类候选：Observation / Interpretation / Relation / Question。
 * 本服务是唯一负责"创建 Thought"的地方（Confirmation_Protocol 范围声明）。
 *
 * 关键不变量：
 * - 沉默不构成同意：任何候选不因超时自动流转（S-2.2），本服务只响应显式动作。
 * - 张力升级禁止原地改 relation_type（ADR-0001 第③步）：确认并存为 Thought 时
 *   新建独立 contradicts，原 challenges 标记 superseded 并指向新记录。
 * - confirmed 的矛盾不改变两端 Thought 状态（S-8.2 / ADR-0006）。
 * - 所有 Relation 写入与反向索引同步在同一事务内（ADR-0005）。
 *
 * 实现层面的两个显式决策（规范未覆盖，故在此声明而非悄悄拍板）：
 * 1. deriveThought 的"转写为陈述句"与 lattice_level 由调用方提供——转写结果需用户
 *    最终确认（协议 Step 1），而 12 晶格坐标是 Thought 的必填定位，Phase 1 无 UI，
 *    由 CLI 调用者显式传入；服务不替用户猜坐标。
 * 2. "编辑后确认"的措辞调整 vs 实质改写由调用方声明（edit.kind）——区二者是语义判断，
 *    Phase 1 不引入额外模型调用替用户做这个决定。
 */
import { createId } from '../utils/id';
import type { CognitivePersistencePort as Storage, Tx } from '../ports/persistence/port';
import type { Repos, ReposFactory } from '../ports/repositories';
import type {
  Interpretation,
  Observation,
  Question,
  Relation,
  Thought,
} from '../domain';
import type { Logger } from '../ports/logger';
import { ConstraintViolationError } from '../errors';
import type { EvidenceLinkingService } from './evidenceLinking';
import type { ThoughtIndexRebuilder } from '../ports/index-rebuilder';
import type { ProjectionDeriver } from '../ports/projection-deriver';

export type InterpretationDecision = 'store' | 'skip' | 'reject';

export interface ConfirmInterpretationOptions {
  /** 用户最终确认的陈述句文本（store 必填；wording 编辑时以 edit.content 代替）。 */
  thoughtContent?: string;
  /** 主坐标 1-12（store 与实质改写必填；Phase 1 由调用方提供）。 */
  latticeLevel?: number;
  /** 次坐标（可选，不得包含主坐标——由 constraints 强制）。 */
  latticeLevelsSecondary?: number[];
  /** 触发确认时生效的 Cognitive Protocol id（二维坐标的 How 轴，透传给 Thought）。 */
  protocol?: string | null;
  /** 编辑后确认：wording=仅措辞调整（视为确认）；substantive=实质改写（原条驳回+新建 user_authored Thought）。 */
  edit?: { content: string; kind: 'wording' | 'substantive' };
  /** 驳回时用户的真实说法（"不是这样，其实是…"），将作为新 Evidence 留存。 */
  rebuttal?: string;
  /** 重构：用户认领时填写的核心主张（一句话）。空则落库时留 null，前端回退 content 摘要。 */
  thesis?: string | null;
  /** 重构：支撑这条思想的理由（用户认可的前提）。 */
  premises?: string[];
  /** 重构：这条思想回应/化解的张力（id 或文本）。 */
  tension_ref?: string | null;
  /** 触发确认时所在的对话空间 id；用于兜底补全 Thought.space_id
   *  （当 Interpretation 自身 space_id 缺失时，确保 Thought 归属于当前空间，
   *  否则 /api/reflection?space= 与空间内记录展示会因 space_id 为空而统计为 0）。 */
  spaceId?: string | null;
}

export interface DeriveThoughtOptions {
  /** 陈述句文本（用户已最终确认的转写结果）。 */
  content: string;
  latticeLevel: number;
  latticeLevelsSecondary?: number[];
  /** 触发派生时生效的 Cognitive Protocol id（二维坐标的 How 轴）。 */
  protocol?: string | null;
  /** 重构：核心主张（一句话）。 */
  thesis?: string | null;
  /** 重构：支撑理由。 */
  premises?: string[];
  /** 重构：回应的张力。 */
  tension_ref?: string | null;
  /** 触发确认时所在的对话空间 id；用于兜底补全 Thought.space_id。 */
  spaceId?: string | null;
}

export interface ConfirmInterpretationResult {
  interpretation: Interpretation;
  thought?: Thought;
}

export class ConfirmationService {
  constructor(
    private readonly storage: Storage,
    private readonly reposFactory: ReposFactory,
    private readonly linking: EvidenceLinkingService,
    private readonly indexRebuilder: ThoughtIndexRebuilder,
    private readonly projectionDeriver: ProjectionDeriver,
    private readonly logger: Logger
  ) {}

  // ---------- Observation ----------

  /** 驳回 Observation：active → dismissed。忽略则保持 active，无需调用本方法。 */
  dismissObservation(id: string): Observation {
    return this.storage.transaction((tx) => {
      const repos = this.reposFactory(tx);
      const obs = repos.observation.get(id);
      if (!obs) throw new ConstraintViolationError('Observation 不存在', id);
      if (obs.status !== 'active') {
        throw new ConstraintViolationError(`Observation 当前状态 ${obs.status}，无法驳回`, id);
      }
      const next = repos.observation.update(id, {
        status: 'dismissed',
        dismissed_at: new Date().toISOString(),
      });
      this.logger.log({
        service: 'confirmation',
        operation: 'dismiss_observation',
        user_id: obs.user_id,
        outcome: 'ok',
        observation_id: id,
      });
      return next;
    });
  }

  // ---------- Interpretation ----------

  /**
   * Interpretation 三选项（等权，Article 6）：
   * - store：认同并存起来 → confirmed + 派生 Thought + 张力升级。
   * - skip：认同但先不存 → confirmed，不派生 Thought；其 challenges 关系 → confirmed。
   * - reject：不是这样 → rejected；其 challenges 关系同步 rejected（留痕，不物理删除）。
   */
  confirmInterpretation(
    id: string,
    decision: InterpretationDecision,
    opts: ConfirmInterpretationOptions = {}
  ): ConfirmInterpretationResult {
    // 实质改写走独立路径：原条驳回 + 新内容作 user_authored Thought（防溯源造假）。
    if (opts.edit?.kind === 'substantive') {
      return this.applySubstantiveEdit(id, opts);
    }

    return this.storage.transaction((tx) => {
      const repos = this.reposFactory(tx);
      const interp = this.loadPendingInterpretation(repos, id);
      const now = new Date().toISOString();

      if (decision === 'reject') {
        const rejected = repos.interpretation.update(id, { status: 'rejected' });
        this.syncChallengesOnInterpretationRejected(tx, interp);
        if (opts.rebuttal) {
          // 用户的真实说法是新的原始表达，入 Evidence（可被后续提取使用）。
          this.linking.locateOrCreate(opts.rebuttal, 'chat_message', interp.user_id);
        }
        this.logger.log({
          service: 'confirmation',
          operation: 'reject_interpretation',
          user_id: interp.user_id,
          outcome: 'ok',
          interpretation_id: id,
        });
        return { interpretation: rejected };
      }

      // store / skip：confirmed_at 记录用户动作时间（S-2.2：确认是用户的动作，不是 AI 的生成）。
      const confirmed = repos.interpretation.update(id, {
        status: 'confirmed',
        confirmed_at: now,
      });

      if (decision === 'skip') {
        // 确认但不存：challenges → confirmed（一等长期信号，batch002-004）。
        this.syncChallengesOnInterpretationConfirmedNoStore(tx, interp, now);
        this.logger.log({
          service: 'confirmation',
          operation: 'confirm_interpretation_skip',
          user_id: interp.user_id,
          outcome: 'ok',
          interpretation_id: id,
        });
        return { interpretation: confirmed };
      }

      // store：派生 Thought（同事务），张力升级在 deriveThought 内完成。
      const thoughtContent = opts.edit?.kind === 'wording' ? opts.edit.content : opts.thoughtContent;
      const thought = this.deriveThoughtInTx(tx, interp, {
        content: this.require(thoughtContent, 'store 决策需要 thoughtContent（用户确认的陈述句）', id),
        latticeLevel: this.require(opts.latticeLevel, 'store 决策需要 latticeLevel（1-12 主坐标）', id),
        latticeLevelsSecondary: opts.latticeLevelsSecondary,
        protocol: opts.protocol ?? null,
      });
      this.logger.log({
        service: 'confirmation',
        operation: 'confirm_interpretation_store',
        user_id: interp.user_id,
        outcome: 'ok',
        interpretation_id: id,
        thought_id: thought.id,
      });
      return { interpretation: confirmed, thought };
    });
  }

  /**
   * 独立动作：从已 confirmed 的 Interpretation 派生 Thought
   * （对应协议"独立步骤"——用户在 'skip' 之后改主意要存，走这里）。
   */
  deriveThought(interpretationId: string, opts: DeriveThoughtOptions): Thought {
    return this.storage.transaction((tx) => {
      const repos = this.reposFactory(tx);
      const interp = repos.interpretation.get(interpretationId);
      if (!interp) throw new ConstraintViolationError('Interpretation 不存在', interpretationId);
      if (interp.status !== 'confirmed') {
        throw new ConstraintViolationError(
          `仅 status=confirmed 的 Interpretation 可派生 Thought（当前 ${interp.status}）`,
          interpretationId
        );
      }
      const thought = this.deriveThoughtInTx(tx, interp, opts);
      this.logger.log({
        service: 'confirmation',
        operation: 'derive_thought',
        user_id: interp.user_id,
        outcome: 'ok',
        interpretation_id: interpretationId,
        thought_id: thought.id,
      });
      return thought;
    });
  }

  // ---------- Relation ----------

  /** 确认 Relation：status → confirmed。不改变两端节点状态（S-8.2 矛盾共存）。 */
  confirmRelation(id: string): Relation {
    return this.transitionRelation(id, 'confirmed');
  }

  /** 驳回 Relation：status → rejected（留痕，不物理删除）。 */
  rejectRelation(id: string): Relation {
    return this.transitionRelation(id, 'rejected');
  }

  // ---------- Question ----------

  /** 确认 AI 建议的 Question：pending → open。 */
  confirmQuestion(id: string): Question {
    return this.transitionQuestion(id, 'open');
  }

  /** 驳回 AI 建议的 Question：pending → archived（复用 archived，不新增 rejected 值）。 */
  rejectQuestion(id: string): Question {
    return this.transitionQuestion(id, 'archived');
  }

  // ---------- 内部实现 ----------

  private loadPendingInterpretation(
    repos: Repos,
    id: string
  ): Interpretation {
    const interp = repos.interpretation.get(id);
    if (!interp) throw new ConstraintViolationError('Interpretation 不存在', id);
    if (interp.status !== 'pending') {
      throw new ConstraintViolationError(
        `仅 status=pending 的 Interpretation 可执行确认/驳回（当前 ${interp.status}）`,
        id
      );
    }
    return interp;
  }

  /**
   * deriveThought 核心（必须在事务内调用）：
   * 1. evidence_ids 继承 I；为空则回退到其 Observation 的 evidence（Evidence_Linking 协议），仍为空则失败。
   * 2. 建 Thought（origin_type=derived_from_interpretation，confirmed_at=用户动作时间）。
   * 3. 张力升级（ADR-0001 第③步）：新建独立 contradicts（status=confirmed），
   *    原 challenges 标 superseded 并 superseded_by 指向新记录——禁止原地改 relation_type。
   */
  private deriveThoughtInTx(
    tx: Tx,
    interp: Interpretation,
    opts: DeriveThoughtOptions
  ): Thought {
    const repos = this.reposFactory(tx);
    const now = new Date().toISOString();

    const evidenceIds = this.resolveThoughtEvidence(tx, interp);
    this.linking.attach('thought', evidenceIds);

    // Runtime v2.0：由 Interpretation + 其 Observations 计算多坐标投影。
    const obsPatternTypes = interp.observation_ids
      .map((oid) => repos.observation.get(oid)?.pattern_type)
      .filter((pt): pt is NonNullable<typeof pt> => !!pt)
      .map((pt) => ({ pattern_type: pt }));
    const projection = this.projectionDeriver.derive(
    { content: interp.content, tension: interp.tension, confidence: interp.confidence },
    obsPatternTypes,
    opts.latticeLevel
    );

    const thought: Thought = {
      id: createId(),
      user_id: interp.user_id,
      content: opts.content,
      ...(opts.thesis !== undefined ? { thesis: opts.thesis } : {}),
      ...(opts.premises ? { premises: opts.premises } : {}),
      ...(opts.tension_ref !== undefined ? { tension_ref: opts.tension_ref } : {}),
      lattice_level: opts.latticeLevel,
      status: 'active',
      version: 1,
      evidence_ids: evidenceIds,
      origin_type: 'derived_from_interpretation',
      origin_interpretation_id: interp.id,
      confirmed_at: now,
      created_at: now,
      updated_at: now,
      protocol: opts.protocol ?? null,
      projection,
      tension: projection.tension ?? null,
      // 继承 Interpretation 的空间归属（跨字段约束：Thought 必须可溯源到空间）。
      // 兜底：若 Interpretation 未携带 space_id，则使用确认动作传入的当前对话空间 id，
      // 避免 Thought.space_id 为空导致空间内记录/收获统计为 0。
      ...(interp.space_id || opts.spaceId ? { space_id: interp.space_id ?? opts.spaceId } : {}),
      ...(opts.latticeLevelsSecondary
        ? { lattice_levels_secondary: opts.latticeLevelsSecondary }
        : {}),
    };
    repos.thought.put(thought);

    // 张力升级：对每条指向该 Interpretation 的 challenges（pending 或 confirmed）。
    const challenges = this.findChallengesFrom(tx, interp.id, ['pending', 'confirmed']);
    for (const r1 of challenges) {
      const r2: Relation = {
        id: createId(),
        user_id: interp.user_id,
        from_id: thought.id,
        from_type: 'thought',
        to_id: r1.to_id,
        to_type: 'thought',
        relation_type: 'contradicts',
        origin_type: 'ai_suggested',
        status: 'confirmed',
        confidence: null,
        evidence_ids: r1.evidence_ids ?? [],
        created_at: now,
        confirmed_at: now,
      };
      repos.relation.put(r2);
      // 原记录保持 relation_type=challenges 不改写，仅状态流转（Article 12 演化轨迹）。
      repos.relation.update(r1.id, { status: 'superseded', superseded_by: r2.id });
      this.indexRebuilder.syncRelation(tx, r2);
    }

    return thought;
  }

  /**
   * Thought 的 evidence 继承链：I.evidence_ids → I 的 Observation 们的 evidence_ids。
   *
   * 画像洞察（Portrait Insight，source='mirror'）的 evidence_ids 指向的是**已确认的 Thought 节点**
   * （th-xxx）而非原始 Evidence；派生的 Thought 必须把这类节点 id 追溯解析为其底层原始 Evidence
   * （provenance 保持——不解引用，EvidenceLinkingService.attach 会因"evidence_id 不存在"拦截）。
   */
  private resolveThoughtEvidence(tx: Tx, interp: Interpretation): string[] {
    const repos = this.reposFactory(tx);
    const inherited = new Set<string>();
    // 解析单个 id 到"其真正引用的原始 Evidence"（支持递归：Thought→Evidence / 再引用）。
    const resolveToEvidence = (id: string, depth = 0, seen = new Set<string>()): void => {
      if (depth > 4 || seen.has(id)) return; // 防循环引用/过深链
      seen.add(id);
      const ev = repos.evidence.get(id);
      if (ev) { inherited.add(id); return; } // 本身就是 Evidence → 直接采纳
      const t = repos.thought.get(id);
      if (t) { for (const e of t.evidence_ids ?? []) resolveToEvidence(e, depth + 1, seen); return; }
      const q = repos.question.get(id);
      if (q) { for (const e of q.evidence_ids ?? []) resolveToEvidence(e, depth + 1, seen); return; }
      const i = repos.interpretation.get(id);
      if (i) { for (const e of i.evidence_ids ?? []) resolveToEvidence(e, depth + 1, seen); return; }
    };

    for (const id of interp.evidence_ids) resolveToEvidence(id);
    if (inherited.size === 0) {
      for (const obsId of interp.observation_ids) {
        const obs = repos.observation.get(obsId);
        for (const evId of obs?.evidence_ids ?? []) resolveToEvidence(evId);
      }
    }
    if (inherited.size === 0) {
      throw new ConstraintViolationError(
        '无法派生 Thought：Interpretation 的 evidence 引用无法解析到任何原始 Evidence（不得留空）',
        interp.id
      );
    }
    return [...inherited];
  }

  /** 驳回 Interpretation 时：其 challenges 同步 rejected（batch002-002，留痕不删）。 */
  private syncChallengesOnInterpretationRejected(tx: Tx, interp: Interpretation): void {
    for (const r of this.findChallengesFrom(tx, interp.id, ['pending', 'confirmed'])) {
      this.reposFactory(tx).relation.update(r.id, { status: 'rejected' });
    }
  }

  /** 确认但不存时：pending 的 challenges → confirmed（batch002-004 一等信号）。 */
  private syncChallengesOnInterpretationConfirmedNoStore(
    tx: Tx,
    interp: Interpretation,
    now: string
  ): void {
    for (const r of this.findChallengesFrom(tx, interp.id, ['pending'])) {
      this.reposFactory(tx).relation.update(r.id, { status: 'confirmed', confirmed_at: now });
    }
  }

  private findChallengesFrom(
    tx: Tx,
    interpretationId: string,
    statuses: Relation['status'][]
  ): Relation[] {
    return (tx.query('relation', {
      from_id: interpretationId,
      from_type: 'interpretation',
      relation_type: 'challenges',
    }) as Relation[]).filter((r) => statuses.includes(r.status));
  }

  /**
   * 实质改写路径：原 Interpretation rejected；用户新文本作 user_authored Thought。
   * 新文本同时入 Evidence（用户原话），保证 S-3.1 溯源诚实。
   */
  private applySubstantiveEdit(
    id: string,
    opts: ConfirmInterpretationOptions
  ): ConfirmInterpretationResult {
    const edit = opts.edit;
    if (!edit) throw new ConstraintViolationError('缺少 edit 参数', id);
    return this.storage.transaction((tx) => {
      const repos = this.reposFactory(tx);
      const interp = this.loadPendingInterpretation(repos, id);
      const now = new Date().toISOString();

      const rejected = repos.interpretation.update(id, { status: 'rejected' });
      this.syncChallengesOnInterpretationRejected(tx, interp);

      const evidence = this.linking.locateOrCreate(edit.content, 'chat_message', interp.user_id);
      const evidenceIds = [...new Set([evidence.id, ...interp.evidence_ids])];
      this.linking.attach('thought', evidenceIds);

      const thought: Thought = {
        id: createId(),
        user_id: interp.user_id,
        content: edit.content,
        ...(opts.thesis !== undefined ? { thesis: opts.thesis } : {}),
        ...(opts.premises ? { premises: opts.premises } : {}),
        ...(opts.tension_ref !== undefined ? { tension_ref: opts.tension_ref } : {}),
        lattice_level: this.require(opts.latticeLevel, '实质改写需要 latticeLevel（1-12 主坐标）', id),
        status: 'active',
        version: 1,
        evidence_ids: evidenceIds,
        origin_type: 'user_authored',
        confirmed_at: now,
        created_at: now,
        updated_at: now,
        protocol: opts.protocol ?? null,
        ...(opts.latticeLevelsSecondary
          ? { lattice_levels_secondary: opts.latticeLevelsSecondary }
          : {}),
      };
      repos.thought.put(thought);

      this.logger.log({
        service: 'confirmation',
        operation: 'substantive_edit',
        user_id: interp.user_id,
        outcome: 'ok',
        interpretation_id: id,
        thought_id: thought.id,
      });
      return { interpretation: rejected, thought };
    });
  }

  private transitionRelation(id: string, target: 'confirmed' | 'rejected'): Relation {
    return this.storage.transaction((tx) => {
      const repos = this.reposFactory(tx);
      const rel = repos.relation.get(id);
      if (!rel) throw new ConstraintViolationError('Relation 不存在', id);
      if (rel.status !== 'pending') {
        throw new ConstraintViolationError(
          `仅 status=pending 的 Relation 可执行确认/驳回（当前 ${rel.status}）`,
          id
        );
      }
      const patch: Partial<Relation> =
        target === 'confirmed'
          ? { status: 'confirmed', confirmed_at: new Date().toISOString() }
          : { status: 'rejected' };
      const next = repos.relation.update(id, patch);
      this.indexRebuilder.syncRelation(tx, next);
      this.logger.log({
        service: 'confirmation',
        operation: target === 'confirmed' ? 'confirm_relation' : 'reject_relation',
        user_id: rel.user_id,
        outcome: 'ok',
        relation_id: id,
      });
      return next;
    });
  }

  private transitionQuestion(id: string, target: 'open' | 'archived'): Question {
    return this.storage.transaction((tx) => {
      const repos = this.reposFactory(tx);
      const q = repos.question.get(id);
      if (!q) throw new ConstraintViolationError('Question 不存在', id);
      if (q.status !== 'pending') {
        throw new ConstraintViolationError(
          `仅 status=pending 的 Question 可执行确认/驳回（当前 ${q.status}）`,
          id
        );
      }
      const next = repos.question.update(id, {
        status: target,
        updated_at: new Date().toISOString(),
      });
      this.logger.log({
        service: 'confirmation',
        operation: target === 'open' ? 'confirm_question' : 'reject_question',
        user_id: q.user_id,
        outcome: 'ok',
        question_id: id,
      });
      return next;
    });
  }

  private require<T>(value: T | undefined, message: string, id: string): T {
    if (value === undefined) throw new ConstraintViolationError(message, id);
    return value;
  }
}
