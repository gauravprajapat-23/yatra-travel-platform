# Phase 15 — Reporting & BI Status

Status: IMPLEMENTED — FINAL CONSOLIDATED EXPORT CI RUNNING

Updated: 2026-10-09

## Goal

Provide management reporting that is operationally useful, currency-safe, date-scoped in IST, permission-gated, exportable, and resistant to spreadsheet injection.

## Dashboard coverage

### Booking and revenue
- [x] Car booking count
- [x] Package booking count
- [x] Total booking count
- [x] Captured payment totals grouped by currency
- [x] Processed refund totals grouped by currency
- [x] Net captured totals grouped by currency
- [x] 14-day booking trend
- [x] 14-day captured/refunded trend
- [x] IST date-range filtering

### Sales / demand
- [x] Lead count
- [x] Qualified / closed lead count
- [x] Lead conversion percentage
- [x] Top car routes by booking count
- [x] Route booked value kept currency-safe
- [x] Top packages by bookings and booked value

### Promotions
- [x] Committed promotion redemption count
- [x] Promotion savings grouped by currency
- [x] Top promotions table
- [x] Preview-only promotions excluded from reporting

### Fleet
- [x] Active vehicle count
- [x] Current vehicle utilization
- [x] Open maintenance count
- [x] Completed maintenance spend grouped by currency
- [x] Expired dispatch-blocking compliance count
- [x] Compliance expiring within 30 days

### Package departures
- [x] Upcoming OPEN / SOLD_OUT departures
- [x] Reserved traveller totals
- [x] Capacity / remaining inventory table
- [x] Booking detail and booking CSV expose departure identity/status

### CRM
- [x] Open CRM follow-up count
- [x] Overdue follow-up count
- [x] Interaction count in selected period
- [x] Aggregate reporting does not expose CRM note bodies

## Management CSV export

Endpoint:
- `GET /api/admin/reports/export`

Safeguards:
- [x] report.read permission required
- [x] IST from/to date validation
- [x] Reversed ranges rejected
- [x] Currency values exported in minor units
- [x] No unsafe cross-currency summing
- [x] Private / no-store response
- [x] Booking/package/lead/fleet/financial metrics
- [x] Promotion redemption/savings metrics
- [x] Upcoming departure inventory
- [x] CRM workload metrics
- [x] Maintenance/compliance metrics
- [x] Routes and packages breakdowns

## CSV security

- [x] Shared CSV escaping helper
- [x] Embedded quotes escaped
- [x] Commas/newlines quoted safely
- [x] Cells beginning with =, +, -, or @ are neutralized before export
- [x] Booking CSV uses the same safe helper
- [x] Management report CSV uses the same safe helper
- [x] Dedicated CSV spreadsheet-safety verification added to Application CI

## Browser certification

- [x] Report reader can request management CSV
- [x] Operations role receives 403 for management report export
- [x] Reversed IST date ranges receive 400
- [x] Browser test checks CRM / promotion / departure / fleet sections are present in export
- [x] Reports page remains in mobile admin QA

## Certification evidence

Already green:
- CRM workload reporting — Application CI 37903871723 PASS
- CRM RBAC/browser read-only queue — Application CI 37903931325 PASS
- Earlier reports trend, route/package/promotion, fleet and departure surfaces passed their respective Application CI runs.

Current consolidated export / CSV-safety commits are running at this checkpoint.

## Remaining Phase 15 work

- [ ] Final newest-head Application CI PASS including CSV safety and report export E2E
- [ ] Optional downloadable detailed CRM follow-up export if operations requests it
- [ ] Optional detailed maintenance/compliance export if operations requests it
- [ ] Production acceptance with realistic date ranges and finance reconciliation
- [ ] Confirm exported totals against Razorpay settlement/accounting workflow during production certification

## Acceptance rule

The reports dashboard and CSV export can be considered code-certified once the newest consolidated Application CI run is green.

Financial production certification still requires reconciliation against real provider transactions and must not be inferred from fixture data alone.
