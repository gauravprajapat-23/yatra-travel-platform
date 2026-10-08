import assert from "node:assert/strict";
import test from "node:test";
import { NotificationProviderError } from "./notification-provider";
import { ResendEmailProvider } from "./resend-email-provider";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.NOTIFICATION_EMAIL_FROM;

process.env.RESEND_API_KEY = "re_test_123";
process.env.NOTIFICATION_EMAIL_FROM = "Yatra <noreply@example.com>";

test("Resend provider sends known verification template without persisting secrets", async () => {
  let requestBody: Record<string, unknown> | null = null;

  globalThis.fetch = (async (_input, init) => {
    requestBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return new Response(JSON.stringify({ id: "email_123" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const provider = new ResendEmailProvider();
  const result = await provider.send({
    channel: "EMAIL",
    purpose: "CUSTOMER_EMAIL_VERIFICATION",
    destination: "customer@example.com",
    templateKey: "customer-email-verification-v1",
    templateData: {
      actionUrl: "https://example.com/account/verify-email?token=secret-token&next=<unsafe>",
      expiresAt: "2026-10-09T00:00:00.000Z",
    },
  });

  assert.equal(result.provider, "resend");
  assert.equal(result.providerMessageId, "email_123");
  assert.equal(requestBody?.to instanceof Array, true);
  assert.equal((requestBody?.to as string[])[0], "customer@example.com");
  assert.match(String(requestBody?.html), /Verify email address/);
  assert.match(String(requestBody?.html), /secret-token/);
  assert.match(String(requestBody?.html), /&amp;next=/);
  assert.match(String(requestBody?.html), /&lt;unsafe&gt;/);
  assert.doesNotMatch(String(requestBody?.html), /<unsafe>/);
});

test("Resend provider rejects unsupported channel", async () => {
  const provider = new ResendEmailProvider();

  await assert.rejects(
    () =>
      provider.send({
        channel: "SMS",
        purpose: "CUSTOMER_PASSWORD_RESET",
        destination: "+919876543210",
        templateKey: "customer-password-reset-v1",
        templateData: {
          actionUrl: "https://example.com/account/reset-password?token=secret",
          expiresAt: "2026-10-09T00:00:00.000Z",
        },
      }),
    /only supports EMAIL/,
  );
});

test("Resend provider classifies throttling as retryable", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ message: "rate limited" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;

  const provider = new ResendEmailProvider();

  await assert.rejects(
    () =>
      provider.send({
        channel: "EMAIL",
        purpose: "CUSTOMER_PASSWORD_RESET",
        destination: "customer@example.com",
        templateKey: "customer-password-reset-v1",
        templateData: {
          actionUrl: "https://example.com/account/reset-password?token=secret",
          expiresAt: "2026-10-09T00:00:00.000Z",
        },
      }),
    (error: unknown) =>
      error instanceof Error &&
      "retryable" in error &&
      (error as { retryable: boolean }).retryable === true,
  );
});

test("Resend provider rejects unknown templates as non-retryable", async () => {
  const provider = new ResendEmailProvider();

  await assert.rejects(
    () =>
      provider.send({
        channel: "EMAIL",
        purpose: "CUSTOMER_PASSWORD_RESET",
        destination: "customer@example.com",
        templateKey: "unknown-template",
        templateData: {
          actionUrl: "https://example.com/account/reset-password?token=secret",
          expiresAt: "2026-10-09T00:00:00.000Z",
        },
      }),
    (error: unknown) =>
      error instanceof NotificationProviderError &&
      error.retryable === false &&
      error.code === "UNSUPPORTED_TEMPLATE",
  );
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test.after(() => {
  if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalApiKey;

  if (originalFrom === undefined) delete process.env.NOTIFICATION_EMAIL_FROM;
  else process.env.NOTIFICATION_EMAIL_FROM = originalFrom;

  globalThis.fetch = originalFetch;
});
