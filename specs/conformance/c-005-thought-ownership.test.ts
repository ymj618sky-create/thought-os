/**
 * C-005 — Thought ownership requires human acceptance
 *
 * SPEC STATUS: normative
 * IMPLEMENTATION STATUS: open（探测探针，2026-09-11 起预期 RED —— 本文件目的即暴露缺口，不为通过）
 *
 * 规范（Thought OS Open Specification v0.1 · C-005 Human Ownership of Thought）：
 *   AI 可以 observe / interpret / characterize / propose，但 AI 产出的认知
 *   除非经过一次显式的人 acceptance，否则不能成为「人拥有的 Thought」。
 *
 * 本探针不修复，只回答三个问题（see positioning v0.1 §6 F5）：
 *   1. 什么事件才叫 acceptance？     → 用户确认动作（admission.status: candidate → confirmed，
 *                                      admission.confirmed_at 记录用户动作时间，而非 AI 生成时间）。
 *   2. 哪个 runtime primitive 拥有这个 authority？ → 应是唯一的 human-accept 入口
 *                                     （类比 DecisionRepo.decide()）；目前 Mirror 没有对应守卫原语。
 *   3. 是否存在旁路可绕过 acceptance 直接制造 Human-owned Thought？ → 本探针要测的就是这个。
 *
 * 重要纪律（见 positioning v0.1 §4）：
 *   **不要把 `status:'confirmed'` 等同于 human ownership。** Thought 顶层没有 status:'confirmed'；
 *   真正的 ownership 标记是 admission.status:'confirmed' + admission.confirmed_at（用户动作时间）。
 *   顶层 confirmed_at 是 schema 必填遗留字段（候选期也只是占位/创建时间），不构成 ownership。
 *
 * 本文件只做一个 authority transition（candidate → confirmed，须由人 accept）+
 * 一个旁路攻击（经通用 thought.update 改写 admission.status）。
 * 若存储层允许该旁路，则如实记录为 GAP（同 c-003 之前的 Decision）——不用 expect(false) 伪装通过。
 */
import { describe, it, expect } from 'vitest';
import { createInMemoryRepos } from '../../kernel/testing/inMemoryRepos';
import type { Repos } from '../../kernel/ports/repositories/index.ts';
import type { Thought } from '../../kernel/domain/index.ts';

function setup(): { repos: Repos } {
  return { repos: createInMemoryRepos() };
}

/**
 * 一个 AI 产出的、处于 proposed/candidate 状态的 Thought（derived_from_interpretation，
 * 系统提名但未认领）。顶层 confirmed_at 为创建时间占位（schema 必填，不代表用户承担）；
 * admission.confirmed_at 为 null，admission.status 为 candidate —— 这才是「未被拥有」的标记。
 */
const CANDIDATE_THOUGHT: Thought = {
  id: 't-bypass',
  user_id: 'u1',
  content: '用户在关系议题中倾向于把情感经验结构化为责任关系。',
  lattice_level: 4,
  status: 'active',
  version: 1,
  evidence_ids: ['e1'],
  origin_type: 'derived_from_interpretation',
  origin_interpretation_id: 'i1',
  confirmed_at: new Date().toISOString(),
  admission: {
    signals: ['recurrence'],
    thesis: '用户在关系议题中倾向于把情感经验结构化为责任关系。',
    premises: ['多轮对话反复出现该结构'],
    fails_when: '关系中的理解被证伪时',
    status: 'candidate',
    confirmed_at: null,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('C-005 · Thought ownership requires human acceptance', () => {
  it('合法起点：种子 Thought 处于 AI-produced / candidate（proposed）状态，尚未被拥有', () => {
    const { repos } = setup();
    repos.thought.put(CANDIDATE_THOUGHT);

    const t = repos.thought.get('t-bypass');
    expect(t).not.toBeNull();
    // 真正的 ownership 标记：admission.status 仍为 candidate、admission.confirmed_at 为 null。
    expect(t!.admission?.status).toBe('candidate');
    expect(t!.admission?.confirmed_at ?? null).toBeNull();
  });

  /**
   * 关键探测：绕过任何 human-accept 原语，由存储层通用 update 直接把
   * admission.status 从 candidate 改写为 confirmed（即制造一个 Human-owned Thought）。
   *
   * 规范性要求：这**必须失败**（human acceptance 是唯一 authority boundary）。
   * 当前 ThoughtRepo 无 update 守卫（与 c-003 修复前的 DecisionRepo 同态），
   * 通用 update 会成功落库 —— 因此本用例为 RED，如实暴露缺口。
   * 若日后补上守卫、改走专用 accept() 入口，这里会变绿 —— 正是回归测试的意义。
   */
  it('旁路攻击：通用 thought.update 把 admission.status candidate→confirmed 必须被拒（当前缺口：实际成功）', () => {
    const { repos } = setup();
    repos.thought.put(CANDIDATE_THOUGHT);

    let bypassed = false;
    try {
      repos.thought.update('t-bypass', {
        admission: {
          signals: ['recurrence'],
          thesis: '用户在关系议题中倾向于把情感经验结构化为责任关系。',
          premises: ['多轮对话反复出现该结构'],
          fails_when: '关系中的理解被证伪时',
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        },
      } as never);
      bypassed = true;
    } catch {
      bypassed = false;
    }

    // 规范性断言：旁路写入必须失败。若这里变红，说明存在 Thought authority 绕过缺口。
    expect(
      bypassed,
      '存储层允许经通用 update 把 admission.status 从 candidate 改写为 confirmed —— Thought authority boundary 存在缺口（human ownership 可被旁路制造）'
    ).toBe(false);
  });
});
