# Production Certification Status

Updated: 2026-10-07

## Scope

This document records the post-U5 production certification state for the YATRA travel platform. It distinguishes source-level certification from runtime/deployment readiness.

## Source-level controls now implemented

### Checkout and payments
- Car and package checkout sessions use short-lived HMAC-signed HttpOnly cookies.
- Payment-order creation is bound to the signed booking type/reference.
- Browser payment verification is bound to the same signed checkout session.
- My Trips payment resume is granted only after reference + registered-email verification.
- Payment order creation is serialized per booking.
- PostgreSQL partial unique indexes enforce one active CREATED/AUTHORIZED payment intent per car/package booking.
- Provider amount/currency/order matching remains server-authoritative.
- Captured payment confirmation is reconciled from Razorpay verification/webhooks.
- Manual paid-booking confirmation requires captured payment evidence.
- REFUND_PENDING requires a pending refund record.
- REFUNDED requires the payment ledger to be fully refunded.

### Public abuse controls
- Booking lookup is DB-backed rate limited using a one-way client-address hash.
- Quote, lead, car-booking and package-booking creation have independent DB-backed rate limits.
- Public JSON POST routes use bounded request-body parsing.
- Media metadata updates use bounded JSON parsing.
- Media uploads reject oversized declared multipart bodies before buffering and retain the 10 MB storage-layer limit.

### Admin authentication
- Admin login uses bounded JSON parsing.
- Production login is same-origin only.
- Identity limit: 8 attempts / 15 minutes.
- IP limit: 30 attempts / 15 minutes.
- Login rate-limit keys are one-way hashes.
- Failed-login audit metadata does not contain plaintext email addresses.
- Admin sessions use opaque random tokens with hashed server-side storage.
- Session creation records keyed IP hash + bounded user agent metadata.
- Production logout is same-origin only.
- Role/status reductions revoke affected sessions.
- Last active SUPER_ADMIN protections are enforced in the staff service.

### Admin authorization and operations
- Booking status, assignment and refund mutations re-check permissions server-side.
- Fleet/driver CRUD, availability and media changes are audited.
- Driver phone/license values use AES-256-GCM field encryption before persistence.
- Pricing-rule management validates scope/effective-date ambiguity before activation.
- Booking policies are versioned; active/retired versions are immutable.
- FAQ, blog taxonomy, destination/temple, CMS, media and package content operations are permission checked and audited.

### Content runtime and SEO
- Public vehicle detail pages are DB-backed.
- Vehicle primary media is DB-backed.
- Destination/package/blog SEO metadata is honored publicly.
- Published CMS pages have a generic public route.
- Sitemap is built from live published/indexable content.
- Scheduled publication has an idempotent audited publisher endpoint protected by CRON_SECRET.
- Admin settings show scheduler configuration and overdue scheduled-content count.

### HTTP hardening
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy restricts camera, microphone and geolocation.
- HSTS is enabled in production.

## CI certification gate

The GitHub Actions verification workflow must pass:
1. dependency install
2. Prisma generate
3. Prisma schema validate
4. lint
5. web typecheck
6. domain typecheck
7. providers typecheck
8. domain tests
9. provider tests
10. production build

Do not treat a Vercel deployment failure caused by account/build-rate limits as a source-code CI failure.

## Live database certification

Neon Migration Verify has successfully completed against the configured production database with:

- deterministic `npm ci` install from committed `package-lock.json`
- Prisma client generation
- Prisma schema validation
- all pending migrations deployed
- canonical role seed
- non-destructive super-admin bootstrap
- auth foundation verification
- CMS/SEO foundation verification
- fleet/driver/pricing foundation verification
- car booking foundation verification
- booking-policy foundation verification
- booking database invariant verification
- package booking foundation verification
- payment foundation verification, including one-active-payment-intent indexes
- Prisma migration status clean

This confirms the current production database schema is aligned with the repository migrations at the successful verification run.

## Runtime launch gates

Before enabling paid production traffic, verify the deployed `/api/health/launch` result and confirm:

- databaseConfigured = true
- databaseReachable = true
- checkoutSessionSigningConfigured = true
- fieldEncryptionConfigured = true
- activeVehicles > 0
- activePricingRules > 0
- activeCarBookingPolicies > 0
- activePackageBookingPolicies > 0 if package booking writes are enabled
- carBookingReady = true before enabling car booking writes
- packageBookingReady = true before enabling package booking writes
- razorpayConfigured = true before enabling payment writes
- appUrlConfigured = true
- scheduledPublisherConfigured = true if SCHEDULED content is used

## Production mutation flags

Keep these disabled until the corresponding drill passes in the deployed production environment:

- BOOKING_WRITE_ENABLED
- PACKAGE_BOOKING_WRITE_ENABLED
- PAYMENT_WRITE_ENABLED
- REFUND_WRITE_ENABLED
- MEDIA_WRITE_ENABLED

Enable one capability at a time and re-check launch health after each change.

## Required server-only configuration

- DATABASE_URL
- AUTH_SECRET (minimum 32 characters; also signs checkout sessions)
- FIELD_ENCRYPTION_KEY (base64-encoded 32-byte key)
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- RAZORPAY_WEBHOOK_SECRET
- CRON_SECRET (16+ characters) when scheduled publishing is used
- storage provider credentials when MEDIA_WRITE_ENABLED=true

Never expose these values in public runtime output, client bundles, documentation screenshots or audit metadata.

## Dependency reproducibility

A workspace-aware `package-lock.json` is committed and both Application CI and Neon Migration Verify use `npm ci`.

The lockfile generation workflow remains available as a manual maintenance tool only.

## Remaining deployment blockers

### Vercel build-rate limit
GitHub deployment status currently reports:

> Deployment rate limited — retry in 24 hours.

The source CI gate is independent of this platform/account limit. Production will not receive the newest commits until Vercel permits another deployment or the plan/build limit is changed.

### Scheduled publisher placement
The secure publisher endpoint exists at:

`GET /api/cron/publish-content`

It accepts Vercel Cron authentication through:

`Authorization: Bearer <CRON_SECRET>`

The connected Vercel account scope is not readable from this environment, so the project Root Directory cannot be certified here. Do not commit `vercel.json` blindly. Once the actual Vercel Root Directory is confirmed, add the cron config there.

For a Hobby-safe baseline, use one daily invocation. For higher plans, use a more frequent schedule appropriate to editorial scheduling precision.

## Final production drills still required

1. Apply/check all PostgreSQL migrations in production.
2. Verify launch health from the deployed production URL.
3. Razorpay test/live connectivity check.
4. Create a controlled booking and verify signed checkout session behavior.
5. Create a Razorpay order and verify duplicate clicks reuse one active provider order.
6. Capture a payment and verify booking confirmation by browser verification and webhook replay.
7. Execute a controlled refund and verify REFUND_PENDING -> REFUNDED only after processed webhook.
8. Test My Trips lookup rate limiting and secure payment resume.
9. Test admin login identity/IP throttling.
10. Test media upload type/size enforcement.
11. Test scheduled-content publication after cron is configured.
12. Review production runtime errors before enabling all write flags.

## Certification rule

The platform is source-certified only when the current main-branch CI production build succeeds.

The platform is launch-certified only after:
- the latest source is deployed,
- runtime launch health is green for the capabilities being enabled,
- the payment/refund drills pass,
- and production monitoring shows no blocking runtime errors.
