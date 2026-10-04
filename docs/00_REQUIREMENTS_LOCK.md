# Phase 0 — Requirements Lock

## Product goal
Build a premium, scalable Indian travel platform for chauffeur-driven long-distance cars, curated tours, temple journeys, destination content, booking operations, payments, customer self-service and admin management.

## Public capabilities
Home; fleet listing; car details; car search results; car booking; package listing; package details; destination pages; temple destination pages; offers; custom trip builder; booking checkout; payment state; booking success; booking lookup/customer area; blog listing; blog article; about; contact; FAQ; legal/policy pages.

## Admin capabilities
Admin login; dashboard; bookings; booking detail; vehicles; drivers; packages; package editor; destinations; offers; leads; customers; payments; CMS pages; blog; media library; SEO manager; staff/roles; reports; settings; audit logs.

## Roles
- Super Admin
- Owner/Admin
- Booking/Sales
- Operations
- Content/SEO
- Finance
- Read-only Auditor

## Domain boundaries
### Car operations
Vehicles, drivers, pricing, availability, route quotation, assignments.

### Tour/package operations
Packages, destinations, itinerary, package pricing, inclusions, exclusions, availability.

### Booking
Guest or authenticated booking, immutable price snapshot, lifecycle state, customer/contact data.

### Payments
Payment intent/order, webhook verification, idempotency, reconciliation, refund workflow.

### Content
CMS pages, blogs, FAQs, destinations, offers, SEO metadata, media assets.

### Operations
Leads, customers, assignments, reports, staff, permissions, audit logs.

## Locked booking lifecycle
DRAFT → PENDING_PAYMENT or PENDING_REVIEW → CONFIRMED → DRIVER_ASSIGNED → IN_PROGRESS → COMPLETED

Exceptional states: CANCELLED, EXPIRED, FAILED, REFUND_PENDING, REFUNDED.

All transitions are server validated.

## Pricing rules
- Browser is never the price source of truth.
- Money stored in integer minor units.
- Final prices are server-calculated.
- Coupons validated server-side.
- Booking stores historical price/policy snapshots.
- Package price mode supports per person, per vehicle, per group, fixed.
- Refund is a separate workflow.

## Security lock
- Server-side authorization on every mutation.
- Admin actions require explicit permissions.
- No secrets in browser or repository.
- No raw payment card/CVV handling.
- Verify payment webhooks.
- Idempotency for payment and booking critical writes.
- Public DTOs only; never expose raw DB entities.
- Private documents stored privately.
- Rate-limit sensitive endpoints.
- Audit privileged admin actions.
- Never log credentials, OTPs, tokens, private documents, or full sensitive PII.

## SEO lock
- SSR meaningful indexable content.
- Unique metadata/canonicals.
- Indexable route pages only when they contain real useful content.
- Search/filter/private/account pages are noindex.
- Avoid mass thin-route page generation.
- Structured data only when content supports it.
- No SEO ranking guarantees.

## Accessibility and motion
- Keyboard accessible navigation/forms.
- Semantic headings and landmarks.
- WCAG-oriented contrast and focus states.
- prefers-reduced-motion respected.
- Motion never blocks navigation, search, booking or checkout.

## Locked design direction
Premium Indian travel; deep forest green; warm ivory; saffron accent; warm gold; editorial display typography + geometric sans body; cinematic travel imagery; car/road journey animation language; temple/spiritual content elevated without kitsch.
