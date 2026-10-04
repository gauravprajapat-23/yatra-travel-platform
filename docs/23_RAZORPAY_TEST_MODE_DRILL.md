# Razorpay Test-Mode Certification Drill

## Purpose
This drill verifies the real Razorpay account configuration before payment/refund writes are enabled.

Do not run mutation drills with live credentials.

## 1. Connectivity
In an environment that already contains:
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- RAZORPAY_WEBHOOK_SECRET

run:

```bash
npm run verify:razorpay -w @yatra/providers
```

Expected:
- test key → API authentication PASS + ₹1 test-order creation PASS
- live key → API authentication PASS + mutation drill intentionally skipped

The script never prints secret values.

## 2. Dashboard capture mode
Confirm the Razorpay test account capture setting matches the application policy.

The application treats a booking as paid only after a captured payment is verified/reconciled.

## 3. Webhook configuration
Configure the application endpoint:

`POST /api/webhooks/razorpay`

Use the same secret stored as RAZORPAY_WEBHOOK_SECRET.

Enable at minimum the events used by the current processor:
- payment.authorized
- payment.captured
- payment.failed
- refund.processed
- refund.failed

## 4. Booking prerequisites
Create/configure test-only data:
- active CAR_BOOKING or PACKAGE_BOOKING policy
- valid quote
- booking moved through PENDING_REVIEW → PENDING_PAYMENT

Never seed production fares or policies merely to satisfy the drill.

## 5. Order creation
Temporarily enable in test deployment:

`PAYMENT_WRITE_ENABLED=true`

Call:

`POST /api/payments/order`

with:
- booking type
- booking reference
- Idempotency-Key header

Expected:
- order amount comes from stored booking total
- providerOrderId is persisted
- repeated same request replays the existing PaymentIntent

## 6. Checkout callback verification
After test checkout, call:

`POST /api/payments/verify`

with:
- paymentIntentId
- razorpay_payment_id
- razorpay_signature

The server must:
- load providerOrderId from Neon
- verify HMAC using RAZORPAY_KEY_SECRET
- fetch payment from Razorpay
- match order id
- match amount
- match currency
- require captured status
- mark PaymentIntent CAPTURED
- move PENDING_PAYMENT booking to CONFIRMED

## 7. Webhook replay
Replay/deliver the same verified webhook more than once.

Expected:
- provider + dedupe key prevents duplicate financial mutation
- already-processed duplicate returns success
- reconciliation failures stay retryable rather than being silently finalized

## 8. Refund
Only after payment capture:

`REFUND_WRITE_ENABLED=true`

Invoke the internal refund service from an authenticated admin operation.

Expected:
- refund cannot exceed remaining captured amount
- refund idempotency key prevents duplicate refund creation
- provider refund remains PENDING until verified webhook
- refund.processed updates the refund ledger
- partial refund → PaymentIntent PARTIALLY_REFUNDED
- full refund → PaymentIntent REFUNDED
- booking moves REFUND_PENDING → REFUNDED only after full verified refund

## 9. Finish
After the drill:
- turn PAYMENT_WRITE_ENABLED back off until launch approval
- turn REFUND_WRITE_ENABLED back off until launch approval
- retain test evidence/run IDs
- do not reuse test policies/prices as production business terms
