/**
 * 统一 ID 工厂（ADR-0019 P0-1）。
 *
 * 核心认知实体（Thought / Reflection / Evidence / Observation /
 * Interpretation / Question / Relation / ThoughtMaturity / conversation_message /
 * space / sync envelope 等）必须调用 createId() 生成 UUIDv7，
 * 以具备：本地生成、全球唯一、时间局部性（毫秒时间戳前缀）。
 *
 * 时间局部性对未来的 Sync 排序、事件溯源、复制与调试至关重要；
 * UUIDv4（随机）不具备该性质，故禁止核心实体使用 randomUUID()。
 *
 * 非实体场景（安全令牌、临时会话文件、license_id、LLM requestId 等）
 * 不受影响，仍应使用 node:crypto 的 randomUUID()。
 *
 * 实现零依赖：UUIDv7 = 48bit big-endian Unix 毫秒时间戳
 * + 74bit 随机数，按 RFC 9562 布局（version=7, variant=10xx）。
 */
import { randomBytes as nodeRandomBytes } from 'node:crypto';

/**
 * 随机源（M0 Platform Boundary）：createId 是全仓最深的共享根，
 * 字节来源必须可注入——Desktop 缺省 node:crypto，Mobile 启动时以
 * setRandomBytesSource(CryptoPort.randomBytes) 覆盖。签名保持同步，
 * 语义（16 字节密码学随机）完全不变；禁止改成 async 或 randomUUID。
 */
export type RandomBytesSource = (length: number) => Uint8Array;

let randomSource: RandomBytesSource = nodeRandomBytes;

/** 运行时替换随机源（composition root 专用；测试可注入确定性源）。 */
export function setRandomBytesSource(source: RandomBytesSource): void {
  randomSource = source;
}

/** 生成 UUIDv7 字符串（时间可排序）。 */
export function uuidv7(): string {
  const ts = BigInt(Date.now());
  const bytes = randomSource(16);

  // 时间戳：前 6 字节（48 bit）大端写入毫秒
  bytes[0] = Number((ts >> 40n) & 0xffn);
  bytes[1] = Number((ts >> 32n) & 0xffn);
  bytes[2] = Number((ts >> 24n) & 0xffn);
  bytes[3] = Number((ts >> 16n) & 0xffn);
  bytes[4] = Number((ts >> 8n) & 0xffn);
  bytes[5] = Number(ts & 0xffn);

  // version 7：第 6 字节高 4 位
  const b6 = bytes[6] ?? 0;
  const b8 = bytes[8] ?? 0;
  bytes[6] = (b6 & 0x0f) | 0x70;
  // variant 10xx：第 8 字节高 2 位
  bytes[8] = (b8 & 0x3f) | 0x80;

  // Mobile 兼容：不依赖 Buffer.toString('hex')（Uint8Array 无此重载）。
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-' +
    hex.slice(12, 16) +
    '-' +
    hex.slice(16, 20) +
    '-' +
    hex.slice(20)
  );
}

/**
 * 核心实体 ID 工厂。未来若切换 ULID / Snowflake / 服务端分配，只改此处。
 */
export function createId(): string {
  return uuidv7();
}
