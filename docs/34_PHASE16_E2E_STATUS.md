# Phase 16 — E2E / Integration Testing Status

Status: CODE + CI CERTIFIED — REAL PROVIDER / PRODUCTION DRILLS PENDING

Updated: 2026-10-09

## Goal

Turn the production-critical product contracts into repeatable release gates across database constraints, services, APIs, admin UI, customer UI, mobile layouts, RBAC and provider boundaries.

## Browser / API E2E coverage

### Admin shell / security
- [x] Unauthenticated admin redirect
- [x] Admin login/logout
- [x] Keyboard skip-link behavior
- [x] Mobile page-level overflow checks
- [x] Operations-role RBAC
- [x] Admin route-protection certification
- [x] Form-system certification

### Booking operations
- [x] Vehicle/driver assignment
- [x] Assignment conflict filtering
- [x] Booking status lifecycle
- [x] Timeline persistence
- [x] Refund control permission visibility
- [x] Promotion visibility on discounted bookings

### Fleet
- [x] Maintenance lifecycle
- [x] Compliance blocking
- [x] Fleet operations admin browser flow
- [x] Dispatch/mobile visibility

### Customer authentication
- [x] Verified customer login / portal isolation
- [x] Profile update
- [x] Password change
- [x] One-time email verification
- [x] Verification token replay rejection
- [x] Password reset token consumption
- [x] Password reset replay rejection
- [x] Registration/reset delivery write gates

### Notifications
- [x] Delivery monitor masking
- [x] SENT/FAILED monitor visibility
- [x] Notification runtime safety certification
- [x] Resend provider unit coverage
- [ ] Real Resend production sender/connectivity drill

### Promotions
- [x] Exact server-authoritative preview
- [x] Unknown code rejection
- [x] Expired promotion rejection
- [x] Wrong-scope rejection
- [x] Minimum-spend rejection
- [x] Per-customer limit rejection
- [x] Concurrent max-redemption certification
- [x] Discounted booking snapshot/redemption
- [x] Idempotent booking replay does not double-redeem

### Package departures
- [x] Public package exposes only sellable departures
- [x] Server price/departure quote
- [x] Quote does not reserve inventory
- [x] Booking reserves exactly once
- [x] Idempotent replay does not double-reserve
- [x] Over-capacity second booking rejected
- [x] Cancellation releases exactly once
- [x] Repeated release is a no-op
- [x] Package promotion preview

### CRM
- [x] Interaction logging
- [x] Follow-up creation
- [x] Central queue visibility
- [x] Follow-up completion
- [x] Read-only CRM role coverage
- [x] CRM database / RBAC certification
- [x] Server-action Prisma serialization regression fixed

### Reporting / exports
- [x] Management report export RBAC
- [x] IST date-range validation
- [x] CRM / promotion / departure / fleet sections
- [x] Spreadsheet formula-injection hardening
- [x] Shared booking/report CSV escaping
- [x] Final newest-head CSV/report E2E PASS — Application CI run 37921454975 PASS

### Public car flow
- [x] Disposable active vehicle/class reused from fleet fixture
- [x] Deterministic FIXED pricing rule fixture
- [x] Public car quote E2E added
- [x] Vehicle-capacity rejection E2E added
- [x] Service-level idempotent car booking verifier added
- [x] Public production booking write flag remains OFF
- [x] Final fully wired Application CI PASS — run 37921454975 PASS

## Consolidated CI evidence

- Application CI run 37921454975: PASS
- Browser E2E: PASS across admin, customer auth, CRM, promotions, package departures, public car flow, payment safety, reports/export and mobile admin checks
- Production admin login defaults remain 8 identity attempts / 30 IP attempts per 15 minutes
- Higher login attempt limits are accepted only when the explicit E2E insecure-admin-cookie mode is enabled in CI

## Payment coverage

Automated:
- [x] Payment signature unit tests
- [x] Provider config unit tests
- [x] Server-authoritative payment-order amount
- [x] Checkout-session binding
- [x] Payment runtime safety certification
- [x] Refund reservation invariants
- [x] Razorpay webhook signature/replay/body-bound certification
- [x] HTTP E2E: payment write gate stays closed in normal CI
- [x] HTTP E2E: payment verification requires checkout session

Intentionally external:
- [ ] Real Razorpay test-account order creation
- [ ] Real provider checkout/capture
- [ ] Signature verification against real provider response
- [ ] Provider payment fetch/reconciliation
- [ ] Booking transition to CONFIRMED from real captured payment
- [ ] Real refund drill / webhook replay drill

No fake production payment provider or bypass has been added merely to satisfy CI.

## Release rule

Normal CI must remain provider-independent and fail closed.

Payment/notification production activation requires their separate real-provider drills even when all local/CI tests are green.
