/**
 * 词面检索词提取（非语义）。
 *
 * 用于「从用户的问题/表述里找出可能相关的既有判断与证据」，
 * 是 Explore 对照与 Decision 关联材料的共同底座。
 *
 * 刻意**不做**分词/停用词/语义匹配：
 *   - 宁可多召回几个，也不漏掉可能相关的东西（漏掉的代价远大于多看一条）；
 *   - 不宣称"语义相关"，只说"字面出现了这些词"，避免假懂。
 * 真正的语义对照是 L4（Challenge）的职责，需要 LLM 且必须用户显式发起。
 */

/** 英文/数字术语：首字母开头，至少 3 个字符。 */
const EN_TERM = /[a-z][a-z0-9+#.]{2,}/g;
/** 中文连续片段。 */
const ZH_SEG = /[\u4e00-\u9fa5]+/g;

/**
 * 提取检索词。
 * - 英文取 ≥3 字符的单词（过滤 AI、ML 这类 2 字母噪音）；
 * - 中文 ≤4 字段整体保留，长段用双字滑窗覆盖部分匹配。
 */
export function extractTerms(text: string): string[] {
  const terms = new Set<string>();
  const lower = text.toLowerCase();

  for (const m of lower.matchAll(EN_TERM)) {
    terms.add(m[0]);
  }

  for (const seg of text.match(ZH_SEG) ?? []) {
    if (seg.length === 1) continue;
    if (seg.length <= 4) {
      terms.add(seg);
      continue;
    }
    for (let i = 0; i + 2 <= seg.length; i++) terms.add(seg.slice(i, i + 2));
  }

  return [...terms];
}

/**
 * 计算文本与检索词的词面匹配情况。
 * 返回命中的词（去重、保持顺序），供调用方按命中数排序。
 */
export function matchTerms(text: string, terms: string[]): string[] {
  const haystack = text.toLowerCase();
  return terms.filter((t) => haystack.includes(t.toLowerCase()));
}
