import type { Observation, Interpretation } from '../../domain';

/** A dropped extraction candidate and the reason it was dropped. */
export interface ExtractionDropped {
  kind: 'observation' | 'interpretation' | 'whole_output';
  reason: string;
  candidate?: unknown;
}

/**
 * Result of a single extraction pass.
 * Kernel-owned so that capability contracts (and conformance) do not
 * depend on the extension that implements extraction.
 */
export interface ExtractionResult {
  observations: Observation[];
  interpretations: Interpretation[];
  dropped: ExtractionDropped[];
}
