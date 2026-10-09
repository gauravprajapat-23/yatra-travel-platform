# Phase 17 — Production Runtime Certification Status

Status: CODE READINESS MODERNIZED — LIVE PROVIDER / DEPLOYMENT DRILLS PENDING

Updated: 2026-10-09

## Goal

Turn the source-certified application into a launch-certified deployment without enabling production mutations before each runtime/provider capability is proven independently.

## Modern launch health

`GET /api/health/launch` now exposes non-secret readiness signals for:

- database reachability
- app URL configuration
- checkout-session signing
- field encryption
- car/package booking policies
- active vehicles/pricing rules
- Razorpay configuration
- storage/media configuration
- scheduled publisher heartbeat
- customer-auth write state
- password-reset write state
- email notification provider configuration
- active promotions / promotion write state
- open package departures
- expired dispatch-blocking fleet compliance records
- CRM interaction/follow-up table readiness

No API keys, secrets, tokens or customer content are returned.

## Readiness CLI modes

`scripts/verify-production-readiness.mjs` supports:

- `core`
- `car`
- `package`
- `payments`
- `media`
- `scheduled`
- `customer`
- `notifications`
- `promotions`
- `fleet`
- `crm`
- `full` (legacy all-booking/payment/media/scheduler aggregate)

Optional flags:

- `--require-refunds`
- `--require-password-reset`
- `--require-departures`
- `--expect-commit <sha>`

## Production mutation policy

Keep these disabled until their dedicated live drill passes:

- `BOOKING_WRITE_ENABLED=false`
- `PACKAGE_BOOKING_WRITE_ENABLED=false`
- `PAYMENT_WRITE_ENABLED=false`
- `REFUND_WRITE_ENABLED=false`
- `MEDIA_WRITE_ENABLED=false`
- `CUSTOMER_AUTH_WRITE_ENABLED=false`
- `CUSTOMER_PASSWORD_RESET_ENABLED=false`
- `PROMOTION_APPLY_ENABLED=false`

Notification delivery should remain unconfigured until the Resend provider drill succeeds.

## Required external drills

### Deployment/runtime
- [ ] Deploy the newest certified main commit
- [ ] Run `core` readiness against the deployed URL
- [ ] Verify deployment commit matches the expected SHA
- [ ] Verify legal pages and lead forms
- [ ] Review production runtime/server errors

### Customer auth / notifications
- [ ] Configure a verified Resend sender/domain
- [ ] Configure `NOTIFICATION_EMAIL_PROVIDER=resend`
- [ ] Configure `RESEND_API_KEY`
- [ ] Configure `NOTIFICATION_EMAIL_FROM`
- [ ] Run `npm run verify:resend -w @yatra/providers`
- [ ] Verify real email-verification delivery
- [ ] Verify one-time token consumption/replay rejection in deployed runtime
- [ ] Enable customer registration only after delivery succeeds
- [ ] Enable password reset only after reset-email delivery succeeds

### Promotions
- [ ] Run readiness in `promotions` mode only after a controlled limited code exists
- [ ] Execute one real quote preview
- [ ] Create one controlled discounted booking
- [ ] Confirm one redemption row / one usage increment
- [ ] Confirm admin booking/report visibility
- [ ] Disable/retire the drill promotion after acceptance

### Fleet
- [ ] Run readiness in `fleet` mode
- [ ] Resolve all known expired dispatch-blocking documents before launch
- [ ] Perform one maintenance schedule → dispatch block → completion release drill
- [ ] Decide required-document policy for missing compliance types

### Package departures
- [ ] Create/verify real upcoming departure inventory if package bookings use departures
- [ ] Run package readiness with `--require-departures`
- [ ] Verify one capacity reservation/release drill

### Payments / refunds
- [ ] Run `npm run verify:razorpay -w @yatra/providers` using Razorpay test credentials
- [ ] Enable payment writes only in the controlled test deployment
- [ ] Create provider order from stored booking total
- [ ] Complete checkout/capture
- [ ] Verify browser callback + provider fetch reconciliation
- [ ] Replay webhook safely
- [ ] Execute partial/full refund drill
- [ ] Verify booking/payment/refund ledger transitions
- [ ] Turn payment/refund writes back off until final launch approval

## Certification rule

Source certification requires the newest Application CI and Neon migration verification to pass.

Launch certification requires:
1. the certified commit is actually deployed,
2. relevant readiness mode is green,
3. the capability-specific external drill passes,
4. no blocking production runtime errors are observed,
5. only then is that capability's mutation flag enabled.
