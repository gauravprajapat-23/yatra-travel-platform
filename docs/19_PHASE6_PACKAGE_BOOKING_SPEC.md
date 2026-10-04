# Phase 6 — Package Booking Flow

## Scope
Phase 6 owns:
- tour package catalog records
- package destination links
- day-by-day itinerary records
- configurable package price options
- package quotes
- guest/customer package bookings
- immutable package/price/policy snapshots
- package booking status history

## Pricing modes
Supported modes:
- PER_PERSON
- PER_VEHICLE
- PER_GROUP
- FIXED

All monetary values use integer minor units.

No production package prices are seeded in source control.

## Price option rules
- PER_PERSON quantity = traveller count
- PER_VEHICLE requires a positive vehicle count
- PER_GROUP quantity = 1
- FIXED quantity = 1
- optional min/max traveller bounds are server validated
- PER_VEHICLE options must identify a vehicle class

Discounts, taxes and other adjustments remain server-controlled configuration and are never accepted as authority from the browser.

## Booking flow
Server package quote
→ unexpired quote validation
→ effective ACTIVE PACKAGE_BOOKING policy
→ serializable transaction
→ package snapshot
→ price snapshot
→ policy snapshot
→ PENDING_REVIEW
→ later payment/confirmation phases

## Write API
POST /api/bookings/package

Required:
- Idempotency-Key header
- server quote id
- guest name
- guest email

The route remains disabled unless:

PACKAGE_BOOKING_WRITE_ENABLED=true

It also fails closed if no ACTIVE effective PACKAGE_BOOKING policy exists.

## Historical integrity
Package edits after booking must not change:
- packageSnapshot
- priceSnapshot
- policySnapshot

## SEO/publication
TourPackage uses the same ContentStatus publication rules as the CMS:
only explicit PUBLISHED records with a valid publishedAt are public/indexable.
