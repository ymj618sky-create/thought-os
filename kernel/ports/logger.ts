/**
 * Structured logging contract (kernel-owned).
 * Mirror provides the concrete sink (stdout JSON Lines, memory sink for tests).
 * Kernel services depend only on this interface, never on Mirror's logger implementation.
 */
export type LogOutcome = 'ok' | 'dropped' | 'error' | 'violation';

export interface LogEntry {
  ts: string;
  service: string;
  operation: string;
  user_id?: string;
  outcome: LogOutcome;
  [extra: string]: unknown;
}

export interface Logger {
  log(entry: Omit<LogEntry, 'ts'>): void;
}
