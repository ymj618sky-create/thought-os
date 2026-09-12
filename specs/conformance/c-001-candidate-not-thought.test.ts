/**
 * C-001 — Candidate ≠ Thought
 *
 * SPEC STATUS: normative
 * IMPLEMENTATION STATUS: verified
 *
 * 规范（Thought OS Open Specification v0.1 · C-001 Candidate ≠ Thought）：
 *   A candidate proposal MUST NOT be represented as a confirmed user-owned
 *   Thought without the required human confirmation transition.
 *
 *   注意：thesis / premises / fails_when 的完备性属于 **Admission Protocol**，
 *   不是 Kernel Constitution——不应把当前 Admission schema 写成规范。
 *   当前实现用它作为确认门槛，是实现选择。
 *   本文件锁死现有行为，以便将来区分「原则变了」还是「实现变了」。
 *
 * 本文件只**锁死现有行为**，不修改任何 runtime。
 *
 * 测试数据说明：Thought schema 要求 confirmed_at 存在、admission 若存在则须含 thesis，
 * 因此「缺失」以**空值**表达（'' / []），从而让被测对象是 admission 的业务校验，
 * 而不是 schema 的必填校验。
 */
import { describe, it, expect } from 'vitest';
import { createInMemoryRepos } from '../../kernel/testing/inMemoryRepos';
import { confirmAdmission, classifyThought } from '../../kernel/services/admissionService.ts';

const NOW = new Date().toISOString();

function setup() {
  return { repos: createInMemoryRepos() };
}

/** 落一条「原材料」：尚未经任何准入流程。 */
function seedMaterial(repos: ReturnType<typeof createInMemoryRepos>, over: Record<string, unknown> = {}) {
  repos.thought.put({
    id: 'th-1',
    user_id: 'u1',
    content: '我似乎越来越不愿意做短期收益很高的事',
    lattice_level: 3,
    status: 'active',
    version: 1,
    evidence_ids: [],
    origin_type: 'user_authored',
    confirmed_at: NOW,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  } as never);
}

/** 构造一个字段齐备的 admission，允许逐项覆盖为「空」以测试校验。 */
function admission(over: Record<string, unknown> = {}) {
  return {
    signals: ['recurrence'],
    status: 'candidate',
    thesis: '我不愿做短期收益高的事',
    premises: ['近三个月反复回避这类机会'],
    fails_when: '如果出现一个我真心想做的短期项目',
    ...over,
  };
}

describe('C-001 · Candidate ≠ Thought', () => {
  it('thesis 为空时，不得确认为 Thought', () => {
    const { repos } = setup();
    seedMaterial(repos, { admission: admission({ thesis: '' }) });
    expect(() => confirmAdmission(repos, 'th-1')).toThrow(/thesis 为空/);
  });

  it('premises 为空或含空项时，不得确认为 Thought', () => {
    const { repos } = setup();
    seedMaterial(repos, { admission: admission({ premises: [] }) });
    expect(() => confirmAdmission(repos, 'th-1')).toThrow(/premises/);

    const { repos: r2 } = setup();
    seedMaterial(r2, { admission: admission({ premises: ['   '] }) });
    expect(() => confirmAdmission(r2, 'th-1')).toThrow(/premises/);
  });

  it('fails_when 为空时，不得确认为 Thought', () => {
    const { repos } = setup();
    seedMaterial(repos, { admission: admission({ fails_when: '' }) });
    expect(() => confirmAdmission(repos, 'th-1')).toThrow(/fails_when/);
  });

  it('无任何准入信号时，不得确认为 Thought', () => {
    const { repos } = setup();
    // 三条字段齐备，但 signals 为空——仍不得确认
    seedMaterial(repos, { admission: admission({ signals: [] }) });
    expect(() => confirmAdmission(repos, 'th-1')).toThrow(/准入信号/);
  });

  it('未经人类确认的材料既不是 candidate 也不是 confirmed', () => {
    const { repos } = setup();
    seedMaterial(repos);
    const t = repos.thought.get('th-1');
    expect(classifyThought(t!)).toBe('material');
    expect(t?.admission?.status ?? null).toBeNull();
    // 注：schema 强制 confirmed_at 必填且为 string，故「未确认」的判定
    // 落在 admission.status 上，而非 confirmed_at 的有无。
  });

  it('人类确认后进入 confirmed，并记下确认时间', () => {
    const { repos } = setup();
    seedMaterial(repos, { admission: admission() });
    const t = confirmAdmission(repos, 'th-1');
    expect(t.admission?.status).toBe('confirmed');
    expect(t.admission?.confirmed_at).toBeTruthy();
    expect(classifyThought(t)).toBe('confirmed');
  });
});
