/**
 * C-003 — Structural transition requires authority
 *
 * SPEC STATUS: normative
 * IMPLEMENTATION STATUS: resolved（2026-09-11 实测）
 *   · verified：decide() 强制「决定必须由用户做出」——空决定抛错，不静默标记
 *   · resolved：存储层 authority boundary 已补齐——DecisionRepo.update/put 守卫拒绝
 *     经通用路径写入 decision/decided_at/status='decided'，只有专用 decide() 入口
 *     （仅由 DecisionService.decide() 调用）能落库 decided。绕过写入现在会被拒。
 *
 * 规范（Thought OS Open Specification v0.1 · C-003 Human Authority）：
 *   任何建立、确认或实质改变用户认知结构的 transition，必须具有明确的 human authority；
 *   AI proposal 本身不构成该 authority。
 *
 *   **规范对象是 Human Authority，不是 `decide()`。**
 *   实现成 decide() / transition(authority=human) / HumanDecisionEvent 都是实现选择。
 *   因此本文件测的是「是否存在可绕过的权威缺口」，而非「是否调用了 decide()」。
 *
 * 本测试的目的不是「让它通过」，而是确认：
 *   decide() 到底是不是**现实中**的唯一 authority boundary。
 * 若存储层允许绕过，则如实记录为 GAP——不用 expect(false) 伪装通过。
 */
import { describe, it, expect } from 'vitest';
import { createInMemoryRepos } from '../../kernel/testing/inMemoryRepos';
import { DecisionService } from '../../kernel/services/decision.ts';

function setup() {
  const repos = createInMemoryRepos();
  return { repos, svc: new DecisionService(() => repos) };
}

describe('C-003 · Structural transition requires authority', () => {
  it('未给出决定内容时，decide() 必须拒绝（不得静默标记为已决定）', () => {
    const { svc } = setup();
    const d = svc.create('要不要把核心 Kernel 开源？', 'u1');

    expect(() => svc.decide(d.id, { decision: '' })).toThrow(/决定必须由用户做出/);
    expect(svc.get(d.id)?.status).toBe('drafting');
    expect(svc.get(d.id)?.decided_at ?? null).toBeNull();
  });

  it('经 decide() 写入后，状态与时间戳由系统补齐，决定内容来自用户', () => {
    const { svc } = setup();
    const d = svc.create('要不要把核心 Kernel 开源？', 'u1');
    const after = svc.decide(d.id, { decision: '先开源规范层，暂不抽 Kernel', rationale: '边界还没被 conformance 验证' });

    expect(after.status).toBe('decided');
    expect(after.decision).toBe('先开源规范层，暂不抽 Kernel');
    expect(after.decided_at).toBeTruthy();
  });

  /**
   * 关键探测：绕过 decide()，由存储层直接把决策写成 decided。
   *
   * 规范性要求：这**必须失败**（decide() 是唯一 authority boundary）。
   * 存储层 DecisionRepo.update/put 守卫会拒绝通用路径写入 decision/decided_at/status='decided'，
   * 因此绕过写入应当抛错，本用例为绿。若日后有人移除守卫、改回裸 update，
   * 这里会变红——这正是本回归测试存在的意义。
   */
  it('绕过 decide() 的直接写入应当被拒绝（否则 authority boundary 不成立）', () => {
    const { repos, svc } = setup();
    const d = svc.create('要不要把核心 Kernel 开源？', 'u1');

    let bypassed = false;
    try {
      repos.decision.update(d.id, {
        status: 'decided',
        decision: '由存储层直接写入，未经过用户决定流程',
        decided_at: new Date().toISOString(),
      } as never);
      bypassed = true;
    } catch {
      bypassed = false;
    }

    // 规范性断言：直接写入必须失败。若这里变红，说明存在 authority 绕过缺口。
    expect(bypassed, '存储层允许绕过 decide() 直接写入 decided —— authority boundary 存在缺口').toBe(false);
  });
});
