# Phase 5 — Car Booking Flow

## Scope
Phase 5 owns:
- server-generated car quotes
- guest/customer booking identity
- idempotent booking creation
- immutable price snapshots
- immutable policy snapshots
- booking lifecycle/status history
- vehicle/driver assignment references
- booking lookup-safe identifiers

Payments are not implemented in this phase; PENDING_PAYMENT is a lifecycle state only until the payment phase.

## Source of truth
The browser is never authoritative for:
- fare
- discount
- tax
- total
- pricing rule
- booking status
- assigned vehicle
- assigned driver

A booking is created from a server-generated quote or server-side pricing calculation.

## Quote lifecycle
- Quote money uses integer minor units.
- Quote totals must equal subtotal - discount + tax.
- Quotes expire.
- Expired quotes cannot create new bookings.
- A quote can be consumed by at most one booking.
- Price breakdown is snapshotted as structured JSON.

## Idempotency
CarBooking.idempotencyKey is unique.
Duplicate create requests with the same key must return/recover the same booking rather than create another one.

## Customer identity
A booking can belong to an authenticated customer or a guest.
Guest bookings require at least:
- name
- email

Phone is stored only as ciphertext when provided.

## Locked status lifecycle
DRAFT
→ PENDING_PAYMENT or PENDING_REVIEW
→ CONFIRMED
→ DRIVER_ASSIGNED
→ IN_PROGRESS
→ COMPLETED

Exceptional paths:
- CANCELLED
- EXPIRED
- FAILED
- REFUND_PENDING
- REFUNDED

All transitions are server validated and written to BookingStatusHistory.

## Price and policy history
Confirmed bookings retain:
- priceSnapshot
- policySnapshot

Later pricing/policy edits must never rewrite historical booking terms.

## Assignment safety
selectedVehicleId and assignedDriverId are internal operational references.
Assignment services must validate:
- active entity status
- vehicle class compatibility
- driver qualification
- no availability overlap
- no conflicting active booking

Those checks are enforced when the operations service is implemented.

## Public/customer data boundary
Never expose:
- driver private phone
- licence data
- internal notes
- booking idempotency key
- raw encrypted phone fields
- internal pricing rule configuration
