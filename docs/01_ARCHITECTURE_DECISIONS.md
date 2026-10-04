# Architecture Decisions — Phase 0

## ADR-001 Modular monolith
Use a modular monolith. Do not introduce microservices until operational metrics justify them.

## ADR-002 Server authority
The server owns price, discount, booking status, payment status, role/permission and inventory decisions.

## ADR-003 PostgreSQL
Use PostgreSQL as the system of record.

## ADR-004 Versioned schema migrations
All schema changes use migrations committed to version control. No ad hoc production schema pushes.

## ADR-005 Provider abstractions
Payments, storage, email, SMS and WhatsApp sit behind adapters/providers.

## ADR-006 Historical snapshots
Booking price, cancellation policy, package itinerary/pricing terms and relevant tax/fee values are snapshotted at confirmation.

## ADR-007 Public DTO boundary
Public APIs never serialize ORM entities directly.

## ADR-008 Guest booking
Guest booking is supported by default; account creation is not required to complete a booking.

## ADR-009 SEO routes
Destination/package/editorial routes are content-driven and SSR. Search/filter/account/private routes are non-indexable.

## ADR-010 Environment isolation
Local, test, staging and production use separate credentials/data/resources.
