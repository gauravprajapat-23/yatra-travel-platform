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

const pricingRuleId = "e2e_car_customer_pricing";

await client.connect();

try {
  await client.query("BEGIN");

  await client.query(
    `DELETE FROM "PricingRule" WHERE "id" = $1 OR "name" = 'E2E Customer Fixed Route'`,
    [pricingRuleId],
  );

  await client.query(
    `
      INSERT INTO "PricingRule" (
        "id","name","vehicleClassId","tripType","basis","currency",
        "baseAmountMinor","driverAllowancePerDayMinor","nightAllowanceMinor",
        "originKey","destinationKey","priority","status","activeFrom",
        "createdAt","updatedAt"
      )
      VALUES (
        $1,'E2E Customer Fixed Route','e2e_assignment_class',
        'ONE_WAY'::"TripType",'FIXED'::"PricingBasis",'INR',
        125000,10000,5000,'bhopal','indore',999,
        'ACTIVE'::"PricingRuleStatus",
        CURRENT_TIMESTAMP - INTERVAL '1 minute',
        CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )
    `,
    [pricingRuleId],
  );

  await client.query("COMMIT");
  console.log("E2E car customer-flow pricing fixture ready.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
