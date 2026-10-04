-- Policy documents must be JSON objects.
ALTER TABLE "BookingPolicyVersion"
  ADD CONSTRAINT "BookingPolicyVersion_document_object_check"
  CHECK (jsonb_typeof("document") = 'object');

-- Activation/retirement timestamps must match lifecycle states.
ALTER TABLE "BookingPolicyVersion"
  ADD CONSTRAINT "BookingPolicyVersion_activation_timestamp_check"
  CHECK ("status" <> 'ACTIVE' OR "activatedAt" IS NOT NULL);

ALTER TABLE "BookingPolicyVersion"
  ADD CONSTRAINT "BookingPolicyVersion_retirement_timestamp_check"
  CHECK ("status" <> 'RETIRED' OR "retiredAt" IS NOT NULL);

CREATE OR REPLACE FUNCTION "protect_booking_policy_version"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Once activated, commercial/legal terms and effective dates are immutable.
  IF OLD."status" IN ('ACTIVE', 'RETIRED') THEN
    IF NEW."code" IS DISTINCT FROM OLD."code"
       OR NEW."version" IS DISTINCT FROM OLD."version"
       OR NEW."document" IS DISTINCT FROM OLD."document"
       OR NEW."effectiveFrom" IS DISTINCT FROM OLD."effectiveFrom"
       OR NEW."effectiveTo" IS DISTINCT FROM OLD."effectiveTo"
       OR NEW."createdBy" IS DISTINCT FROM OLD."createdBy" THEN
      RAISE EXCEPTION 'Activated booking policy versions are immutable';
    END IF;
  END IF;

  -- Allowed lifecycle: DRAFT -> ACTIVE -> RETIRED.
  IF OLD."status" = 'DRAFT' AND NEW."status" NOT IN ('DRAFT', 'ACTIVE') THEN
    RAISE EXCEPTION 'Invalid booking policy transition';
  END IF;

  IF OLD."status" = 'ACTIVE' AND NEW."status" NOT IN ('ACTIVE', 'RETIRED') THEN
    RAISE EXCEPTION 'Invalid booking policy transition';
  END IF;

  IF OLD."status" = 'RETIRED' AND NEW."status" <> 'RETIRED' THEN
    RAISE EXCEPTION 'Retired booking policy cannot be reactivated';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "BookingPolicyVersion_immutability_trigger"
BEFORE UPDATE ON "BookingPolicyVersion"
FOR EACH ROW
EXECUTE FUNCTION "protect_booking_policy_version"();
