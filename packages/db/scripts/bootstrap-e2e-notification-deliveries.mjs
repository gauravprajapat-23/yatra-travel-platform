import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error("DATABASE_URL is required.");

const client = new Client({
  connectionString,
  ssl: connectionString.includes("localhost")
    ? undefined
    : { rejectUnauthorized: false },
});

const ids = {
  sent: "e2e_notification_sent",
  failed: "e2e_notification_failed",
};

await client.connect();

try {
  await client.query("BEGIN");

  await client.query(
    `DELETE FROM "NotificationDelivery" WHERE "id" IN ($1,$2)`,
    [ids.sent, ids.failed],
  );

  await client.query(
    `
      INSERT INTO "NotificationDelivery" (
        "id","channel","purpose","destination","templateKey","status",
        "provider","providerMessageId","attemptCount","sentAt","createdAt","updatedAt"
      )
      VALUES (
        $1,'EMAIL'::"NotificationChannel",'CUSTOMER_EMAIL_VERIFICATION',
        'phase10-monitor@yatra.test','customer-email-verification-v1',
        'SENT'::"NotificationDeliveryStatus",'resend','msg_e2e_sent',1,
        CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )
    `,
    [ids.sent],
  );

  await client.query(
    `
      INSERT INTO "NotificationDelivery" (
        "id","channel","purpose","destination","templateKey","status",
        "provider","attemptCount","failedAt","lastError","createdAt","updatedAt"
      )
      VALUES (
        $1,'EMAIL'::"NotificationChannel",'CUSTOMER_PASSWORD_RESET',
        'phase10-monitor@yatra.test','customer-password-reset-v1',
        'FAILED'::"NotificationDeliveryStatus",'resend',2,
        CURRENT_TIMESTAMP,'E2E provider timeout for monitoring certification',
        CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )
    `,
    [ids.failed],
  );

  await client.query("COMMIT");
  console.log("E2E notification delivery monitor fixture ready.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
