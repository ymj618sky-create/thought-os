/**
 * 成熟度计算（重构 v2）。
 *
 * 设计红线：成熟度是四维向量，stage 仅为 UI 派生展示，绝不存为权威事实
 * （真相在 ThoughtMaturitySnapshot）。评分绝不阻断 Thought 进入长期区。
 * 本模块是纯函数，无副作用、无 LLM 调用、无"判断"语义。
 */
export interface MaturityVector {
  clarity: number;   // 清晰度 0..1
  stability: number; // 稳定性 0..1
  recurrence: number; // 复现度 0..1
  connection: number; // 连接度 0..1
}

export type MaturityStage = 'emerging' | 'developing' | 'stable' | 'core';

/** 用于从 Thought 当前状态纯函数推导成熟度的输入信号（不依赖 LLM）。 */
export interface MaturitySignals {
  contentLength: number;
  hasThesis: boolean;
  premiseCount: number;
  evidenceCount: number;
  questionCount: number;
  clarificationCount: number;
  challengeCount: number;
  revisionCount: number;
  supportedBy: number;
  contradictedBy: number;
  confirmedBy: number;
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * 从 Thought 状态信号纯函数推导四维成熟度向量。
 * 仅用于"不调用 LLM 的快照追加"场景（如同一 Thought 的演化轨迹记录）。
 * 这是确定性启发式，不代表认知权威；评分不阻断 Thought 进入长期区。
 */
export function deriveVectorFromSignals(s: MaturitySignals): MaturityVector {
  const c = (n: number) => clamp01(n);
  return {
    clarity: c((s.contentLength > 40 ? 0.5 : s.contentLength / 80) + (s.hasThesis ? 0.3 : 0)),
    stability: c(s.revisionCount / 4 + s.evidenceCount / 5),
    recurrence: c(s.revisionCount / 3 + s.questionCount / 5),
    connection: c(s.premiseCount / 4 + s.evidenceCount / 4 + s.supportedBy / 3),
  };
}

/** 由四维向量推导 stage（派生，非权威）。 */
export function computeStage(v: MaturityVector): MaturityStage {
  const clarity = clamp01(v.clarity);
  const stability = clamp01(v.stability);
  const recurrence = clamp01(v.recurrence);
  const connection = clamp01(v.connection);
  const avg = (clarity + stability + recurrence + connection) / 4;
  if (avg < 0.4) return 'emerging';
  if (avg >= 0.7 && connection >= 0.7) return 'core';
  if (avg >= 0.7) return 'stable';
  return 'developing';
}

/** 平均成熟度（用于排序/展示强度）。 */
export function maturityAverage(v: MaturityVector): number {
  return (
    (clamp01(v.clarity) + clamp01(v.stability) + clamp01(v.recurrence) + clamp01(v.connection)) / 4
  );
}

/**
 * 合并两个成熟度向量（用于"累积证据"场景：同一 Thought 在不同时刻的 Reflection 信号叠加）。
 * 采用饱和上限（取各维最大值），避免简单平均稀释已稳定的维度——符合"思想逐渐稳定"的直觉。
 */
export function mergeVectors(a: MaturityVector, b: MaturityVector): MaturityVector {
  return {
    clarity: Math.max(clamp01(a.clarity), clamp01(b.clarity)),
    stability: Math.max(clamp01(a.stability), clamp01(b.stability)),
    recurrence: Math.max(clamp01(a.recurrence), clamp01(b.recurrence)),
    connection: Math.max(clamp01(a.connection), clamp01(b.connection)),
  };
}
