import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

/** 返回 `scrypt$<salt hex>$<hash hex>` */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const USERNAME_RE = /^[\w一-龥]{2,20}$/;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 72;

export function validateUsername(username: string): string | null {
  if (!USERNAME_RE.test(username)) {
    return "用户名需为 2-20 位的字母、数字、下划线或中文";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `密码至少 ${PASSWORD_MIN} 位`;
  if (password.length > PASSWORD_MAX) return `密码最多 ${PASSWORD_MAX} 位`;
  return null;
}
