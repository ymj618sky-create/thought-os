/**
 * C-004 — Provenance completeness
 *
 * SPEC STATUS: normative
 * IMPLEMENTATION STATUS: PASS（2026-09-10 落地）
 *   · 路径 B —— derived_from_interpretation 强制携带 origin_interpretation_id（既有，已验证）
 *   · 路径 A —— Evidence 新增可选字段 raw_evidence_id，由派生自 RawEvidence 的 Evidence 回填，
 *              provenance 链 Evidence ← RawEvidence 闭合（见 specs/schemas/Evidence.schema.json）
 *   注：项目曾有意将 C-004 保持 FAIL/DEFERRED 以暴露缺口；2026-09-10 项目 owner 授权落地溯源字段。
 *
 * 规范（Thought OS Open Specification v0.1 · C-004 Provenance Completeness）：
 *   每个派生的认知产物必须保留足够 provenance，以识别其来源材料。
 *
 *   **规范对象是「可溯源」，不是「Evidence 必须直接拥有 raw_evidence_id」。**
 *   中间层数不限（可经 SourceReference 或 Interpretation）。
 *   重要的是：不能出现「这东西是怎么来的？」而系统答不上来。
 *
 *   本文件分别测两条链（不可互相推论）：
 *   路径 A：Thought ← Evidence ← (Source) ← RawEvidence
 *   路径 B：Thought ← derived_from_interpretation ← origin_interpretation_id
 *
 * 纪律：**不要因为路径 B 已完整，就假设路径 A 也完整。**
 * 两条链分别独立测试。若某条不成立，就让测试如实失败并标注 GAP，
 * 不修 runtime、不用 expect(缺口) 来「通过」。
 */
import { describe, it, expect, test } from 'vitest';
import { createInMemoryRepos } from '../../kernel/testing/inMemoryRepos';

const NOW = new Date().toISOString();

function setup() {
  return { repos: createInMemoryRepos() };
}

describe('C-004 · Provenance completeness', () => {
  // ---------- 路径 B：Interpretation 溯源（预期：已强制） ----------
  it('路径 B：derived_from_interpretation 的 Thought 必须携带 origin_interpretation_id', () => {
    const { repos } = setup();
    expect(() =>
      repos.thought.put({
        id: 'th-mirror',
        user_id: 'u1',
        content: '你最近几次对话几乎没有停在自我观察上',
        thesis: '你较少停在自我观察上',
        lattice_level: 3,
        status: 'active',
        version: 1,
        evidence_ids: [],
        origin_type: 'derived_from_interpretation',
        confirmed_at: NOW,
        // 故意不带 origin_interpretation_id
        created_at: NOW,
        updated_at: NOW,
      } as never),
    ).toThrow();
  });

  it('路径 B：补齐 origin_interpretation_id 后可溯源', () => {
    const { repos } = setup();
    repos.thought.put({
      id: 'th-mirror-ok',
      user_id: 'u1',
      content: '你最近几次对话几乎没有停在自我观察上',
      thesis: '你较少停在自我观察上',
      lattice_level: 3,
      status: 'active',
      version: 1,
      evidence_ids: [],
      origin_type: 'derived_from_interpretation',
      origin_interpretation_id: 'interp-1',
      confirmed_at: NOW,
      created_at: NOW,
      updated_at: NOW,
    } as never);

    const t = repos.thought.get('th-mirror-ok');
    expect(t?.origin_interpretation_id).toBe('interp-1');
  });

  // ---------- 路径 A：Thought ← Evidence ← RawEvidence（预期：已闭合） ----------
  it('路径 A：Thought 能通过 evidence_ids 指回 Evidence', () => {
    const { repos } = setup();
    repos.evidence.put({
      id: 'ev-1',
      user_id: 'u1',
      raw_content: '我在复盘里反复提到不愿意做短期项目',
      content_hash: 'h-1',
      source_type: 'uploaded_text',
      captured_at: NOW,
      created_at: NOW,
    } as never);
    repos.thought.put({
      id: 'th-1',
      user_id: 'u1',
      content: '我不愿做短期收益高的事',
      thesis: '我不愿做短期收益高的事',
      lattice_level: 4,
      status: 'active',
      version: 1,
      evidence_ids: ['ev-1'],
      origin_type: 'user_authored',
      confirmed_at: NOW,
      created_at: NOW,
      updated_at: NOW,
    } as never);

    const t = repos.thought.get('th-1');
    expect(t?.evidence_ids).toContain('ev-1');
    expect(repos.evidence.get('ev-1')).toBeTruthy();
  });

  /**
   * 规范性要求（C-004 已落地）：Evidence 必须能继续溯源到它的原始材料（RawEvidence）。
   * 实现：Evidence 新增可选字段 raw_evidence_id（见 specs/schemas/Evidence.schema.json），
   * 由导入文字派生的 Evidence 在创建时回填该锚点，provenance 链 Evidence ← RawEvidence 闭合。
   */
  it('路径 A：Evidence 能溯源到 RawEvidence（C-004 已落地）', () => {
    const { repos } = setup();
    repos.rawEvidence.put({
      id: 'raw-1',
      user_id: 'u1',
      content: '2026-09-01 日记：又推掉了一个短期高收益的合作',
      content_hash: 'rh-1',
      source: 'diary',
      timestamp: NOW,
      created_at: NOW,
    } as never);

    repos.evidence.put({
      id: 'ev-1',
      user_id: 'u1',
      raw_content: '又推掉了一个短期高收益的合作',
      content_hash: 'h-1',
      source_type: 'uploaded_text',
      captured_at: NOW,
      created_at: NOW,
      raw_evidence_id: 'raw-1',
    } as never);

    const e = repos.evidence.get('ev-1') as unknown as Record<string, unknown> | null;
    expect(
      e?.['raw_evidence_id'],
      'Evidence 必须保留指向 RawEvidence 的溯源锚点（provenance 链在 Evidence 处闭合）',
    ).toBe('raw-1');
  });
});
