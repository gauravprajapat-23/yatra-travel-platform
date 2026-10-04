# Phase 5 — Car Booking Flow Status

Status: CERTIFIED — PRODUCTION WRITE FLAG REMAINS OFF UNTIL REAL POLICY ACTIVATION

## Implemented
- [x] BookingStatus enum
- [x] CarQuote schema
- [x] CarBooking schema
- [x] BookingStatusHistory schema
- [x] Guest/customer identity constraint
- [x] Quote expiry constraint
- [x] Integer minor-unit money constraints
- [x] Quote-to-booking one-use relationship
- [x] Idempotency key uniqueness
- [x] Deterministic request fingerprint
- [x] Immutable price snapshot
- [x] Immutable policy snapshot
- [x] Versioned BookingPolicyVersion model
- [x] DRAFT → ACTIVE → RETIRED policy lifecycle
- [x] One active version per policy code
- [x] Database policy immutability trigger
- [x] Booking lifecycle state machine
- [x] Quote money/expiry policy
- [x] Guest identity policy
- [x] Guest booking write service
- [x] POST /api/bookings/car
- [x] BOOKING_WRITE_ENABLED deployment gate
- [x] Serializable booking transaction
- [x] Idempotent replay behavior
- [x] Versioned migrations
- [x] Live booking/policy verifiers
- [x] Rollback-based idempotency database invariant test
- [x] Domain tests
- [x] Prisma schema validation
- [x] Live Neon migration
- [x] Domain/web typechecks
- [x] Production build

## Certification evidence
- Application CI run: 37213486122 — PASS
- Neon Migration Verify run: 37213486251 — PASS

## Production launch gate
No fake booking policy was seeded.

Before enabling public writes:
1. Create and approve a real CAR_BOOKING policy version.
2. Activate it through the privileged admin workflow.
3. Set BOOKING_WRITE_ENABLED=true in the deployment environment.

Until then the endpoint fails closed with HTTP 503.

Phase 5 is technically complete and safe to keep deployed with writes disabled.
