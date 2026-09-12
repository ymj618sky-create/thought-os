/**
 * Evidence 关联服务 —— Evidence_Linking_Protocol 的实现（设计 §6.1）。
 *
 * 协议四步：Locate → Integrity Check → Attach → Minimum Requirement Check。
 * 关键约束：
 * - 禁止占位符：校验失败就是明确失败，不允许用虚构 id 绕过（S-3.1 的核心意图是可追溯）。
 * - 多对多是常态：一条 Evidence 可被多条候选引用，不去重限制。
 * - 哈希不一致 = 完整性异常，中止并抛 IntegrityError，绝不静默继续（S-3.3）。
 */
import { createId } from '../utils/id';
import type { Repos } from '../ports/repositories';
import type { EntityType, Evidence } from '../domain';
import { ConstraintViolationError, IntegrityError } from '../errors';
import type { Logger } from '../ports/logger';
import { sha256 } from '../util/hash';

export class EvidenceLinkingService {
  constructor(
    private readonly repos: Repos,
    private readonly logger: Logger
  ) {}

  /**
   * 按 content_hash 查重；未命中则建 Evidence（SHA-256）。
   * raw_content 原文存储，写入后不可变（EvidenceRepo 禁止 update）。
   */
  locateOrCreate(
    raw: string,
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    sourceType: Evidence['source_type'],
    userId: string,
    capturedAt?: string,
    opts?: {
      speaker?: 'user' | 'mirror';
      conversationEventId?: string | null;
      /** C-004 Provenance：当此 Evidence 由某条 RawEvidence 派生时，回填其 id 以闭合溯源链。 */
      rawEvidenceId?: string | null;
    }
  ): Evidence {
    const hash = sha256(raw);
    // Phase B (B5)：去重键收紧为 content_hash + speaker，避免不同来源的相同文本共享同一条 Evidence，
    // 破坏 provenance（如用户 Evidence 与 Mirror Evidence 文本恰好相同也必须各自独立）。
    const speaker = opts?.speaker ?? 'user';
    const existing = this.repos.evidence
      .query({ user_id: userId })
      .find((e) => e.content_hash === hash && (e.speaker ?? 'user') === speaker);
    if (existing) return existing;

    const now = new Date().toISOString();
    const evidence: Evidence = {
      id: createId(),
      user_id: userId,
      raw_content: raw,
      content_hash: hash,
      source_type: sourceType,
      captured_at: capturedAt ?? now,
      created_at: now,
      speaker: opts?.speaker ?? 'user',
      conversation_event_id: opts?.conversationEventId ?? null,
      raw_evidence_id: opts?.rawEvidenceId ?? null,
    };
    this.repos.evidence.put(evidence);
    this.logger.log({
      service: 'evidenceLinking',
      operation: 'locateOrCreate',
      user_id: userId,
      outcome: 'ok',
      evidence_id: evidence.id,
      created: true,
    });
    return evidence;
  }

  /** 重算 raw_content 哈希与 content_hash 比对；不一致即抛 IntegrityError（S-3.3）。 */
  integrityCheck(evidenceId: string): void {
    const evidence = this.repos.evidence.get(evidenceId);
    if (!evidence) {
      throw new IntegrityError(evidenceId, '记录不存在');
    }
    const actual = sha256(evidence.raw_content);
    if (actual !== evidence.content_hash) {
      throw new IntegrityError(
        evidenceId,
        `哈希不一致: 存储=${evidence.content_hash} 重算=${actual}`
      );
    }
  }

  /**
   * Minimum Requirement Check（协议 Step 4）。
   * 校验失败抛 ConstraintViolationError——校验失败就应该是明确的失败（禁止占位符）。
   */
  attach(
    nodeType: EntityType,
    evidenceIds: string[],
    observationIds: string[] = [],
    questionOriginType?: 'user_authored' | 'ai_suggested'
  ): void {
    for (const id of evidenceIds) {
      if (!this.repos.evidence.get(id)) {
        throw new ConstraintViolationError(`evidence_id ${id} 不存在`, '<attach>');
      }
      this.integrityCheck(id);
    }

    const evCount = evidenceIds.length;
    const obCount = observationIds.length;
    const fail = (msg: string): never => {
      throw new ConstraintViolationError(msg, '<attach>');
    };

    switch (nodeType) {
      case 'thought':
      case 'observation':
        if (evCount < 1) fail(`${nodeType} 需 evidence_ids ≥1`);
        break;
      case 'interpretation':
        if (evCount < 1 && obCount < 1)
          fail('interpretation 需 evidence_ids 或 observation_ids 至少其一 ≥1');
        break;
      case 'question':
        if (questionOriginType === 'ai_suggested' && evCount < 1)
          fail('ai_suggested 的 question 需 evidence_ids ≥1');
        break;
      default:
        break;
    }
  }

  /**
   * 把 Extractor 输出的逐字引用（evidence_quotes）解析为 evidence_ids。
   * 匹配规则：quote 必须是某条同用户 Evidence 的 raw_content 的精确子串
   * （Prompt 要求逐字引用，下游做精确匹配和完整性校验）。
   * 返回 null 表示至少一条 quote 无法定位——调用方应丢弃该候选（协议 Step 3）。
   */
  resolveQuotes(quotes: string[], userId: string): string[] | null {
    if (quotes.length === 0) return null;
    // Phase A：Mirror 来源的 Evidence 不参与「逐字引用 → evidence_id」解析，
    // 避免 Mirror 自身回复文本被误当成用户引用的出处（确认权仍归用户）。
    const userEvidence = this.repos.evidence
      .query({ user_id: userId })
      .filter((e) => e.speaker !== 'mirror');
    const ids = new Set<string>();
    for (const quote of quotes) {
      const hit = userEvidence.find((e) => e.raw_content.includes(quote));
      if (!hit) return null;
      this.integrityCheck(hit.id);
      ids.add(hit.id);
    }
    return [...ids];
  }
}
