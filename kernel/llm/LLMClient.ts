/**
 * LLMClient contract (kernel-owned).
 * Mirror / extensions provide concrete implementations (Anthropic, OpenAI, Mock).
 * Kernel services depend only on this interface.
 */
export interface LLMResponse {
  content: string;
  requestId: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
  rawResponse?: unknown;
}

export interface RequestLog {
  requestId: string;
  timestamp: string;
  account: string;
  latencyMs: number;
  ok: boolean;
  error?: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface CallContext {
  userId?: string;
  account?: string;
  conversationId?: string;
  requestId?: string;
}

export interface LLMClient {
  complete(params: {
    prompt: string;
    schema?: unknown;
    jsonSchema?: unknown;
    maxTokens?: number;
    temperature?: number;
    behavior?: string;
    callContext?: CallContext;
  }): Promise<LLMResponse>;
  supportsStructuredOutput(): boolean;
  supportsJsonSchema(): boolean;
  getRequestLog(): RequestLog[];
}
