import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}
export function passwordVerifier(password?: string) {
  const salt = randomBytes(16);
  const expected = password ? derive(password, salt) : null;
  return async (candidate: unknown) => {
    if (!expected) return true;
    if (typeof candidate !== "string" || candidate.length > 1024) return false;
    return timingSafeEqual(await derive(candidate, salt), await expected);
  };
}
