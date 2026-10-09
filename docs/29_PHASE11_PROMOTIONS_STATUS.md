# Phase 11 — Promotions / Coupon Codes Status

Status: CODE FOUNDATION + ATOMIC BOOKING INTEGRATION IMPLEMENTED — CUSTOMER APPLICATION GATED

Updated: 2026-10-09

## Goal

Add server-authoritative coupon/promotion support for car and package bookings without allowing client-side price tampering, quote-only usage exhaustion, idempotency ambiguity, or concurrent over-redemption.

## Implemented

### Promotion rules
- [x] Percentage discounts use integer basis points
- [x] Fixed-amount discounts use minor currency units
- [x] ALL / CAR / PACKAGE booking scopes
- [x] Minimum subtotal
- [x] Maximum discount cap
- [x] Active-from / active-to window
- [x] Global redemption limit
- [x] Per-customer / per-guest-email redemption limit
- [x] Discount cannot exceed subtotal
- [x] Fixed promotions require matching currency
- [x] Static rule validation separated from quote-specific eligibility
- [x] Domain unit coverage for discount math and limits

### Database foundation
- [x] Promotion model with normalized unique code
- [x] PromotionRedemption model
- [x] Promotion status/scope/discount enums
- [x] Promotion snapshot fields on car/package quotes and bookings
- [x] Promotion relations on car/package quotes and bookings
- [x] Database checks for discount mode, code format, currency, limits and active window
- [x] Redemption database checks for exactly one booking identity and one customer identity
- [x] One redemption row per booking
- [x] Database foundation verification in Application CI
- [x] Neon migration verification passed for the promotion migration

### Admin management
- [x] Promotion list with search/status/scope filters
- [x] Promotion create form
- [x] Promotion edit/status/activation form
- [x] Redemption counters are system-managed and not editable
- [x] Create/update actions are audited
- [x] Promotion admin nav entry
- [x] Admin form-system certification coverage
- [x] Configuration alone does not change customer quote totals

### Quote preview
- [x] Server-authoritative preview service reads subtotal/currency from stored quote
- [x] Quote expiry is enforced
- [x] Promotion status/scope/window/minimum/global/per-customer limits are enforced
- [x] Preview never consumes a redemption
- [x] Preview returns recalculated subtotal/discount/tax/total only from server values
- [x] Promotion snapshot is generated server-side
- [x] POST /api/promotions/preview
- [x] Preview endpoint is rate-limited and bounded
- [x] Preview endpoint is disabled unless PROMOTION_APPLY_ENABLED=true

### Concurrency / redemption
- [x] Promotion row is locked with SELECT ... FOR UPDATE before booking-time eligibility
- [x] Global redemption limit is serialized
- [x] Per-customer limit is checked while the promotion lock is held
- [x] PromotionRedemption is created in the same booking transaction
- [x] redeemedCount is incremented atomically
- [x] Concurrent maxRedemptions=1 race certification proves exactly one redemption commits
- [x] Quote requests never increment redemption usage

### Booking integration
- [x] Optional promotion code is part of the booking idempotency fingerprint
- [x] Promotion code normalization is casing/whitespace stable
- [x] Different promotion requests cannot replay under the same idempotency key
- [x] Car booking applies promotion only inside the serializable booking transaction
- [x] Package booking applies promotion only inside the serializable booking transaction
- [x] Promotion usage is rolled back if booking creation fails
- [x] Promotion ID + immutable snapshot stored on discounted booking
- [x] Discounted total becomes the payment/review total
- [x] Existing quote discounts cannot be silently stacked with a promotion
- [x] Booking APIs accept an optional bounded promotionCode
- [x] No-code booking behavior remains unchanged
- [x] Promotion booking application remains disabled unless PROMOTION_APPLY_ENABLED=true

### Customer UI
- [x] Car booking promotion field is rendered only when server flag is enabled
- [x] Guest email is required before promotion preview
- [x] Promotion is submitted to booking API only after successful server preview
- [x] Fare card displays server-returned discounted money
- [x] Editing the promotion code clears stale preview state
- [x] Default production UI remains unchanged while flag is off

### Automated certification
- [x] Promotion database foundation verifier
- [x] Promotion redemption concurrency verifier
- [x] Promotion runtime safety verifier
- [x] Promotion idempotency unit tests
- [x] Promotion domain unit tests
- [x] Application CI includes promotion database + runtime gates

## Production gate

Keep promotion application disabled until live acceptance is complete:

```env
PROMOTION_APPLY_ENABLED=false
```

Admin promotion configuration is safe while the flag is off.

## Remaining Phase 11 work

- [ ] Add disposable promo/quote fixture for browser/API preview certification
- [ ] Add E2E: promotion preview shows exact server discount
- [ ] Add E2E: invalid/expired/wrong-scope/minimum-spend codes are rejected
- [ ] Add E2E: per-customer limit rejection
- [ ] Add E2E: discounted booking stores promotion snapshot and redemption exactly once
- [ ] Add E2E: idempotent replay does not double-increment redeemedCount
- [ ] Add package-booking customer promotion UI if/when direct package checkout is exposed publicly
- [ ] Add promotion visibility to booking detail/reporting/export
- [ ] Run live production promotion drill with a temporary limited code
- [ ] Enable PROMOTION_APPLY_ENABLED only after current Application CI + live drill pass

## Acceptance rule

Promotion configuration may be used in admin while customer application remains off.

Do not enable PROMOTION_APPLY_ENABLED until:
1. promotion preview E2E passes,
2. discounted booking/redemption E2E passes,
3. idempotent replay proves no double redemption,
4. current Application CI is green,
5. a limited live promotion drill is completed successfully.
