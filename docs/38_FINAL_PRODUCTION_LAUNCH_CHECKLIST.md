# Final Production Launch Checklist

Updated: 2026-10-09

This checklist is the operational handoff from source-certified code to launch-certified production.

## 0. Source certification

Required before deployment:

- [ ] Latest Application CI is green
- [ ] Latest Neon Migration Verify is green
- [ ] No pending migrations
- [ ] Production build passes
- [ ] Browser E2E passes
- [ ] Production health contract passes
- [ ] Observability safety certification passes
- [ ] Public SEO/private-route certification passes

Do not continue from an older green commit if newer main is red.

## 1. Deploy exact certified revision

Deploy the exact main commit that passed CI.

Verify deployment revision:

```bash
npm run certify:production-runtime -- \
  --url https://YOUR_DOMAIN \
  --expect-commit CERTIFIED_GIT_SHA \
  --modes core
```

Expected: PASS.

## 2. Keep all mutation flags closed initially

```env
BOOKING_WRITE_ENABLED=false
PACKAGE_BOOKING_WRITE_ENABLED=false
PAYMENT_WRITE_ENABLED=false
REFUND_WRITE_ENABLED=false
MEDIA_WRITE_ENABLED=false
CUSTOMER_AUTH_WRITE_ENABLED=false
CUSTOMER_PASSWORD_RESET_ENABLED=false
PROMOTION_APPLY_ENABLED=false
```

Do not enable multiple new write capabilities at once.

## 3. Core runtime

Verify:

- database reachable
- app URL configured
- checkout signing configured
- field encryption configured
- legal pages published
- lead forms ready

Command:

```bash
npm run certify:production-runtime -- \
  --url https://YOUR_DOMAIN \
  --expect-commit CERTIFIED_GIT_SHA \
  --modes core,crm,fleet
```

Resolve any fleet compliance blockers before dispatch use.

## 4. Customer authentication / notifications

Server-only configuration:

```env
NOTIFICATION_EMAIL_PROVIDER=resend
RESEND_API_KEY=...
NOTIFICATION_EMAIL_FROM=...
```

Provider drill:

```bash
npm run verify:resend -w @yatra/providers
```

Then verify deployed readiness:

```bash
npm run certify:production-runtime -- \
  --url https://YOUR_DOMAIN \
  --modes notifications
```

Controlled email-verification drill:
- create/test one unverified customer
- confirm delivery
- consume verification link once
- confirm replay fails
- confirm link token is carried in URL fragment and stripped client-side

Only after success:

```env
CUSTOMER_AUTH_WRITE_ENABLED=true
```

Re-run:

```bash
npm run certify:production-runtime -- \
  --url https://YOUR_DOMAIN \
  --modes customer
```

For password reset, perform a real reset-email drill first, then enable:

```env
CUSTOMER_PASSWORD_RESET_ENABLED=true
```

and verify with:

```bash
npm run certify:production-runtime -- \
  --url https://YOUR_DOMAIN \
  --modes customer \
  --require-password-reset
```

## 5. Car booking writes

Prerequisites:
- active vehicles
- active pricing rules
- active CAR_BOOKING policy
- checkout signing healthy
- test quote verified

Enable:

```env
BOOKING_WRITE_ENABLED=true
```

Then:

```bash
npm run certify:production-runtime -- \
  --url https://YOUR_DOMAIN \
  --modes car
```

Controlled drill:
- create quote
- create booking once
- replay same idempotency key
- verify one booking only
- verify stored price snapshot
- verify lookup/My Trips access rules

## 6. Package booking / departures

Prerequisites:
- active PACKAGE_BOOKING policy
- real sellable package/departure data
- capacity/inventory checked

Enable:

```env
PACKAGE_BOOKING_WRITE_ENABLED=true
```

Then:

```bash
npm run certify:production-runtime -- \
  --url https://YOUR_DOMAIN \
  --modes package \
  --require-departures
```

Controlled drill:
- quote one OPEN departure
- book within capacity
- verify reservedTravellers increments once
- replay idempotency key
- cancel controlled booking
- verify inventory releases once

## 7. Promotions

Create a tightly limited temporary production promotion:
- narrow scope
- short validity window
- max redemptions 1–2
- optional per-customer limit 1

Enable:

```env
PROMOTION_APPLY_ENABLED=true
```

Then:

```bash
npm run certify:production-runtime -- \
  --url https://YOUR_DOMAIN \
  --modes promotions
```

Controlled drill:
- preview against a real server quote
- verify server-calculated discount
- create one discounted booking
- verify immutable promotion snapshot
- verify exactly one redemption
- replay booking idempotency
- verify redeemedCount does not increment twice
- verify admin booking/report visibility

Retire/disable the temporary promotion after acceptance.

## 8. Razorpay payments

Use test credentials first.

Connectivity:

```bash
npm run verify:razorpay -w @yatra/providers
```

Temporarily enable only in the controlled environment:

```env
PAYMENT_WRITE_ENABLED=true
```

Run:

```bash
npm run certify:production-runtime -- \
  --url https://YOUR_DOMAIN \
  --modes payments
```

Perform:
- provider order creation from stored booking total
- duplicate-click/idempotency replay
- checkout capture
- callback signature verification
- provider payment fetch/reconciliation
- booking confirmation
- webhook replay

Do not enable live payment traffic until the complete test-account drill passes.

## 9. Refunds

After a captured test payment:

```env
REFUND_WRITE_ENABLED=true
```

Verify:

```bash
npm run certify:production-runtime -- \
  --url https://YOUR_DOMAIN \
  --modes payments \
  --require-refunds
```

Drill:
- request partial/full refund
- verify remaining refundable amount
- verify duplicate request protection
- verify provider refund stays pending until provider confirmation
- replay refund webhook
- verify payment/refund/booking final states

## 10. Media writes

Configure storage credentials first.

Enable:

```env
MEDIA_WRITE_ENABLED=true
```

Verify:

```bash
npm run certify:production-runtime -- \
  --url https://YOUR_DOMAIN \
  --modes media
```

Drill:
- valid image upload
- MIME/magic-byte enforcement
- size-limit rejection
- public URL access
- admin media usage

## 11. Scheduled publisher

Configure:
- CRON_SECRET
- actual Vercel project Root Directory
- cron schedule in the correct project config

Verify:

```bash
npm run certify:production-runtime -- \
  --url https://YOUR_DOMAIN \
  --modes scheduled
```

The scheduled publisher must have a recent successful heartbeat.

## 12. Observability acceptance

After deploying the certified build:
- inspect provider server logs
- confirm structured `next_request_error` JSON is visible for a controlled non-sensitive error
- verify no query string, headers, body, secrets, tokens or raw customer content appear
- confirm error digest can be correlated with the generic error page
- review logs during Razorpay/Resend drills

## 13. SEO / public UX acceptance

On the production domain verify:
- sitemap.xml uses production URLs
- robots.txt uses production sitemap URL
- public package/destination/guide metadata
- admin/account/booking/checkout/payment/my-trips pages render noindex
- invalid URL shows branded 404
- representative mobile/tablet/desktop pages do not overflow
- search crawlers are not pointed at staging/test domains

## 14. Final enablement rule

A capability is launch-approved only when:
1. its current source revision is CI-certified,
2. the same revision is deployed,
3. its readiness mode passes,
4. its live/provider drill passes,
5. logs show no blocking runtime errors,
6. then—and only then—its mutation flag remains enabled.

If any drill fails, disable only that capability's write flag, investigate, redeploy if needed, and repeat the readiness/drill sequence.
