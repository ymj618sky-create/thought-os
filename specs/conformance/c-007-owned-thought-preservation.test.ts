/**
 * C-007 — Owned-Thought Preservation（所有权保持 / 语义完整性）
 *
 * SPEC STATUS: normative
 * IMPLEMENTATION STATUS: open（探测探针，2026-09-11 起预期 RED —— 本文件目的即暴露缺口，不为通过）
 *
 * 规范（Thought OS Open Specification v0.1 · C-007 Ownership Preservation）：
 *   一个已经获得 human ownership 的 Thought（admission.status === 'confirmed'），
 *   其 authority-bearing 语义内容（此处最小化为 content）不得经通用存储写
 *   （repos.thought.update）被静默修改。任何改变"这个 Thought 究竟在主张什么"的写入，
 *   必须走 authorized revision 原语（evolution / revision），而非 generic mutation。
 *
 * 与 C-005 / C-006 的边界（单一职责）：
 *   C-005 发现 ownership 存在 generic bypass；
 *   C-006 形式化 acquisition（candidate → confirmed 必须由 confirmAdmission）；
 *   C-007 形式化 preservation（一旦获得 ownership，content 不得被 generic mutation 静默改变）。
 *   本探针**不测 acquisition**（那是 C-006），**不测** status / provenance bundle / user_id /
 *   projection / 合法 revision 路径。只抓一个代表性攻击面：已 owned Thought 的 content 被 generic update 改写。
 *
 * 范围：一个合法起点（已 admission=confirmed 的 Thought）+ 一个 generic-update content attack。
 * 预期：RED（当前 ThoughtRepo.update 无守卫，generic update 成功落库 → 断言 toBe(false) 失败）。
 *
 * 关于未纳入的字段：
 *   - `user_id`（ownership transfer / subject identity integrity）若日后证实可 generic 改写，
 *     应单独立 C-008 Ownership Subject Integrity，而非膨胀进 C-007。
 *   - `maturity_stage` / `projection` / `tension` 等派生投影：其正确约束可能是
 *     "generic mutation ❌ / projection-specific recompute ✓"，不等于 authority-bearing，暂不贴标签。
 */
import { describe, it, expect } from 'vitest';
import { createInMemoryRepos } from '../../kernel/testing/inMemoryRepos';
import type { Repos } from '../../kernel/ports/repositories/index.ts';
import type { Thought } from '../../kernel/domain/index.ts';

function setup(): { repos: Repos } {
  return { repos: createInMemoryRepos() };
}

/**
 * 合法起点：一个已经获得 human ownership 的 Thought。
 * 顶层 confirmed_at 与 admission.confirmed_at 均设为确认动作时间；admission.status='confirmed'。
 * 这是"confirmAdmission 合法路径完成之后"的状态——本探针不调用 confirmAdmission，
 * 只 seed 该终态以聚焦 preservation。
 */
const OWNED_THOUGHT: Thought = {
  id: 't-owned',
  user_id: 'u1',
  content: '用户在关系议题中倾向于把情感经验结构化为责任关系。',
  thesis: '用户在关系议题中倾向于把情感经验结构化为责任关系。',
  premises: ['多轮对话反复出现该结构'],
  fails_when: '关系中的理解被证伪时',
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
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * 核心 preservation invariant：已 owned Thought 的 content 不能被 generic update 静默改写。
 * 本探针只测这一条；不碰 acquisition / status / provenance / user_id / projection / 合法 revision。
 */
describe('C-007 · Owned-Thought Preservation', () => {
  it('合法起点：种子 Thought 已处于 human-owned 状态（admission.status === confirmed）', () => {
    const { repos } = setup();
    repos.thought.put(OWNED_THOUGHT);

    const t = repos.thought.get('t-owned');
    expect(t).not.toBeNull();
    expect(t!.admission?.status).toBe('confirmed');
    expect(t!.admission?.confirmed_at ?? null).not.toBeNull();
  });

  /**
   * 关键探测：经通用 thought.update 直接改写一个已 owned Thought 的 content。
   *
   * 规范性要求：generic mutation 不得改变 owned Thought 的语义内容（须走 authorized revision）。
   * 当前 ThoughtRepo.update 无守卫，generic update 会成功落库 —— 因此本用例为 RED，
   * 如实暴露 ownership preservation 旁路缺口。若日后给 ThoughtRepo 加守卫、使 generic update
   * 拒改 authority-bearing 字段，这里会变绿。
   */
  it('旁路攻击：generic thought.update 改写已 owned Thought 的 content 必须被拒（当前缺口：实际成功）', () => {
    const { repos } = setup();
    repos.thought.put(OWNED_THOUGHT);

    const maliciousContent =
      '【AI 静默改写】用户其实并不倾向于把情感经验结构化为责任关系。';

    let mutated = false;
    try {
      repos.thought.update('t-owned', { content: maliciousContent } as never);
      mutated = true;
    } catch {
      mutated = false;
    }

    // 规范性断言：generic update 不得静默改变 owned Thought 的 content。若这里变红，说明存在 preservation 旁路。
    expect(
      mutated,
      '存储层允许经通用 update 静默改写已 owned Thought 的 content —— Ownership Preservation 旁路缺口（content 改变须走 authorized revision）'
    ).toBe(false);
  });
});
