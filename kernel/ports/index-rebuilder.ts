import type { Tx } from './persistence/port';
import type { Relation } from '../domain';

/**
 * Maintains the reverse index / relation index for Thoughts.
 * Supplied by Mirror at wiring time (concrete index maintenance lives in Mirror).
 */
export interface ThoughtIndexRebuilder {
  rebuild(tx: Tx, thoughtId: string): void;
  syncRelation(tx: Tx, relation: Relation): void;
}
