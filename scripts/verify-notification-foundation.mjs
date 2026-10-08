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
  "apps/web/src/app/api/customer-auth/register/route.ts",
  [
    'process.env.CUSTOMER_AUTH_WRITE_ENABLED !== "true"',
    "REGISTRATION_DISABLED",
  ],
  "registration remains gated until delivery certification",
);

process.stdout.write("Notification foundation certification passed.\n");
