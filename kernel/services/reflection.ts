/**
 * Reflection Service（反思聚合服务）
 *
 * 把"一次交流留下了什么"聚合成结构化反思摘要，而非聊天总结。
 * 设计对齐 Cognitive Experience Layer v0.1 Chapter 3.5 / 4.3：
 *   主题 / 当前关注（按晶格聚类）/ 张力（仍共存）/ 未决问题 / 变化点（曾被精炼）。
 * 克制：仅聚合已落库实体，不做 LLM 二次生成（mock 模式下也可稳定产出）。
 * 不引入任何新认识论实体（Article 0），只派生视图。
 */
import type { Repos } from '../ports/repositories';
import type { Thought, Question, Relation, Interpretation } from '../domain';

export const LATTICE_NAME: Record<number, string> = {
  1: '本体假设',
  2: '认知边界',
  3: '终极关切',
  4: '伦理边界',
  5: '美学体验',
  6: '外部解释',
  7: '自我解释',
  8: '角色解释',
  9: '目标愿景',
  10: '权衡路径',
  11: '困惑悖论',
  12: '行动模式',
};

export interface ReflectionFocus {
  lattice_level: number;
  label: string;
  count: number;
  thoughts: { id: string; content: string }[];
}
export interface ReflectionTension {
  relationId: string;
  from: string;
  to: string;
  status: string;
}
export interface ReflectionQuestion {
  id: string;
  content: string;
  status: string;
}
export interface ReflectionEvolved {
  id: string;
  content: string;
  supersededBy: string | null;
}
export interface ReflectionPayload {
  generatedAt: string;
  windowSince: string | null;
  theme: string | null;
  focus: ReflectionFocus[];
  tensions: ReflectionTension[];
  questions: ReflectionQuestion[];
  evolved: ReflectionEvolved[];
}

/**
 * 张力端点解析（kernel 本地派生，不依赖 Mirror）。
 * 一条张力 = challenges(pending/confirmed) 或 contradicts(confirmed) 关系；
 * 端点标题来自 thought.content / interpretation.content，所属空间来自 thought.space_id
 * （interpretation 端点无独立空间，回退 null，与 Mirror TensionMapService 一致）。
 */
function tensionEndpoint(
  repos: Repos,
  type: 'thought' | 'question' | 'interpretation',
  id: string,
): { title: string; spaceId: string | null } {
  if (type === 'interpretation') {
    const i = repos.interpretation.get(id) as Interpretation | null;
    return i ? { title: i.content, spaceId: null } : { title: '（已删除）', spaceId: null };
  }
  const t = repos.thought.get(id) as Thought | null;
  return t ? { title: t.content, spaceId: t.space_id ?? null } : { title: '（已删除）', spaceId: null };
}

interface KernelTension {
  relationId: string;
  fromTitle: string;
  toTitle: string;
  fromSpaceId: string | null;
  toSpaceId: string | null;
  status: Relation['status'];
}

function deriveTensions(repos: Repos, userId: string): KernelTension[] {
  const challenges = repos.relation.query({
    user_id: userId,
    relation_type: 'challenges',
  }) as Relation[];
  const contradicts = repos.relation.query({
    user_id: userId,
    relation_type: 'contradicts',
  }) as Relation[];
  const out: KernelTension[] = [];
  const push = (r: Relation) => {
    const from = tensionEndpoint(repos, r.from_type, r.from_id);
    const to = tensionEndpoint(repos, r.to_type, r.to_id);
    out.push({
      relationId: r.id,
      fromTitle: from.title,
      toTitle: to.title,
      fromSpaceId: from.spaceId,
      toSpaceId: to.spaceId,
      status: r.status,
    });
  };
  for (const r of challenges) {
    if (r.status !== 'pending' && r.status !== 'confirmed') continue;
    push(r);
  }
  for (const r of contradicts) {
    if (r.status !== 'confirmed') continue; // 只有 confirmed 才是"已确立的张力"
    push(r);
  }
  return out;
}

export function buildReflection(
  repos: Repos,
  userId: string,
  since?: string,
  spaceId?: string | null,
): ReflectionPayload {
  const generatedAt = new Date().toISOString();

  const allThoughts = repos.thought.query({ user_id: userId }) as Thought[];
  // 限定到某空间：前端聊天面板"收获/记录"只展示当前空间内容。
  const spaceScoped = spaceId
    ? allThoughts.filter((t) => t.space_id === spaceId)
    : allThoughts;
  const windowed = since
    ? spaceScoped.filter((t) => (t.confirmed_at || t.created_at) >= since)
    : spaceScoped;

  // 当前关注：按晶格层聚类"现在仍在"的想法（演化掉的旧版本不计入）
  const byLevel = new Map<number, Thought[]>();
  for (const t of windowed) {
    if (t.status === 'superseded' || t.status === 'archived') continue;
    const l = t.lattice_level;
    if (!byLevel.has(l)) byLevel.set(l, []);
    byLevel.get(l)!.push(t);
  }
  const focus: ReflectionFocus[] = [...byLevel.entries()]
    .map(([level, list]) => ({
      lattice_level: level,
      label: LATTICE_NAME[level] || `L${level}`,
      count: list.length,
      thoughts: list
        .slice()
        .sort((a, b) =>
          String(b.confirmed_at || '').localeCompare(String(a.confirmed_at || '')),
        )
        .slice(0, 4)
        .map((t) => ({ id: t.id, content: t.content })),
    }))
    .sort((a, b) => b.count - a.count);

  // 张力：kernel 本地派生（challenges 待确认 + contradicts 已确认），不依赖 Mirror。
  // 注意：张力反映关系结构，不随 since 窗口裁剪——since 仅用于过滤"当前关注"。
  const tensions: ReflectionTension[] = deriveTensions(repos, userId)
    // 限定空间：两端任一属于该空间则保留（空间内交互产生的张力）。
    .filter((e) => !spaceId || e.fromSpaceId === spaceId || e.toSpaceId === spaceId)
    .map((e) => ({
      relationId: e.relationId,
      from: e.fromTitle,
      to: e.toTitle,
      status: String(e.status),
    }));

  // 未决问题：剔除已归档。注意：不随 since 窗口裁剪——since 仅用于过滤"当前关注"。
  const questionsAll = repos.question.query({ user_id: userId }) as Question[];
  const questions: ReflectionQuestion[] = questionsAll
    .filter((q) => q.status !== 'archived')
    .filter((q) => !spaceId || q.space_id === spaceId)
    .map((q) => ({ id: q.id, content: q.content, status: q.status }));

  // 变化点：曾经被精炼过（演化）的想法。不随 since 窗口裁剪——属于认知演化轨迹，应保留。
  const evolved: ReflectionEvolved[] = spaceScoped
    .filter((t) => t.status === 'superseded' || t.superseded_by)
    .map((t) => ({ id: t.id, content: t.content, supersededBy: t.superseded_by ?? null }));

  const theme =
    focus[0]?.label || (tensions.length ? '关系张力' : questions.length ? '未决问题' : null);

  return { generatedAt, windowSince: since ?? null, theme, focus, tensions, questions, evolved };
}
