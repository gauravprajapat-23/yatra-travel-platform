import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, saltB64, hashB64] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltB64 || !hashB64) return false;

  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    if (expected.length !== KEY_LENGTH) return false;

    const actual = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
