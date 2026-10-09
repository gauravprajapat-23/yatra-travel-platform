# Phase 19 — Monitoring / Operational Safety Status

Status: FIRST-PARTY SAFE ERROR OBSERVABILITY IMPLEMENTED — PRODUCTION LOG REVIEW PENDING

Updated: 2026-10-09

## Goal

Provide production-grade error visibility and recovery without adding a paid monitoring dependency and without leaking request bodies, headers, query tokens, customer data, or secrets into logs.

## Implemented

### Server error instrumentation
- [x] Next.js `instrumentation.ts` added
- [x] Uses stable `onRequestError` server hook
- [x] Structured JSON error event
- [x] Error name only; raw error message is not logged
- [x] Framework error digest captured when available
- [x] HTTP method captured
- [x] Request path is sanitized to pathname only
- [x] Query string / fragment removed
- [x] Route pattern/type/router kind captured
- [x] Render/revalidation context captured when provided
- [x] Deployment commit/environment included
- [x] Request headers are not logged
- [x] Request bodies are not logged
- [x] Raw request object is not serialized
- [x] Raw error object is not serialized

### User-facing recovery
- [x] Generic App Router error boundary
- [x] Raw server error message is never rendered
- [x] Safe Next.js digest/reference may be shown
- [x] Retry action available

### CI safety
- [x] Observability safety verifier
- [x] Verifier rejects raw error-message logging
- [x] Verifier rejects request header/body serialization
- [x] Verifier requires query stripping
- [x] Verifier requires safe digest usage
- [x] Application CI runs observability certification

## Production operation

The structured `next_request_error` JSON lines can be inspected in the deployment provider's server logs.

Recommended fields for incident correlation:

- `timestamp`
- `errorName`
- `digest`
- `method`
- `path`
- `routePath`
- `routeType`
- `deploymentCommit`
- `deploymentEnvironment`

Do not add raw headers, bodies, tokens, URLs with query strings, or customer-entered text to this event.

## Remaining Phase 19 work

- [ ] Deploy the newest certified commit
- [ ] Trigger one controlled non-sensitive server error in staging/test
- [ ] Confirm structured event appears in provider logs
- [ ] Confirm query strings/tokens are absent
- [ ] Confirm digest can be correlated with the user-safe error page
- [ ] Review logs during real Razorpay/Resend drills
- [ ] Decide whether managed APM/Sentry/OpenTelemetry is needed after launch usage is known

## Acceptance rule

Phase 19 code is certified when current Application CI passes with:
1. Next.js production build,
2. observability safety certification,
3. existing browser E2E.

Production observability is accepted only after a deployed runtime log drill confirms the structured event is visible and contains no sensitive request data.
