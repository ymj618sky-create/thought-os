import type { AnyRecord } from '../../domain';
import type { Filter } from '../persistence/port';
import type {
  Evidence,
  Observation,
  Interpretation,
  Thought,
  Question,
  Relation,
  Reflection,
  ThoughtMaturitySnapshot,
  EvolutionTrace,
  EvolutionPattern,
  Decision,
} from '../../domain';

/**
 * Generic repository contract. Kernel defines WHAT persistence capability is needed;
 * Mirror provides the implementation. Enforcement of invariants (immutability, authority)
 * is declared here as method shape and defined in kernel/invariant; the execution mechanism
 * is deferred to C-005/006/007 (NOT hardcoded into these contracts).
 */
export interface Repository<T extends AnyRecord> {
  put(record: T): void;
  get(id: string): T | null;
  query(filter?: Filter): T[];
  delete(id: string): void;
  update(id: string, patch: Partial<T>): T;
}

export interface EvidenceRepository extends Repository<Evidence> {
  /** Evidence.raw_content is immutable once written: UPDATE forbidden, only whole-record removal. */
  update(): never;
}

export interface ObservationRepository extends Repository<Observation> {}
export interface InterpretationRepository extends Repository<Interpretation> {}
export interface ThoughtRepository extends Repository<Thought> {}
export interface QuestionRepository extends Repository<Question> {}
export interface RelationRepository extends Repository<Relation> {}
export interface ReflectionRepository extends Repository<Reflection> {}
export interface ThoughtMaturityRepository extends Repository<ThoughtMaturitySnapshot> {}
export interface EvolutionTraceRepository extends Repository<EvolutionTrace> {}
export interface EvolutionPatternRepository extends Repository<EvolutionPattern> {}

export interface DecisionRepository extends Repository<Decision> {
  /**
   * Dedicated authority-write path. The only sanctioned entry for
   * decision / decided_at / status='decided', invoked by DecisionService.decide().
   */
  decide(id: string, patch: Partial<Decision>): Decision;
}

import type { Tx } from '../persistence/port';

/** Factory that builds a Repos bound to a transaction. Supplied by Mirror at wiring time. */
export type ReposFactory = (tx: Tx) => Repos;

/** The cognitive-repository contract surface that Kernel owns. */
export interface Repos {
  evidence: EvidenceRepository;
  observation: ObservationRepository;
  interpretation: InterpretationRepository;
  thought: ThoughtRepository;
  question: QuestionRepository;
  relation: RelationRepository;
  reflection: ReflectionRepository;
  thoughtMaturity: ThoughtMaturityRepository;
  evolutionTrace: EvolutionTraceRepository;
  evolutionPattern: EvolutionPatternRepository;
  decision: DecisionRepository;
}
