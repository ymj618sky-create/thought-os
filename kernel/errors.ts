/**
 * Kernel-level invariant & integrity errors.
 *
 * These represent violations of the Thought OS cognitive contract (schema,
 * cross-field constraints, data integrity). They are owned by Kernel so that
 * the contract is self-contained. Mirror's observability/errors re-exports
 * them; product-specific errors (e.g. LLMGenerationFailure) stay in Mirror.
 */
export class MirrorError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

/** ajv validation failure: carries concrete field, expected, actual. */
export class SchemaViolationError extends MirrorError {
  constructor(entityType: string, details: string) {
    super(`[${entityType}] schema 校验失败: ${details}`, 'SCHEMA_VIOLATION');
  }
}

/** Cross-field constraint (constraints.ts; the part JSON Schema can't express) failure. */
export class ConstraintViolationError extends MirrorError {
  constructor(constraint: string, recordId: string) {
    super(`跨字段约束 [${constraint}] 校验失败（记录 ${recordId}）`, 'CONSTRAINT_VIOLATION');
  }
}

/** Evidence hash mismatch (S-3.3). No "auto-fix" for data integrity — abort and escalate. */
export class IntegrityError extends MirrorError {
  constructor(evidenceId: string, detail: string) {
    super(`Evidence ${evidenceId} 完整性校验失败: ${detail}`, 'INTEGRITY');
  }
}
