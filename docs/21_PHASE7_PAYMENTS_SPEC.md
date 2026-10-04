# Phase 7 — Payments & Reconciliation

## Principles
- Server/backend is the payment source of truth.
- Browser callbacks do not confirm paid state by themselves.
- Raw card/CVV data is never stored or processed by YATRA.
- Monetary fields use integer minor units.
- Payment state is separate from booking state.
- Webhook signatures are HMAC-verified before storage/processing.
- Webhook events are deduplicated.
- Refunds are separate idempotent records.

## Models
### PaymentIntent
Links exactly one car booking or package booking to a provider order/payment.

### PaymentWebhookEvent
Stores verified provider events using a provider + dedupe-key uniqueness boundary.

### Refund
Tracks server-created refunds independently from booking cancellation state.

## Razorpay
Current integration target: Razorpay Orders API.

The provider key secret and webhook secret are server-only environment secrets.

The payment order/callback flow must use the provider order id from trusted database state when verifying the payment signature.

## Webhook inbox
POST /api/webhooks/razorpay

Behavior:
1. Require RAZORPAY_WEBHOOK_SECRET.
2. Read raw request body.
3. Validate x-razorpay-signature using HMAC SHA-256.
4. Parse JSON only after signature validation.
5. Store verified event.
6. Deduplicate repeated delivery.
7. Return success for already-stored duplicate events.

Actual financial state transitions will be implemented by a separate idempotent webhook processor.

## Live-provider blocker
No real order creation, capture, refund, or live payment status mutation is enabled until:
- RAZORPAY_KEY_ID is configured
- RAZORPAY_KEY_SECRET is configured
- RAZORPAY_WEBHOOK_SECRET is configured
- Razorpay capture/account settings are confirmed
- test-mode provider drills pass
