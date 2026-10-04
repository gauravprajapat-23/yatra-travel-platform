# Phase 4 — Vehicle, Driver & Pricing Domain

## Scope
Phase 4 owns:
- vehicle classes
- vehicles
- vehicle media links
- driver profiles
- driver-to-vehicle-class qualifications
- vehicle unavailability windows
- driver unavailability windows
- configurable pricing rules
- public vehicle DTO boundary

Booking assignments are intentionally deferred until the booking domain exists.

## Pricing authority
- Browser never sends authoritative price.
- Money values use integer minor units.
- No production fares are seeded in source control.
- Pricing rules are effective-dated and server-selected.
- Rules may be PER_KM, FIXED or QUOTE_ONLY.
- A QUOTE_ONLY rule explicitly means a human/server-side quotation is required.
- Currency is a three-letter uppercase code.
- Equal-specificity/equal-priority pricing rules are treated as configuration errors, not silently resolved.

## Pricing scope precedence
More specific origin/destination rules beat wildcard rules.
Within equal specificity, higher priority wins.
Ambiguous top-ranked rules fail closed.

## Driver PII
Driver phone and licence identifiers are internal data.
The schema provides ciphertext fields rather than public plaintext fields.
Encryption/decryption keys remain server-only secrets.
Public DTOs must never include:
- driver private phone
- licence identifiers
- internal notes
- vehicle registration number

## Availability
Availability windows use half-open ranges: [startsAt, endsAt).
Invalid zero/negative windows are blocked in both domain and database layers.
Overlap detection occurs server-side before assignment.

## Fleet publishing
Only ACTIVE vehicles may be exposed through public fleet DTOs.
MAINTENANCE, INACTIVE and RETIRED vehicles are internal-only.
