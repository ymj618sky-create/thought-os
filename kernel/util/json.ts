/**
 * 统一的 LLM 输出 JSON 解析工具（domain-agnostic 基础设施层）。
 *
 * 为什么集中在这里：
 * - LLM 输出经常夹带 ```json 围栏、前后说明文字、裸控制字符，散落在 4 个 llm 客户端、
 *   extraction / conflictDetection / latticeSynthesis / questioner 等多处的 JSON.parse
 *   各自重写容错逻辑（P1#5）。统一后：单一真相、单一测试面。
 * - 返回值从 `any` 收敛为 `unknown`：调用方必须显式收窄（asRecord / 类型断言），
 *   不再因 `any` 静默绕过类型检查。
 *
 * 设计纪律（不可妥协）：
 * - 宽容但有界：只兜住「模型夹带文字 / 围栏 / 字符串内裸换行」这类可恢复的句法噪声，
 *   不猜测、不把非法片段硬塞成对象。
 * - 本模块是纯函数、无 IO、无外部依赖，可被任意层（llm / services / conversation / runtime）安全引用，
 *   不反向依赖任何业务层。
 */

/**
 * 把 JSON 文本里【字符串值内部】的裸控制字符（换行 / 回车 / 制表）转义为
 * \n \r \t。合法 JSON 中这些字符本就应是转义形式，所以此函数对合规输入零影响；
 * 它只兜住一种情况：模型为贴合「分段排版」指令，在 "reply" 里直接写了裸换行而非 \n，
 * 否则 JSON.parse 会抛错、compose 退化为兜底回复（"我在听…"），体验更糟。
 */
function escapeRawControlCharsInStrings(s: string): string {
  let out = '';
  let inStr = false;
  let escaped = false;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (inStr) {
      if (escaped) {
        out += c;
        escaped = false;
        continue;
      }
      if (c === '\\') {
        out += c;
        escaped = true;
        continue;
      }
      if (c === '"') {
        out += c;
        inStr = false;
        continue;
      }
      if (c === '\n') {
        out += '\\n';
        continue;
      }
      if (c === '\r') {
        out += '\\r';
        continue;
      }
      if (c === '\t') {
        out += '\\t';
        continue;
      }
      out += c;
      continue;
    }
    if (c === '"') {
      out += c;
      inStr = true;
      continue;
    }
    out += c;
  }
  return out;
}

/**
 * 在文本中寻找第一个完整的 JSON 对象（字符级扫描，正确处理 {} 嵌套、
 * 字符串转义、字符串内的括号）。找不到则返回 null。
 * 这是有限的解析容错：模型在 JSON 前后夹带文字时仍能恢复，但不猜测、
 * 不把非法片段硬塞成对象。
 */
function scanFirstJsonObject(text: string): unknown | null {
  let i = text.indexOf('{');
  while (i !== -1) {
    let depth = 0;
    let inStr = false;
    let escaped = false;
    let end = -1;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end === -1) return null; // 没有闭合的完整对象
    const candidate = text.slice(i, end + 1);
    try {
      return JSON.parse(escapeRawControlCharsInStrings(candidate));
    } catch {
      // 当前候选非法（如字符串内的裸括号导致误判），从下一个 { 继续找
      i = text.indexOf('{', i + 1);
    }
  }
  return null;
}

/** 收窄 unknown 为普通对象记录（非数组、非 null），否则返回 null。 */
export function asRecord(u: unknown): Record<string, unknown> | null {
  return typeof u === 'object' && u !== null && !Array.isArray(u) ? (u as Record<string, unknown>) : null;
}

/**
 * 从模型文本里提取 JSON 对象（兼容 ```json 围栏 + 容错前后夹带文字）。
 * 返回 `unknown`：调用方须用 asRecord 收窄后再按字段读取。找不到返回 null。
 */
export function parseJsonObject(text: string): unknown {
  if (!text) return null;
  // 1. 直接 parse
  try {
    const direct = JSON.parse(text.trim());
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) return direct;
  } catch {
    /* fallthrough */
  }
  // 2. fenced ```json 提取
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m && m[1]) {
    try {
      const fenced = JSON.parse(m[1].trim());
      if (fenced && typeof fenced === 'object' && !Array.isArray(fenced)) return fenced;
    } catch {
      /* fallthrough */
    }
  }
  // 3. 字符级扫描寻找完整 JSON object
  return scanFirstJsonObject(text);
}

/** 从模型文本里提取 JSON 数组（兼容 ```json 围栏 / 自由文本包裹），失败返回空数组。返回 unknown[]。 */
export function parseJsonArray(text: string): unknown[] {
  if (!text) return [];
  const tryParse = (s: string): unknown[] | null => {
    try {
      const p = JSON.parse(s.trim());
      return Array.isArray(p) ? p : null;
    } catch {
      return null;
    }
  };
  // 1) 整段直接解析
  const direct = tryParse(text);
  if (direct) return direct;
  // 2) ```json / ``` 围栏
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) {
    const f = tryParse(fenced[1]);
    if (f) return f;
  }
  // 3) 自由文本包裹（模型常在数组前后加说明文字）：提取第一个 [ 到最后一个 ] 之间的数组片段。
  //    例如 "以下是相关外部知识：\n[{...},{...}]" 或 "{...} 之外还有 [...]"。
  const open = text.indexOf('[');
  const close = text.lastIndexOf(']');
  if (open !== -1 && close > open) {
    const frag = tryParse(text.slice(open, close + 1));
    if (frag) return frag;
  }
  return [];
}

/**
 * 非抛式直接解析（不剥围栏、不扫描）：用于「这段输出是不是合法 JSON」的句法探针
 * （如 llm 客户端记录 parseSucceeded）。合法返回解析值，非法返回 null。
 */
export function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
