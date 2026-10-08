import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireFragments(file, fragments, label) {
  const source = read(file);
  const missing = fragments.filter((fragment) => !source.includes(fragment));

  if (missing.length > 0) {
    throw new Error(
      `${label} is missing required safeguards: ${missing.join(", ")}`,
    );
  }

  process.stdout.write(`PASS ${label}\n`);
}

requireFragments(
  "packages/db/prisma/schema.prisma",
  [
    "model AuthActionToken",
    "tokenHash   String            @unique",
    "consumedAt DateTime?",
    "revokedAt  DateTime?",
    "model NotificationDelivery",
    "status            NotificationDeliveryStatus @default(PENDING)",
    "attemptCount      Int                        @default(0)",
  ],
  "notification database foundation",
);

requireFragments(
  "apps/web/src/modules/notifications/auth-action-service.ts",
  [
    'update(`auth-action:${token}`)',
    "randomBytes(32)",
    "consumedAt: null",
    "revokedAt: null",
    "expiresAt: { gt: now }",
    "claimed.count !== 1",
  ],
  "single-use hashed auth action token lifecycle",
);

requireFragments(
  "packages/providers/src/notifications/notification-provider.ts",
  [
    "export interface NotificationProvider",
    "templateData: NotificationTemplateData",
    "send(message: NotificationMessage)",
  ],
  "provider-neutral notification contract",
);

requireFragments(
  "apps/web/src/modules/notifications/notification-delivery-service.ts",
  [
    'status: "PENDING"',
    'status: "PROCESSING"',
    'status: "SENT"',
    'status: "FAILED"',
    "attemptCount: { increment: 1 }",
    "input.provider.send(input.message)",
  ],
  "notification delivery state machine",
);

const deliverySource = read(
  "apps/web/src/modules/notifications/notification-delivery-service.ts",
);
if (deliverySource.includes("templateData: input.message.templateData")) {
  throw new Error("Notification template data must not be persisted to NotificationDelivery.");
}
process.stdout.write("PASS notification template data stays in memory\n");

requireFragments(
  "apps/web/src/modules/notifications/auth-notification-service.ts",
  [
    "issueAuthActionToken",
    "deliverNotification",
    "url.searchParams.set",
    "revokeAuthActionTokens",
  ],
  "auth notification orchestration",
);


requireFragments(
  "packages/providers/src/notifications/resend-email-provider.ts",
  [
    'const API_URL = "https://api.resend.com/emails"',
    "REQUEST_TIMEOUT_MS",
    'Authorization: `Bearer ${apiKey}`',
    "customer-email-verification-v1",
    "customer-password-reset-v1",
    "NotificationProviderError",
  ],
  "Resend email provider bounds and known templates",
);

requireFragments(
  "apps/web/src/modules/notifications/provider-factory.ts",
  [
    'provider === "resend"',
    "new ResendEmailProvider()",
    "No certified email notification provider is configured",
  ],
  "notification provider remains explicit and fail-closed",
);

requireFragments(
  "apps/web/src/app/api/customer-auth/verify-email/route.ts",
  [
    "verifyCustomerEmailWithToken",
    "INVALID_OR_EXPIRED_TOKEN",
    "consumePublicWriteAttempt",
  ],
  "email verification endpoint safeguards",
);

requireFragments(
  "apps/web/src/app/api/customer-auth/password-reset/request/route.ts",
  [
    'process.env.CUSTOMER_PASSWORD_RESET_ENABLED !== "true"',
    "PASSWORD_RESET_DISABLED",
    "getEmailNotificationProvider",
    "sendAuthActionNotification",
    "If a verified account exists for that email",
  ],
  "password reset request stays gated and enumeration-safe",
);

requireFragments(
  "apps/web/src/app/api/customer-auth/password-reset/confirm/route.ts",
  [
    "resetCustomerPasswordWithToken",
    "hashPassword",
    "RESET_LINK_INVALID",
    "consumePublicWriteAttempt",
  ],
  "password reset confirmation safeguards",
);

requireFragments(
  "apps/web/src/modules/notifications/auth-action-service.ts",
  [
    "CUSTOMER_EMAIL_VERIFIED",
    "CUSTOMER_PASSWORD_RESET",
    "tx.session.updateMany",
    'purpose: "PASSWORD_RESET"',
  ],
  "verification and reset mutations remain transactional and audited",
);

requireFragments(
  "apps/web/src/app/api/customer-auth/register/route.ts",
  [
    'process.env.CUSTOMER_AUTH_WRITE_ENABLED !== "true"',
    "REGISTRATION_DISABLED",
  ],
  "registration remains gated until delivery certification",
);

process.stdout.write("Notification foundation certification passed.\n");
