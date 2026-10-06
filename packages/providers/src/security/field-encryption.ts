import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function getKey(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("FIELD_ENCRYPTION_KEY is required.");
  }

  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new Error("FIELD_ENCRYPTION_KEY must be base64 encoded.");
  }

  if (key.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }

  return key;
}

function encode(value: Buffer): string {
  return value.toString("base64url");
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function encryptSensitiveString(
  plaintext: string,
  context: string,
): string {
  const value = plaintext.trim();
  if (!value) throw new Error("Sensitive value cannot be empty.");
  if (!context.trim()) throw new Error("Encryption context is required.");

  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));

  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [VERSION, encode(iv), encode(tag), encode(ciphertext)].join(":");
}

export function decryptSensitiveString(
  envelope: string,
  context: string,
): string {
  const [version, ivValue, tagValue, ciphertextValue, ...extra] =
    envelope.split(":");

  if (
    version !== VERSION ||
    !ivValue ||
    !tagValue ||
    !ciphertextValue ||
    extra.length > 0
  ) {
    throw new Error("Unsupported or malformed encrypted value.");
  }

  const key = getKey();
  const iv = decode(ivValue);
  const tag = decode(tagValue);
  const ciphertext = decode(ciphertextValue);

  if (iv.length !== IV_BYTES || tag.length !== 16) {
    throw new Error("Malformed encrypted value.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

export function lastFourDigits(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}
