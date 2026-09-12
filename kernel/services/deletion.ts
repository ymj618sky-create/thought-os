/**
 * 删除服务 —— privacy/Deletion_Policy.md 的实现（设计 §6.5）。
 *
 * 原则：系统默认不物理删除任何东西；"删除"一律是状态流转（archived/dismissed/rejected）。
 * 物理删除只在用户显式发起时发生，且是独立于"归档/驳回"的更强动作。
 *
 * 三个层级：
 * 1. 删除单条 Evidence：若它是某条 active Thought 的唯一证据来源，禁止静默删除——
 *    必须显式选择 cascade（一并删除该 Thought）或放弃。
 * 2. 删除单条 Thought/Question/Observation/Interpretation：删除节点本身及其独有
 *    Relation，不级联删除它引用的 Evidence。
 * 3. 删除整个账户：全部物理删除，无中间状态。
 *
 * batch002-004 硬约束：challenges + status=confirmed 是一等长期信号，
 * 任何清理逻辑的筛选条件必须显式排除该组合（只清理 pending 且长期无人处理的）。
 */
import type { CognitivePersistencePort as Storage, Tx } from '../ports/persistence/port';
import type { ReposFactory } from '../ports/repositories';
import type { Interpretation, Observation, Question, Relation, Thought } from '../domain';
import type { Logger } from '../ports/logger';
import { ConstraintViolationError } from '../errors';
import type { ThoughtIndexRebuilder } from '../ports/index-rebuilder';

type DeletableNodeType = 'thought' | 'question' | 'observation' | 'interpretation';

export class DeletionService {
  constructor(
    private readonly storage: Storage,
    private readonly reposFactory: ReposFactory,
    private readonly indexRebuilder: ThoughtIndexRebuilder,
    private readonly logger: Logger
  ) {}

  /**
   * 层级 1：删除单条 Evidence。
   * @param cascadeSoleSourceThoughts 用户显式选择"一并删除失去唯一证据的 Thought"时才为 true。
   */
  deleteEvidence(evidenceId: string, cascadeSoleSourceThoughts = false): void {
    this.storage.transaction((tx) => {
      const repos = this.reposFactory(tx);
      const evidence = repos.evidence.get(evidenceId);
      if (!evidence) throw new ConstraintViolationError('Evidence 不存在', evidenceId);

      // 找出"删除后 evidence_ids 会变空"的 active Thought（违反 S-3.1 的情形）。
      const soleSourceThoughts = repos.thought
        .query({ user_id: evidence.user_id, status: 'active' })
        .filter(
          (t) => t.evidence_ids.includes(evidenceId) && t.evidence_ids.length === 1
        );

      if (soleSourceThoughts.length > 0 && !cascadeSoleSourceThoughts) {
        throw new ConstraintViolationError(
          `该 Evidence 是 ${soleSourceThoughts.length} 条 active Thought 的唯一证据来源` +
            `（${soleSourceThoughts.map((t) => t.id).join(', ')}），` +
            '不允许静默删除：请选择一并删除这些 Thought，或保留该 Evidence',
          evidenceId
        );
      }

      for (const t of soleSourceThoughts) {
        this.removeNodeAndRelations(tx, 'thought', t.id);
      }
      tx.remove('evidence', evidenceId);
      this.logger.log({
        service: 'deletion',
        operation: 'delete_evidence',
        user_id: evidence.user_id,
        outcome: 'ok',
        evidence_id: evidenceId,
        cascaded_thoughts: soleSourceThoughts.length,
      });
    });
  }

  /** 层级 2：删除单条节点及其独有 Relation；不级联删除其引用的 Evidence。 */
  deleteNode(type: DeletableNodeType, id: string): void {
    this.storage.transaction((tx) => {
      const repos = this.reposFactory(tx);
      const node = repos[type].get(id) as
        | Thought
        | Question
        | Observation
        | Interpretation
        | null;
      if (!node) throw new ConstraintViolationError(`${type} 不存在`, id);
      this.removeNodeAndRelations(tx, type, id);
      this.logger.log({
        service: 'deletion',
        operation: 'delete_node',
        user_id: node.user_id,
        outcome: 'ok',
        node_type: type,
        node_id: id,
      });
    });
  }

  /** 层级 3：删除整个账户——全部物理删除，无中间状态。 */
  deleteAccount(userId: string): void {
    this.storage.transaction((tx) => {
      const tables = [
        'evidence',
        'observation',
        'interpretation',
        'thought',
        'question',
        'relation',
      ] as const;
      for (const table of tables) {
        for (const record of tx.query(table, { user_id: userId })) {
          tx.remove(table, record.id);
        }
      }
      this.logger.log({
        service: 'deletion',
        operation: 'delete_account',
        user_id: userId,
        outcome: 'ok',
      });
    });
  }

  /**
   * 可供清理的 challenges：仅 status=pending 且创建时间早于 cutoff。
   * status=confirmed 的 challenges 是一等长期信号（batch002-004），
   * 本查询的筛选条件显式排除——这是协议要求，不是可配置项。
   */
  findCleanableChallenges(userId: string, cutoffIso: string): Relation[] {
    return this.storage.transaction((tx) =>
      (tx.query('relation', {
        user_id: userId,
        relation_type: 'challenges',
        status: 'pending',
      }) as Relation[]).filter((r) => r.created_at < cutoffIso)
    );
  }

  /** 物理移除节点 + 其独有的 Relation，并重建受影响 Thought 的反向索引。 */
  private removeNodeAndRelations(tx: Tx, type: DeletableNodeType, id: string): void {
    const relations = tx
      .query('relation')
      .map((r) => r as Relation)
      .filter((r) => r.from_id === id || r.to_id === id);
    const affectedThoughtIds = new Set<string>();
    for (const r of relations) {
      if (r.from_type === 'thought' && r.from_id !== id) affectedThoughtIds.add(r.from_id);
      if (r.to_type === 'thought' && r.to_id !== id) affectedThoughtIds.add(r.to_id);
      tx.remove('relation', r.id);
    }
    tx.remove(type, id);
    for (const thoughtId of affectedThoughtIds) {
      this.indexRebuilder.rebuild(tx, thoughtId);
    }
  }
}
