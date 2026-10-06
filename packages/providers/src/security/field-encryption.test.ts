import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptSensitiveString,
  encryptSensitiveString,
  lastFourDigits,
} from "./field-encryption";

const ORIGINAL_KEY = process.env.FIELD_ENCRYPTION_KEY;
process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

test("encrypt/decrypt round trip with context", () => {
  const encrypted = encryptSensitiveString("+91 98765 43210", "driver-phone");

  assert.notEqual(encrypted, "+91 98765 43210");
  assert.equal(
    decryptSensitiveString(encrypted, "driver-phone"),
    "+91 98765 43210",
  );
});

test("wrong context fails authentication", () => {
  const encrypted = encryptSensitiveString("DL-12345", "driver-license");

  assert.throws(() => decryptSensitiveString(encrypted, "driver-phone"));
});

test("lastFourDigits returns only final four digits", () => {
  assert.equal(lastFourDigits("+91 98765 43210"), "3210");
  assert.equal(lastFourDigits("abc"), null);
});

test.after(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.FIELD_ENCRYPTION_KEY;
  } else {
    process.env.FIELD_ENCRYPTION_KEY = ORIGINAL_KEY;
  }
});
