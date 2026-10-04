# Phase 7 — Payments & Reconciliation Status

Status: CODE + DATABASE CERTIFIED — RAZORPAY TEST-ACCOUNT DRILL PENDING

## Implemented
- [x] PaymentProvider enum
- [x] PaymentStatus enum
- [x] RefundStatus enum
- [x] PaymentIntent ledger
- [x] Verified webhook-event inbox
- [x] Webhook provider/dedupe uniqueness
- [x] Retryable webhook reconciliation
- [x] Refund ledger
- [x] Integer minor-unit constraints
- [x] Exactly-one booking subject constraint
- [x] Payment amount constraints
- [x] Razorpay Orders API client
- [x] Razorpay payment-fetch client
- [x] Razorpay refund client
- [x] Razorpay webhook HMAC verification
- [x] Razorpay payment callback HMAC verification
- [x] Constant-time signature comparison
- [x] Razorpay test/live configuration guard
- [x] Provider signature/configuration tests
- [x] POST /api/payments/order
- [x] POST /api/payments/verify
- [x] POST /api/webhooks/razorpay
- [x] Trusted stored-order-id callback verification
- [x] Provider payment fetch + amount/currency/order verification
- [x] Captured payment → booking CONFIRMED reconciliation
- [x] PENDING_REVIEW → PENDING_PAYMENT lifecycle support
- [x] Internal booking status-transition service
- [x] Idempotent verified webhook processor
- [x] Duplicate webhook delivery handling
- [x] Failed webhook reconciliation remains retryable
- [x] Internal refund service with remaining-refundable validation
- [x] Partial/full refund ledger reconciliation
- [x] Full refund → REFUND_PENDING booking becomes REFUNDED
- [x] PAYMENT_WRITE_ENABLED safety gate
- [x] REFUND_WRITE_ENABLED safety gate
- [x] Razorpay read-only/test-mode connectivity drill script
- [x] Versioned payment database migration
- [x] Live payment foundation verifier
- [x] Provider typecheck/tests
- [x] Web/domain typechecks
- [x] Production build
- [x] Live Neon migration/status

## Certification evidence
- Latest hardened Application CI run: 37223878556 — PASS
- Payment foundation Neon Migration Verify run: 37214194312 — PASS

## Secrets
User confirmed these are configured in the protected GitHub environment:
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- RAZORPAY_WEBHOOK_SECRET

Secrets are not committed to Git and must never use NEXT_PUBLIC names.

## Remaining launch gate
The source/database integration is complete, but the real Razorpay account still needs a test-mode certification drill.

Run in an environment containing the configured Razorpay secrets:

```bash
npm run verify:razorpay -w @yatra/providers
```

Expected:
- test credentials: authentication PASS + ₹1 test-order creation PASS
- live credentials: authentication PASS and mutation drill skipped

Then complete the documented checkout/webhook/refund drill in:
- docs/23_RAZORPAY_TEST_MODE_DRILL.md

## Keep disabled until drill passes
```env
PAYMENT_WRITE_ENABLED=false
REFUND_WRITE_ENABLED=false
```

Do not enable payment/refund writes until:
1. Razorpay credential authentication passes.
2. Razorpay test account capture behavior is confirmed.
3. A test checkout verifies callback signature + provider payment fetch.
4. payment.captured webhook reconciliation is observed.
5. Duplicate webhook delivery is harmless.
6. Test refund webhook reconciliation passes.

Phase 7 may be marked fully provider-certified only after those external-provider checks pass.
