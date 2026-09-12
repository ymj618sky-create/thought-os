import type { AnyRecord, EntityType } from '../../domain';

/** Query filter: either a field-equality object, or a predicate function. */
export type Filter = Partial<Record<string, unknown>> | ((r: AnyRecord) => boolean);

/**
 * Transaction context for one atomic mutation batch.
 * Repositories and Kernel services depend ONLY on this contract, never on a concrete store.
 */
export interface Tx {
  get(type: EntityType, id: string): AnyRecord | null;
  put(type: EntityType, record: AnyRecord): void;
  query(type: EntityType, filter?: Filter): AnyRecord[];
  /** Physical removal — only DeletionService calls this. */
  remove(type: EntityType, id: string): void;
}

/**
 * Kernel persistence capability contract.
 * Mirror provides a concrete implementation (e.g. SQLite). Kernel never imports the implementation.
 */
export interface CognitivePersistencePort extends Tx {
  /** Same-transaction execution: entity + reverse-index updates must commit together (ADR-0005). */
  transaction<T>(fn: (tx: Tx) => T): T;
  /** Close the underlying connection (process exit only). */
  close(): void;
  /** Read a counter stored in metadata (e.g. Sync cursor). Port-level, avoids Runtime casting concrete store. */
  getMetaNumber(key: string): number;
  /** Merge WAL back into main db (before process exit). */
  checkpoint(): void;
}
