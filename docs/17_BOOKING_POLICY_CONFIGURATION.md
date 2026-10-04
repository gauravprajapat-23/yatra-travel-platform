# Versioned Booking Policy Configuration

## Purpose
A confirmed or review-pending booking must snapshot the policy that governed it.
Policy values are business/legal configuration and are not hard-coded by the application.

## Policy code
Car bookings use:

`CAR_BOOKING`

Only one ACTIVE policy version may exist for this code at a time.

## Lifecycle
- DRAFT — editable/configurable, never used for new bookings
- ACTIVE — server may use it for new bookings
- RETIRED — historical only, never selected for new bookings

Activation must be an explicit privileged admin operation.

## Required policy document shape
The database intentionally stores JSON so commercial/legal terms can evolve without destructive schema changes.

Before activation, the admin service must validate that the document contains the organization-approved fields for topics such as:
- cancellation
- refund eligibility
- rescheduling
- no-show handling
- customer responsibilities
- service limitations
- applicable booking terms

The application does not define default percentages, fees, deadlines or legal terms.

## Effective dates
An ACTIVE policy is usable only when:
- effectiveFrom is null or <= current time
- effectiveTo is null or > current time

## Snapshot
At booking creation the server stores:
- policy id
- policy code
- policy version
- full policy document

Later policy edits/versions never alter the snapshot on an existing booking.

## Safety
- At most one ACTIVE version per policy code is enforced by PostgreSQL.
- Version must be a positive integer.
- Code is restricted to uppercase letters, digits and underscore.
- effectiveFrom must precede effectiveTo when both exist.
- No policy secret belongs inside the document.
