/**
 * C-006 — Ownership Acquisition（获得权）
 *
 * SPEC STATUS: normative
 * IMPLEMENTATION STATUS: open（探测探针，2026-09-11 起预期 RED —— 本文件目的即暴露缺口，不为通过）
 *
 * 规范（Thought OS Open Specification v0.1 · C-006 Ownership Acquisition）：
 *   唯一能把一个 Thought 从 candidate 推到 human-owned（admission.status: candidate → confirmed）
 *   的 authority transition 是 `confirmAdmission`（且强制 thesis/premises/fails_when/信号齐备）。
 *   任何通用存储写（repos.thought.update）都不得"获得 ownership"。
 *
 * 与 C-005 的关系：
 *   C-005 是"是否存在缺口"的发现探针；C-006 是把同一缺口重新表达为明确的
 *   **acquisition authority transition** 的形式化 conformance 用例。两者当前都 RED，
 *   实现 C-006 的守卫后会同绿。
 *
 * 单一职责（重要）：
 *   本探针**只测旁路**（generic update 试图 acquisition），不把 confirmAdmission 的合法路径
 *   塞进来——否则测试同时承担"合法路径正确"与"非法路径不可绕过"两项职责，易膨胀。
 *
 * 范围：一个合法起点（candidate）+ 一个 generic-update acquisition attack。
 * 预期：RED（当前 ThoughtRepo.update 无守卫，generic update 成功落库 → 断言 toBe(false) 失败）。
 */
import { describe, it, expect } from 'vitest';
import { createInMemoryRepos } from '../../kernel/testing/inMemoryRepos';
import type { Repos } from '../../kernel/ports/repositories/index.ts';
import type { Thought } from '../../kernel/domain/index.ts';

function setup(): { repos: Repos } {
  return { repos: createInMemoryRepos() };
}

/**
 * 合法起点：一个 AI 产出的、处于 proposed/candidate 状态的 Thought。
 * 顶层 confirmed_at 为创建时间占位（schema 必填，不代表用户承担）；
 * admission.confirmed_at 为 null、admission.status 为 candidate —— 这才是「未被拥有」的标记。
 */
const CANDIDATE_THOUGHT: Thought = {
  id: 't-acq',
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

/**
 * 唯一的合法 acquisition transition 是 confirmAdmission（candidate → confirmed）。
 * 本探针不调用它；只验证"旁路"（generic thought.update 试图直接 acquisition）必须被拒。
 */
describe('C-006 · Ownership Acquisition', () => {
  it('合法起点：种子 Thought 处于 candidate（proposed）状态，尚未被拥有', () => {
    const { repos } = setup();
    repos.thought.put(CANDIDATE_THOUGHT);

    const t = repos.thought.get('t-acq');
    expect(t).not.toBeNull();
    expect(t!.admission?.status).toBe('candidate');
    expect(t!.admission?.confirmed_at ?? null).toBeNull();
  });

  /**
   * 关键探测：经通用 thought.update 直接把 admission.status 从 candidate 改写为 confirmed
   * （即"获得 ownership"），必须被拒绝。
   *
   * 规范性要求：acquisition 只能走 confirmAdmission。当前 ThoughtRepo.update 无守卫，
   * generic update 会成功落库 —— 因此本用例为 RED，如实暴露 acquisition 旁路缺口。
   * 若日后给 ThoughtRepo 加守卫、使 generic update 拒写 admission.status='confirmed'，
   * 这里会变绿 —— 正是回归测试的意义。
   */
  it('旁路攻击：generic thought.update 直接 acquisition（candidate→confirmed）必须被拒（当前缺口：实际成功）', () => {
    const { repos } = setup();
    repos.thought.put(CANDIDATE_THOUGHT);

    let acquired = false;
    try {
      repos.thought.update('t-acq', {
        admission: {
          signals: ['recurrence'],
          thesis: '用户在关系议题中倾向于把情感经验结构化为责任关系。',
          premises: ['多轮对话反复出现该结构'],
          fails_when: '关系中的理解被证伪时',
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        },
      } as never);
      acquired = true;
    } catch {
      acquired = false;
    }

    // 规范性断言：通用 update 不得获得 ownership。若这里变红，说明存在 acquisition 旁路。
    expect(
      acquired,
      '存储层允许经通用 update 把 admission.status 从 candidate 改写为 confirmed —— Ownership Acquisition 旁路缺口（acquisition 只能由 confirmAdmission 完成）'
    ).toBe(false);
  });
});
