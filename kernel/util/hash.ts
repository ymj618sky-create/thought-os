import { createHash } from 'node:crypto';

/** SHA-256 十六进制摘要。Evidence 完整性校验（S-3.3）与日志输入脱敏共用。 */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
