import type { Observation, Interpretation } from '../domain';

/**
 * The 12-lattice / protocol / tension projection of a Thought.
 * Must stay structurally compatible with `Thought.projection`.
 */
export interface Projection {
  lattice: Array<{ level: number; weight: number }>;
  protocol: Array<{ protocol: string; weight: number }>;
  tension: string | null;
}

/**
 * Derives a Thought projection. Supplied by Mirror at wiring time
 * (the concrete derivation lives in Mirror's domain layer).
 */
export interface ProjectionDeriver {
  derive(
    interpretation: Pick<Interpretation, 'content' | 'tension' | 'confidence'>,
    observations: Array<Pick<Observation, 'pattern_type'>>,
    currentLattice?: number | null
  ): Projection;
}
