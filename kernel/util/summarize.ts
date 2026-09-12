/**
 * 一行摘要的截断：优先停在句读上，绝不把用户的话断在半句中间。
 *
 * 为什么需要它：
 *   UI 只放得下一行，截断不可避免。但 `slice(0, N)` 会把句子切成
 *   "……这可能会影响我们判断，因为"——看起来像系统坏了，而不是"还有下文"。
 *   宁可短一点，也要停在句读/停顿处；确实没处可停时，补省略号明确表示"还有"。
 *
 * 立场：这是呈现层的诚实——不假装给的是完整句子，也不制造残缺句子。
 */
export function summarizeAtSentence(text: string, max: number): string {
  const t = (text ?? '').trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;

  const cut = t.slice(0, max);
  // 允许回溯的最短位置：避免为了一个句读把摘要缩到太短（< 40% 就不值得）。
  const floor = Math.floor(max * 0.4);

  // 1) 句读：中英文句号 / 叹号 / 问号 / 分号 / 换行——句子完整，不加省略号。
  const sentenceEnd = '。！？；!?;\n';
  for (let i = cut.length - 1; i >= floor; i--) {
    if (sentenceEnd.includes(cut.charAt(i))) return cut.slice(0, i + 1).trim();
  }

  // 2) 停顿：逗号 / 顿号 / 冒号 / 空格——仍是一句话的中间，补省略号表示未完。
  const pause = '，,、：: ';
  for (let i = cut.length - 1; i >= floor; i--) {
    if (pause.includes(cut.charAt(i))) return `${cut.slice(0, i).trim()}…`;
  }

  // 3) 实在无处可停：硬切并补省略号（至少用户知道后面还有）。
  return `${cut.trim()}…`;
}
