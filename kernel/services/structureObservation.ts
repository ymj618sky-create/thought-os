/**
 * Structure Observation（结构观察 · 弱聚簇，非新实体）。
 *
 * 设计红线（来自用户拍板 2026-08-25）：
 * - "cluster" 是查询结果/计算结果，不是新的事实实体。不新增任何 field
 *   （propositionClusterId / knowledgeNodeId / conceptId / topicId 一律不加）。
 * - 只用已有：confirmed Thought + Continuity Relation(supports/contradicts/refines)。
 * - 不做命题抽象、不给 cluster 命名、不 AI 总结体系、不自动形成概念。
 * - 只呈现："这些已被你确认过的 Thought 目前形成一个相互关联的集合"，
 *   并标注其中存在的冲突/张力关系（由 relation_type=contradicts 直接给出）。
 * - E5 的验证目标：用户裁决后重新 observe，cluster 结构应发生变化。
 */
import type { Repos } from '../ports/repositories';
import type { Relation } from '../domain';

const STRUCTURE_RELATION_TYPES: Relation['relation_type'][] = ['supports', 'contradicts', 'refines'];

export interface StructureCluster {
  /** 该弱连通分量内的 Thought id 集合（仅 confirmed）。 */
  thoughtIds: string[];
  /** 这些 Thought 之间、用于聚簇的已确认关系。 */
  relations: Array<{
    from: string;
    to: string;
    type: Relation['relation_type'];
    origin: Relation['origin_type'];
  }>;
  /** 该集合中存在的未解决冲突（relation_type=contradicts 的两端）。 */
  conflicts: Array<{ a: string; b: string }>;
}

export interface StructureObservation {
  userId: string;
  clusters: StructureCluster[];
  /** 没有任何结构关系的 confirmed Thought（孤立点），单列便于 UI 提示。 */
  singletons: string[];
}

/**
 * 对指定用户做一次结构观察。
 * 算法：取所有 confirmed Thought 作为节点；把 confirmed 且类型属于
 * supports/contradicts/refines 的 Relation 作为无向边；做弱连通分量聚簇。
 */
export function observeStructures(repos: Repos, userId: string): StructureObservation {
  const confirmed = repos.thought
    .query({ user_id: userId })
    .filter((t) => t.admission?.status === 'confirmed');

  const confirmedIds = new Set(confirmed.map((t) => t.id));

  const rels = repos.relation
    .query({ user_id: userId })
    .filter(
      (r) =>
        r.status === 'confirmed' &&
        STRUCTURE_RELATION_TYPES.includes(r.relation_type) &&
        confirmedIds.has(r.from_id) &&
        confirmedIds.has(r.to_id),
    );

  // 并查集（无向聚簇）。
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let p = parent.get(x) ?? x;
    if (p !== x) {
      p = find(p);
      parent.set(x, p);
    }
    return p;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const id of confirmedIds) parent.set(id, id);
  for (const r of rels) union(r.from_id, r.to_id);

  const groups = new Map<string, string[]>();
  for (const id of confirmedIds) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(id);
  }

  const clusters: StructureCluster[] = [];
  const singletons: string[] = [];
  for (const [root, ids] of groups) {
    const clusterRels = rels
      .filter((r) => ids.includes(r.from_id) && ids.includes(r.to_id))
      .map((r) => ({ from: r.from_id, to: r.to_id, type: r.relation_type, origin: r.origin_type }));
    const conflicts = rels
      .filter((r) => r.relation_type === 'contradicts' && ids.includes(r.from_id) && ids.includes(r.to_id))
      .map((r) => ({ a: r.from_id, b: r.to_id }));

    if (ids.length === 1) {
      singletons.push(ids[0]!);
    } else {
      clusters.push({ thoughtIds: ids, relations: clusterRels, conflicts });
    }
  }

  return { userId, clusters, singletons };
}
