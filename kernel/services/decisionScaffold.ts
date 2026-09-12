import type { LLMClient } from '../llm/LLMClient';
import type { Logger } from '../ports/logger';
import type { PromptSource } from '../platform/ports';
import { parseJsonObject } from '../util/json';

const PROMPT_VERSION = 'decide-scaffold-v001';

export interface DecisionScaffold {
  options: string[];
  assumptions: string[];
  counter_evidence: string[];
  risks: string[];
  expected_outcomes: string[];
}

export const DEFAULT_SCAFFOLD_PROMPT_URL = new URL(
  '../../../agents/decide/prompts/scaffold-v001.md',
  import.meta.url,
);

const EMPTY_SCAFFOLD: DecisionScaffold = {
  options: [],
  assumptions: [],
  counter_evidence: [],
  risks: [],
  expected_outcomes: [],
};

/**
 * 决策脚手架：根据问题生成选项 / 假设 / 反方证据 / 风险 / 预期结果。
 *
 * 宪法约束（见 DecisionService 注释）：
 *  - 只生成"候选材料"，**绝不**生成最终决定（decision / rationale）。
 *  - options 由调用方标注 proposed_by='mirror'，明确是系统提议，用户可删改。
 */
export class DecisionScaffoldService {
  constructor(
    private readonly llm: LLMClient,
    private readonly logger: Logger,
    private readonly prompts: PromptSource,
  ) {}

  async scaffold(problem: string): Promise<DecisionScaffold> {
    const userMessage = `【用户要决定的问题】\n${problem}\n\n请按 Prompt 输出这个决定的脚手架（严格 JSON）。`;
    try {
      const resp = await this.llm.complete(this.prompts.loadSync(), userMessage, {
        systemPromptVersion: PROMPT_VERSION,
      });
      const parsed = parseJsonObject(resp.content);
      const obj =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
      if (!obj) return EMPTY_SCAFFOLD;

      const strArr = (key: string): string[] => {
        const v = obj[key];
        return Array.isArray(v) && v.every((x) => typeof x === 'string')
          ? (v as string[]).filter((x) => x && typeof x === 'string' && x.trim())
          : [];
      };

      return {
        options: strArr('options').slice(0, 6),
        assumptions: strArr('assumptions').slice(0, 6),
        counter_evidence: strArr('counter_evidence').slice(0, 6),
        risks: strArr('risks').slice(0, 6),
        expected_outcomes: strArr('expected_outcomes').slice(0, 6),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.log({
        service: 'decision-scaffold',
        operation: 'llm',
        outcome: 'error',
        reason: msg,
      });
      return EMPTY_SCAFFOLD;
    }
  }
}
