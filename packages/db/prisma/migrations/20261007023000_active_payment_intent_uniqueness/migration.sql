-- Keep the newest currently-open payment intent for each booking before
-- enforcing one active provider order at a time.
WITH ranked_car AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "carBookingId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "PaymentIntent"
  WHERE
    "carBookingId" IS NOT NULL
    AND "status" IN ('CREATED', 'AUTHORIZED')
)
UPDATE "PaymentIntent" AS intent
SET
  "status" = 'CANCELLED',
  "updatedAt" = CURRENT_TIMESTAMP
FROM ranked_car
WHERE
  intent."id" = ranked_car."id"
  AND ranked_car.rn > 1;

WITH ranked_package AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "packageBookingId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "PaymentIntent"
  WHERE
    "packageBookingId" IS NOT NULL
    AND "status" IN ('CREATED', 'AUTHORIZED')
)
UPDATE "PaymentIntent" AS intent
SET
  "status" = 'CANCELLED',
  "updatedAt" = CURRENT_TIMESTAMP
FROM ranked_package
WHERE
  intent."id" = ranked_package."id"
  AND ranked_package.rn > 1;

CREATE UNIQUE INDEX "PaymentIntent_one_active_car_booking_idx"
ON "PaymentIntent" ("carBookingId")
WHERE
  "carBookingId" IS NOT NULL
  AND "status" IN ('CREATED', 'AUTHORIZED');

CREATE UNIQUE INDEX "PaymentIntent_one_active_package_booking_idx"
ON "PaymentIntent" ("packageBookingId")
WHERE
  "packageBookingId" IS NOT NULL
  AND "status" IN ('CREATED', 'AUTHORIZED');
