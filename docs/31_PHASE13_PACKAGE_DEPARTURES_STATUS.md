# Phase 13 — Package Departure & Inventory Status

Status: CODE + CUSTOMER-FLOW CI CERTIFIED — FINAL CURRENT-HEAD / PRODUCTION ACCEPTANCE PENDING

Updated: 2026-10-09

## Goal

Replace free-form package travel dates with explicit sellable departures and concurrency-safe traveller inventory, while preserving legacy package quotes/bookings that do not yet reference a departure.

## Implemented

### Database foundation
- [x] PackageDepartureStatus enum
- [x] PackageDeparture model
- [x] Package → departures relation
- [x] Optional departureId + departureSnapshot on PackageQuote
- [x] Optional departureId + departureSnapshot on PackageBooking
- [x] inventoryReleasedAt marker on PackageBooking
- [x] Legacy quotes/bookings remain valid with null departureId
- [x] Unique package/start date constraint
- [x] Departure start/end window constraint
- [x] Positive capacity and non-negative reserved traveller constraints
- [x] reservedTravellers cannot exceed capacityTravellers
- [x] Sales open/close ordering constraint
- [x] Sales close cannot be after departure start
- [x] Package departure DB foundation verifier in Application CI

### Departure inventory service
- [x] Departure row locked with SELECT ... FOR UPDATE before reservation
- [x] Only OPEN departures can reserve
- [x] Sales-open / sales-close window enforced
- [x] Departure must still be in the future
- [x] Traveller capacity checked under the row lock
- [x] reservedTravellers incremented atomically
- [x] Departure automatically becomes SOLD_OUT when capacity is reached
- [x] Departure snapshot generated server-side
- [x] Inventory release is single-use via inventoryReleasedAt
- [x] SOLD_OUT departure can reopen when capacity is released and sales are still open
- [x] Serializable transaction conflicts are treated as safe booking conflicts instead of generic server errors

### Booking lifecycle integration
- [x] Package booking reserves departure inventory inside the existing serializable booking transaction
- [x] Booking travelStartAt is derived from the locked departure when departureId exists
- [x] Immutable departure snapshot stored on booking / price snapshot
- [x] CANCELLED bookings release departure inventory
- [x] FAILED bookings release departure inventory
- [x] EXPIRED bookings release departure inventory
- [x] Legacy package bookings without departureId preserve previous behavior

### Admin departure management
- [x] Audited create/update/delete service
- [x] Capacity cannot be reduced below already reserved travellers
- [x] Departure with reserved travellers cannot be cancelled casually
- [x] SOLD_OUT cannot be set while capacity remains
- [x] Delete allowed only for unused DRAFT departure
- [x] Package editor Departures tab
- [x] Status, departure dates, sales window, capacity and notes
- [x] Reserved traveller count is read-only
- [x] Quote / booking usage counts shown
- [x] Package completion checklist includes OPEN departures

### Public quote flow
- [x] POST /api/quotes/package
- [x] Rate limited and bounded JSON input
- [x] Package must be PUBLISHED
- [x] Price option must be active and belong to package
- [x] Departure must belong to package and be currently sellable
- [x] Current remaining capacity checked before quote
- [x] Traveller range validated server-side
- [x] Package price calculated from stored price option
- [x] Quote stores departureId + immutable departure snapshot
- [x] Quote does not reserve capacity
- [x] Quote expiry remains server-side
- [x] Public package DTO exposes only sellable departures with remaining capacity

### Public package UI
- [x] Package departure / price option selector
- [x] Traveller count
- [x] Per-vehicle quantity when required
- [x] Live server quote display
- [x] Capacity-recheck warning shown
- [x] Booking conversion supported when PACKAGE_BOOKING_WRITE_ENABLED=true
- [x] Existing package booking API remains the authoritative writer
- [x] Production booking creation remains disabled while PACKAGE_BOOKING_WRITE_ENABLED=false

### Concurrency
- [x] One-seat departure concurrency verifier added
- [x] Exactly one simultaneous reservation may commit
- [x] Losing reservation may be rejected by SOLD_OUT logic or PostgreSQL SERIALIZABLE conflict
- [x] Package booking maps serializable conflicts to HTTP 409 / BOOKING_CONFLICT

## Certification evidence

- Departure schema migration: Neon Migration Verify PASS
- Departure foundation + concurrency: Application CI PASS
- Customer-flow fixture, booking replay/release verifier, quote E2E, build and Playwright: Application CI 37902093310 PASS
- Production direct booking remains disabled during certification

## Production gate

Keep direct package booking writes disabled until final acceptance:

```env
PACKAGE_BOOKING_WRITE_ENABLED=false
```

Package departure configuration and package quote generation can be exercised independently while booking writes remain off.

## Remaining Phase 13 work

- [x] Full Application CI customer-flow certification — run 37902093310 PASS
- [x] Add disposable published package + price option + OPEN departure browser/API fixture
- [x] E2E: public package page shows only sellable departures
- [x] E2E: package quote derives exact stored price and departure date
- [x] E2E: quote creation does not change reservedTravellers
- [x] Service integration: booking creation increments reservedTravellers exactly once
- [x] Service integration: idempotent booking replay does not double-reserve inventory
- [x] Service integration: cancellation releases inventory exactly once
- [x] Service integration: repeated release is a no-op
- [x] Service integration: over-capacity second booking is rejected
- [x] Add departure visibility to admin booking detail/reporting/export
- [x] Add package departure promotion preview UI now that direct package checkout exists
- [ ] Final newest-head Application CI must pass after admin/report/promotion refinements
- [ ] Production acceptance drill with a small test departure
- [ ] Enable PACKAGE_BOOKING_WRITE_ENABLED only after live acceptance

## Acceptance rule

Do not enable direct package booking writes until:
1. departure foundation and concurrency gates pass,
2. quote E2E proves quote requests do not reserve inventory,
3. booking + replay E2E proves one reservation only,
4. cancellation release E2E passes,
5. browser/mobile package UI is green,
6. production acceptance drill succeeds.
