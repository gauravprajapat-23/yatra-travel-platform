# Phase 9 — Customer Authentication & Portal Status

Status: IN PROGRESS — FOUNDATION CERTIFICATION RUNNING

Updated: 2026-10-08

## Goal

Add a secure customer account experience without weakening guest-booking privacy, admin authorization or payment boundaries.

## Implemented

### Customer session boundary
- [x] Reuse the existing Session table without a schema migration
- [x] Separate customer cookie from the admin cookie
- [x] Separate customer token-hash namespace
- [x] Customer session requires ACTIVE user status
- [x] Customer session requires a verified email
- [x] Customer session requires CUSTOMER self-read permission
- [x] Customer logout revokes only the current customer session
- [x] Production customer cookie remains HttpOnly, SameSite=Lax and secure

### Authentication
- [x] Verified customer login endpoint
- [x] Customer logout endpoint
- [x] Login rate limiting
- [x] Same-origin protection in production
- [x] Bounded JSON request bodies
- [x] Existing scrypt password hashing/verification reused
- [x] Customer login success/failure audit records
- [x] Registration endpoint implemented behind CUSTOMER_AUTH_WRITE_ENABLED
- [x] Registration creates an unverified CUSTOMER account only
- [x] Registration never creates a customer session before email verification

### Customer experience
- [x] /account/login
- [x] /account/register
- [x] /my-trips becomes an authenticated portal for verified customers
- [x] Only CarBooking.customerUserId / PackageBooking.customerUserId ownership is shown
- [x] Existing guest lookup remains available
- [x] Guest bookings are not auto-claimed by matching email
- [x] Linked car and package bookings share one customer trip list
- [x] Customer sign-out experience
- [x] Responsive account UI

### Account security
- [x] Authenticated password change requires current password
- [x] New password is re-hashed with the existing scrypt implementation
- [x] Other active sessions are revoked after password change
- [x] Password-change audit event
- [x] Reversible browser E2E password-change coverage

### Booking ownership
- [x] Customer-owned booking idempotency fingerprint is separate from guest fingerprint behavior
- [x] Car/package APIs derive customer ownership from the signed customer session only
- [x] Guest identity remains mandatory when no customer session exists
- [x] Customer-owned bookings persist customerUserId with guest identity cleared
- [x] Customer auth/booking-ownership certification runs in Application CI

### Automated certification
- [x] Disposable verified CUSTOMER fixture
- [x] Linked booking fixture
- [x] Browser login -> portal -> linked booking visibility
- [x] Browser logout -> guest state
- [x] Registration-disabled safety-gate test
- [ ] Latest full Application CI certification

## Security decisions

### No guest-booking auto-claim by email

A newly created account must never gain historical guest bookings only because its email text matches the booking email. Until a verified ownership/claim flow exists, guest bookings remain accessible only through the existing reference + registered-email lookup.

### Registration stays disabled until Phase 10 verification delivery

Keep:

```env
CUSTOMER_AUTH_WRITE_ENABLED=false
```

until email verification delivery is implemented and certified. The registration endpoint intentionally does not create a logged-in session for an unverified account.

## Remaining Phase 9 work

- [ ] Certify current customer foundation through full Application CI
- [ ] Add verified guest-booking claim flow after verification delivery exists
- [x] Connect authenticated customer identity to new car/package booking creation using signed session ownership
- [x] Add customer profile/account settings for name/phone with self-write authorization and audit
- [x] Password change revokes other sessions; separate session-management UI not required for the current foundation
- [→] Password reset deferred to Phase 10 notification delivery; authenticated password change is implemented
- [ ] Final Phase 9 production-readiness certification

## Phase 10 dependency

Email verification and password-reset delivery depend on the Notification System phase. Phase 9 must not fake verification or silently trust an email string.

## Acceptance rule

Phase 9 can certify its account/session/portal foundation while registration remains production-disabled, but public account creation must not be enabled until email verification is real and tested.
