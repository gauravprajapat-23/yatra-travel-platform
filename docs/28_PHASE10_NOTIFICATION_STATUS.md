# Phase 10 — Notification System Status

Status: FOUNDATION IMPLEMENTED — PRODUCTION DELIVERY GATED

Updated: 2026-10-08

## Goal

Add real customer notification delivery for email verification and password reset without weakening customer-auth privacy, token secrecy, session security or provider boundaries.

## Implemented

### Notification data model
- [x] AuthActionToken model with hashed token storage
- [x] EMAIL_VERIFICATION and PASSWORD_RESET purposes
- [x] Single-use consumedAt / revokedAt lifecycle
- [x] Expiry indexes and per-user/purpose lookup indexes
- [x] NotificationDelivery queue/audit model
- [x] EMAIL / SMS / WHATSAPP channel-ready schema
- [x] PENDING / PROCESSING / SENT / FAILED / CANCELLED delivery states
- [x] Provider/message-id/attempt/error tracking
- [x] Versioned Prisma migration deployed through normal migration verification

### Provider abstraction
- [x] Provider-neutral NotificationProvider contract
- [x] Known notification purposes and template-data contract
- [x] Provider error classification with retryable/non-retryable semantics
- [x] Resend email provider using direct HTTPS API
- [x] No extra runtime SDK dependency
- [x] Request timeout and bounded provider responses
- [x] Known-template-only rendering
- [x] HTML escaping for action URLs and dynamic template values
- [x] Explicit provider factory: delivery fails closed unless NOTIFICATION_EMAIL_PROVIDER=resend
- [x] Resend provider unit tests
- [x] Resend connectivity drill: npm run verify:resend -w @yatra/providers

### Secure auth-action tokens
- [x] 32-byte random raw tokens
- [x] Only SHA-256 token hashes persisted
- [x] Raw token exists only in memory during issuance/delivery
- [x] New token issuance revokes previous active token for the same purpose
- [x] Transaction-safe one-time consumption
- [x] Email verification update and token consumption share one transaction
- [x] Password reset, session revocation, token consumption and audit share one transaction
- [x] Password reset revokes all existing customer sessions
- [x] Verification/reset actions are audited

### Token URL privacy
- [x] Verification and password-reset links carry tokens in URL fragments
- [x] Raw tokens are not sent in server-visible query strings
- [x] Browser removes fragment/query fallback from visible URL before mutation
- [x] E2E verification/reset tests use fragment-based links

### Customer verification
- [x] POST /api/customer-auth/verify-email
- [x] Same-origin protection in production
- [x] Bounded JSON body
- [x] Public-write rate limiting
- [x] Invalid/expired/replayed token rejection
- [x] Browser verification page
- [x] One-time verification E2E
- [x] Registration sends verification email when registration is enabled and a certified provider is configured
- [x] Generic verification-resend endpoint for unverified CUSTOMER accounts
- [x] Verification resend page/form
- [x] Anti-enumeration response for resend requests
- [x] Registration delivery failure returns a recoverable verification-pending state instead of stranding the account

### Password recovery
- [x] Password reset request endpoint behind CUSTOMER_PASSWORD_RESET_ENABLED
- [x] Anti-enumeration response for validly shaped requests
- [x] Password reset confirmation endpoint
- [x] Forgot-password and reset-password pages/forms
- [x] Login page links to password recovery
- [x] One-time reset token E2E
- [x] Reset replay rejection E2E
- [x] Previous sessions revoked after reset
- [x] Password reset tokens are rejected for disabled/non-ACTIVE accounts
- [x] CI keeps password-reset delivery disabled until provider certification

### Automated certification
- [x] Notification foundation certification runs in Application CI
- [x] Provider typecheck + provider tests
- [x] Disposable email-verification fixture
- [x] Disposable password-reset fixture
- [x] Browser verification flow
- [x] Browser password-reset flow
- [x] Registration remains disabled in CI until provider delivery certification
- [x] Read-only admin notification delivery monitor with masked destinations and dedicated RBAC

## Production gates

Keep these disabled until the real provider drill succeeds:

```env
CUSTOMER_AUTH_WRITE_ENABLED=false
CUSTOMER_PASSWORD_RESET_ENABLED=false
```

Required provider settings before enabling delivery:

```env
NOTIFICATION_EMAIL_PROVIDER=resend
RESEND_API_KEY=...
NOTIFICATION_EMAIL_FROM=...
NEXT_PUBLIC_APP_URL=https://your-production-domain
```

Then run:

```bash
npm run verify:resend -w @yatra/providers
```

Only after the provider connectivity drill passes and the production sender/domain is verified should the write flags be enabled.

## Remaining Phase 10 work

- [ ] Add real production Resend credentials / verified sender domain
- [ ] Run and record Resend connectivity certification
- [ ] Enable and certify CUSTOMER_PASSWORD_RESET_ENABLED in production
- [ ] Enable and certify CUSTOMER_AUTH_WRITE_ENABLED in production
- [ ] Run real registration -> email delivery -> verification -> sign-in drill
- [ ] Run real forgot-password -> delivery -> reset -> sign-in drill
- [ ] Add operational retry/worker processing for FAILED deliveries if asynchronous retry is required
- [x] Add read-only admin delivery monitoring with status/channel/purpose/provider filters
- [ ] Add safe retry actions only where a fresh auth token can be issued; raw auth tokens are intentionally never persisted
- [→] SMS/WhatsApp providers remain optional future channel implementations; schema/contract is ready

## Acceptance rule

Phase 10 code foundation can be certified while production delivery flags remain off.

Do not enable public registration or password-reset delivery until:
1. a real email provider is configured,
2. the verified sender/domain works,
3. the connectivity drill passes,
4. real verification and reset delivery drills pass,
5. current Application CI is green.
