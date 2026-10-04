# Phase 7 — Payments & Reconciliation Status

Status: FOUNDATION CERTIFIED — LIVE PROVIDER ACTIONS BLOCKED ON RAZORPAY CONFIGURATION

## Implemented
- [x] PaymentProvider enum
- [x] PaymentStatus enum
- [x] RefundStatus enum
- [x] PaymentIntent ledger
- [x] Verified webhook-event inbox
- [x] Webhook provider/dedupe uniqueness
- [x] Refund ledger
- [x] Integer minor-unit constraints
- [x] Exactly-one booking subject constraint
- [x] Payment amount constraints
- [x] Razorpay webhook HMAC verification
- [x] Razorpay payment callback HMAC verification
- [x] Constant-time signature comparison
- [x] Provider signature tests
- [x] POST /api/webhooks/razorpay verified inbox
- [x] Duplicate webhook delivery handling
- [x] Versioned database migration
- [x] Live payment foundation verifier
- [x] Provider typecheck/tests
- [x] Web/domain typechecks
- [x] Production build
- [x] Live Neon migration/status

## Certification evidence
- Application CI run: 37214194402 — PASS
- Neon Migration Verify run: 37214194312 — PASS

## Deliberately not enabled
The application does not yet:
- create live Razorpay orders
- capture payments
- mark bookings paid from browser callbacks
- issue provider refunds
- mutate financial state from unsigned webhooks

## Required before live-provider implementation
Configure server-side secrets:
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- RAZORPAY_WEBHOOK_SECRET

Also confirm Razorpay account/test-mode settings, including payment capture behavior.

After credentials are configured, Phase 7 continues with:
1. provider order creation service
2. trusted order-id callback verification
3. idempotent webhook processor
4. booking/payment reconciliation
5. refund provider adapter
6. test-mode payment/refund drills

Never commit provider secrets to Git or expose them through NEXT_PUBLIC variables.
