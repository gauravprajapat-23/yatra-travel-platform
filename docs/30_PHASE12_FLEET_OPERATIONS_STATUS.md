# Phase 12 — Fleet Operations Upgrade Status

Status: CODE + CI CERTIFIED — PRODUCTION ACCEPTANCE / REQUIRED-DOCUMENT POLICY PENDING

Updated: 2026-10-09

## Goal

Upgrade fleet operations from generic availability blocks to structured maintenance, compliance-expiry tracking, dispatch alerts and assignment safety without weakening the existing booking-overlap controls.

## Implemented

### Database foundation
- [x] VehicleMaintenanceStatus enum
- [x] VehicleDocumentType enum
- [x] VehicleMaintenanceRecord model
- [x] VehicleComplianceDocument model
- [x] Maintenance record can link one-to-one to its generated availability block
- [x] Maintenance date-window DB check
- [x] Maintenance category/summary DB checks
- [x] Non-negative odometer/cost DB checks
- [x] ISO-style 3-letter currency DB check
- [x] Completion timestamp/status invariant
- [x] Compliance label/reference/date-window DB checks
- [x] Expiry and dispatch-impact indexes
- [x] Neon migration verification for fleet schema
- [x] Fleet operations foundation verifier in Application CI

### Maintenance service
- [x] Audited maintenance scheduling
- [x] Scheduling creates a linked vehicle availability block automatically
- [x] Maintenance cannot be scheduled over an active assigned trip
- [x] SCHEDULED → IN_PROGRESS lifecycle
- [x] SCHEDULED/IN_PROGRESS → COMPLETED lifecycle
- [x] Completion removes the linked availability block
- [x] SCHEDULED → CANCELLED lifecycle
- [x] Cancellation removes the linked availability block
- [x] Odometer, cost, currency, vendor and notes supported
- [x] Retired vehicles cannot receive new maintenance schedules

### Compliance service
- [x] Audited compliance document creation/update/delete
- [x] Registration, insurance, pollution certificate, permit, fitness, tax and other document types
- [x] Only final 1–4 document reference characters may be stored in the lightweight reference field
- [x] Issue/expiry validation
- [x] Per-document blocksDispatch flag
- [x] Compliance updates scoped to the owning vehicle

### Vehicle admin
- [x] Maintenance tab
- [x] Compliance tab
- [x] Maintenance history table
- [x] Schedule/start/complete/cancel controls
- [x] Compliance expiry table
- [x] Add/delete compliance controls
- [x] Existing manual availability blocks remain available separately

### Dispatch visibility
- [x] Structured maintenance windows shown on Dispatch
- [x] Dispatch-blocking compliance documents shown when expired or within 30 days
- [x] Operational alerts include maintenance and compliance counts
- [x] Existing vehicle/driver availability alerts preserved

### Assignment safety
- [x] Authoritative assignment transaction checks dispatch-blocking compliance
- [x] Required vehicle documents must remain valid through trip end
- [x] Admin assignment preview mirrors the compliance blocker
- [x] Compliance-blocked vehicles are removed from selectable candidates
- [x] Existing booking overlap, availability-block and driver-license checks preserved
- [x] E2E fixture includes an active matching vehicle with insurance expiring before trip end
- [x] E2E requires that vehicle to appear unavailable while a compliant vehicle remains assignable

## Safety rule

A vehicle is not dispatch-eligible when a compliance record has:

- `blocksDispatch = true`
- a non-null `expiresAt`
- `expiresAt <= tripEnd`

This matches the existing “driver licence valid through trip end” policy.

## Remaining Phase 12 work

- [x] Current Application CI passes with maintenance/compliance UI and assignment E2E
- [x] Add dedicated maintenance lifecycle verification (schedule → availability block → complete/cancel release)
- [x] Add compliance create/delete admin E2E
- [x] Add maintenance/compliance indicators to resource schedule/calendar
- [x] Add fleet maintenance/compliance summary to reports/export
- [ ] Decide whether missing required document types should block dispatch (currently only recorded expired documents can block)
- [ ] Add configurable required-document policy by vehicle class / operating region if needed
- [ ] Production acceptance drill with one test vehicle before relying on compliance enforcement operationally

## Certification evidence

- Fleet schema migration: Neon Migration Verify PASS
- Maintenance lifecycle gate: Application CI 37899984347 PASS
- Resource schedule/calendar fleet indicators: Application CI 37900133840 and 37900139458 PASS
- Fleet reporting/export: Application CI 37900219801 and 37900226320 PASS
- Final maintenance/compliance admin browser certification: Application CI 37900294185 PASS

## Acceptance rule

Do not consider Phase 12 fully certified until:
1. fleet DB verifier passes,
2. current Application CI is green,
3. compliance-blocked assignment E2E passes,
4. maintenance lifecycle E2E passes,
5. mobile dispatch/calendar remain usable.
