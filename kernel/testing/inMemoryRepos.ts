/**
 * In-memory reference ReposFactory (OSS Kernel testing/reference adapter).
 *
 * This is a faithful, contract-only implementation of the Kernel `Repos` + `Tx`
 * ports. It exists so that:
 *   - `specs/conformance/` can validate the Kernel protocol invariants WITHOUT
 *     depending on Mirror's private SQLite persistence implementation (OSS Extraction
 *     Gate #3: specs/conformance must not depend on Mirror);
 *   - external developers can run the Kernel + conformance against a reference store
 *     using only Constitution + Specs + Kernel (OSS Extraction Gate #7).
 *
 * It is intentionally NOT a production persistence layer — Mirror remains the owner
 * of concrete persistence. The behavior (field-equality query, Evidence/RawEvidence
 * immutability guards, Decision authority-boundary guard) mirrors Mirror's repositories
 * so conformance results are comparable.
 */
import type { Tx, Filter } from '../ports/persistence/port';
import type { AnyRecord, EntityType } from '../domain';
import type { Repos, Repository } from '../ports/repositories';
import { ConstraintViolationError } from '../errors';
import type {
  Evidence,
  Observation,
  Interpretation,
  Thought,
  Question,
  Relation,
  Reflection,
  Decision,
  Outcome,
  EvolutionTrace,
  EvolutionPattern,
  PortraitCandidate,
  RawEvidence,
  ThoughtMaturitySnapshot,
} from '../domain';

/** In-memory transaction store backing every repository. Implements the Kernel Tx port. */
class InMemoryTx implements Tx {
  private tables: Record<string, Map<string, AnyRecord>> = {};
  private meta: Record<string, number> = {};

  private table(type: EntityType): Map<string, AnyRecord> {
    let t = this.tables[type];
    if (!t) {
      t = new Map();
      this.tables[type] = t;
    }
    return t;
  }

  get(type: EntityType, id: string): AnyRecord | null {
    return this.table(type).get(id) ?? null;
  }

  put(type: EntityType, record: AnyRecord): void {
    if (!record || (record as { id?: unknown }).id == null) {
      throw new Error(`${type} record 缺少 id，无法 put`);
    }
    this.table(type).set((record as { id: string }).id, record);
  }

  query(type: EntityType, filter?: Filter): AnyRecord[] {
    const all = [...this.table(type).values()];
    if (!filter) return all;
    if (typeof filter === 'function') return all.filter(filter);
    return all.filter((r) =>
      Object.entries(filter).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v),
    );
  }

  remove(type: EntityType, id: string): void {
    this.table(type).delete(id);
  }

  getMetaNumber(key: string): number {
    return this.meta[key] ?? 0;
  }
}

/** Generic repository base implementing the Kernel Repository<T> contract against the Tx port. */
class Repo<T extends AnyRecord> implements Repository<T> {
  constructor(
    protected readonly storage: Tx,
    protected readonly type: EntityType,
  ) {}

  put(record: T): void {
    this.storage.put(this.type, record);
  }

  get(id: string): T | null {
    return this.storage.get(this.type, id) as T | null;
  }

  query(filter?: Filter): T[] {
    return this.storage.query(this.type, filter) as T[];
  }

  delete(id: string): void {
    this.storage.remove(this.type, id);
  }

  update(id: string, patch: Partial<T>): T {
    const current = this.get(id);
    if (!current) throw new Error(`${this.type} ${id} 不存在，无法 update`);
    const next = { ...current, ...patch } as T;
    this.put(next);
    return next;
  }
}

/** Evidence.raw_content 不可变（design §4.2 / S-3.3）：禁止 UPDATE，只能整条移除。 */
class EvidenceRepo extends Repo<Evidence> {
  constructor(storage: Tx) {
    super(storage, 'evidence');
  }
  override update(): never {
    throw new ConstraintViolationError('Evidence.raw_content 不可变，禁止 UPDATE；只能经 DeletionService 整条移除', '-');
  }
}

/** V1 Raw Evidence：content 不可变，禁止 UPDATE。 */
class RawEvidenceRepo extends Repo<RawEvidence> {
  constructor(storage: Tx) {
    super(storage, 'raw_evidence');
  }
  override update(): never {
    throw new ConstraintViolationError('RawEvidence.content 不可变，禁止 UPDATE；只能整条移除', '-');
  }
}

/**
 * Decision authority boundary (C-003)：decision / decided_at / status='decided' 只能经
 * DecisionService.decide() 写入。通用 update 拒绝这些字段；decide() 是专用权威写入路径。
 */
class DecisionRepo extends Repo<Decision> {
  constructor(storage: Tx) {
    super(storage, 'decision');
  }

  override update(id: string, patch: Partial<Decision>): Decision {
    if (patch.status === 'decided' || 'decision' in patch || 'decided_at' in patch) {
      throw new ConstraintViolationError(
        "Decision.decision/decided_at/status='decided' 只能经 DecisionService.decide() 写入（authority boundary），禁止经通用 update 绕过",
        'decision',
      );
    }
    return super.update(id, patch);
  }

  decide(id: string, patch: Partial<Decision>): Decision {
    const current = this.get(id);
    if (!current) throw new Error(`decision ${id} 不存在，无法 decide`);
    const next = { ...current, ...patch } as Decision;
    this.storage.put(this.type, next);
    return next;
  }
}

/**
 * Thought provenance guard (C-004 · Provenance completeness):
 * a Thought `derived_from_interpretation` MUST carry `origin_interpretation_id`.
 * Mirrors Mirror's SQLite ajv cross-field constraint so conformance is comparable.
 *
 * NOTE: Ownership-acquisition / content-revision authority guards are deliberately NOT
 * enforced here — those are unimplemented protocol gaps captured by the expected-RED
 * C-005 / C-006 / C-007 conformance tests (they assert "the bypass currently succeeds").
 */
class ThoughtRepo extends Repo<Thought> {
  constructor(storage: Tx) {
    super(storage, 'thought');
  }

  override put(record: Thought): void {
    if (record.origin_type === 'derived_from_interpretation' && !record.origin_interpretation_id) {
      throw new ConstraintViolationError(
        'derived_from_interpretation 的 Thought 必须携带 origin_interpretation_id（溯源完整性，C-004）',
        'thought',
      );
    }
    super.put(record);
  }
}

export type ReferenceRepos = Repos & {
  portraitCandidate: Repository<PortraitCandidate>;
  rawEvidence: Repository<RawEvidence>;
  outcome: Repository<Outcome>;
  thoughtMaturity: Repository<ThoughtMaturitySnapshot>;
};

/**
 * Build an in-memory reference Repos. Drop-in replacement for Mirror's
 * `createRepos(new SqliteStorage(':memory:'))` for OSS conformance + external dev use.
 */
export function createInMemoryRepos(): ReferenceRepos {
  const tx = new InMemoryTx();
  return {
    thought: new ThoughtRepo(tx),
    evidence: new EvidenceRepo(tx),
    observation: new Repo<Observation>(tx, 'observation'),
    interpretation: new Repo<Interpretation>(tx, 'interpretation'),
    question: new Repo<Question>(tx, 'question'),
    relation: new Repo<Relation>(tx, 'relation'),
    reflection: new Repo<Reflection>(tx, 'reflection'),
    decision: new DecisionRepo(tx),
    evolutionTrace: new Repo<EvolutionTrace>(tx, 'evolutionTrace'),
    evolutionPattern: new Repo<EvolutionPattern>(tx, 'evolutionPattern'),
    portraitCandidate: new Repo<PortraitCandidate>(tx, 'portraitCandidate'),
    rawEvidence: new RawEvidenceRepo(tx),
    outcome: new Repo<Outcome>(tx, 'outcome'),
    thoughtMaturity: new Repo<ThoughtMaturitySnapshot>(tx, 'thoughtMaturity'),
  };
}
