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

const leadId = "e2e_crm_lead";
const reference = "LEAD-E2ECRM";

await client.connect();

try {
  await client.query("BEGIN");

  await client.query(
    `DELETE FROM "CrmFollowUpTask" WHERE "leadId" = $1`,
    [leadId],
  );
  await client.query(
    `DELETE FROM "CrmInteraction" WHERE "leadId" = $1`,
    [leadId],
  );
  await client.query(
    `DELETE FROM "Lead" WHERE "id" = $1 OR "reference" = $2`,
    [leadId, reference],
  );

  await client.query(
    `
      INSERT INTO "Lead" (
        "id","reference","type","status","idempotencyKey",
        "name","email","emailNormalized","phone","message","sourcePath",
        "createdAt","updatedAt"
      )
      VALUES (
        $1,$2,'CUSTOM_TRIP'::"LeadType",'NEW'::"LeadStatus",
        'e2e-crm-lead-idempotency-0001',
        'E2E CRM Traveller','e2e-crm@yatra.test','e2e-crm@yatra.test',
        '9999990000','Interested in a private temple journey.','/e2e-crm',
        CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )
    `,
    [leadId, reference],
  );

  await client.query("COMMIT");
  console.log(`E2E CRM lead ready: ${reference}`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
