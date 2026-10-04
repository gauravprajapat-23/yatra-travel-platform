# Car Booking API Contract

## POST /api/bookings/car

Creates a guest car booking from an existing server-generated quote.

The route is disabled unless:

`BOOKING_WRITE_ENABLED=true`

Even when enabled it fails closed unless an effective ACTIVE `CAR_BOOKING` policy exists.

## Header
Required:

`Idempotency-Key: <16-128 chars>`

The same key + same normalized request returns the original booking.
The same key + different request returns HTTP 409.

## JSON body
Allowed fields only:

```json
{
  "quoteId": "server-quote-id",
  "guestName": "Customer Name",
  "guestEmail": "customer@example.com"
}
```

The client does not submit:
- subtotal
- discount
- tax
- total
- currency authority
- pricing rule
- cancellation/refund terms
- policy id/version
- booking status
- vehicle assignment
- driver assignment

## Server checks
1. Booking feature flag enabled.
2. Idempotency key valid.
3. Request shape valid.
4. Existing idempotent replay checked.
5. Quote exists.
6. Quote not already consumed.
7. Quote not expired.
8. ACTIVE effective CAR_BOOKING policy exists.
9. Price snapshot copied from server quote.
10. Policy snapshot copied from server policy.
11. Booking created in serializable transaction.
12. Initial status history written.

## Initial status
Until the payment phase is integrated, newly created car bookings enter:

`PENDING_REVIEW`

They are not automatically marked paid or confirmed.

## Response
Public response contains:
- booking reference
- status
- route
- dates
- travellers
- currency
- amount components as decimal strings
- created timestamp

Internal fields such as idempotency key, policy internals, encrypted PII, pricing configuration, driver data and vehicle registration are not returned.
