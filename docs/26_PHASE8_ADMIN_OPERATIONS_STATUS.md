# Phase 8 — Admin Operations & Dispatch Status

Status: IN PROGRESS

Updated: 2026-10-07

## Goal

Turn the existing administration surface into a complete day-to-day travel operations console without weakening the booking, payment, authorization or audit boundaries established in earlier phases.

## Implemented in Phase 8 so far

### Shared admin form system
- [x] Common admin form primitives
- [x] Responsive field grids and sections
- [x] Pending-aware mutation actions
- [x] Structured content editor
- [x] Media picker
- [x] Searchable multi-select cards
- [x] URL-driven editor tabs
- [x] Mobile touch-target normalization
- [x] Inline server-action feedback
- [x] Login form consistency and password visibility control

### Dispatch workspace
- [x] Dedicated `/admin/dispatch` operations page
- [x] Permission-gated using existing `booking.read` boundary
- [x] 7 / 14 / 30 day planning windows
- [x] Confirmed car trips needing assignment
- [x] Upcoming assigned car trips
- [x] Trips currently in progress
- [x] Vehicle availability blocks
- [x] Driver availability blocks
- [x] Driver license-expiry alerts
- [x] Active vehicle / driver counts
- [x] Links into existing booking assignment workflow
- [x] Dispatch entry in admin navigation
- [x] Dashboard dispatch-pressure metric and shortcut

Assignment writes continue to use the existing server-authoritative assignment service. The dispatch board does not bypass overlap checks, qualification checks, license validation, availability blocks or serializable assignment transactions.

## Remaining Phase 8 work

### Booking operations
- [x] Add richer operational filters for departure date and assignment state
- [ ] Add safe bulk operational actions where they do not weaken lifecycle validation
- [ ] Improve booking timeline/event visibility
- [ ] Add cancellation/refund operational summaries
- [x] Add permission-gated CSV booking export

### Dispatch
- [x] Add resource-specific schedule views for vehicles and drivers
- [x] Add explicit overlap/conflict indicators before assignment submission
- [ ] Add maintenance/document-expiry operational warnings when corresponding source data exists
- [ ] Add configurable near-term departure alerts
- [ ] Add package/tour operations handoff once package departure inventory exists

### Dashboard and reporting
- [ ] Add trend charts and date-aware operational KPIs
- [ ] Add revenue/refund/booking trend views
- [ ] Add route and package performance summaries
- [ ] Add CSV/Excel exports where operationally useful

### Fleet operations
- [ ] Improve availability calendar UX
- [ ] Add service/maintenance lifecycle if introduced in the data model
- [ ] Add document-compliance lifecycle if introduced in the data model

### Admin QA
- [ ] Add critical admin E2E coverage
- [ ] Verify mobile table/dispatch usability
- [ ] Verify keyboard/focus behavior
- [ ] Verify all Phase 8 mutations remain permission checked and audited
- [ ] Final production build / CI certification

## Phase 8 acceptance rule

Phase 8 is complete only when:
1. dispatch and operational views cover routine booking-to-trip execution,
2. assignments remain conflict-safe and permission checked,
3. operational actions provide clear success/failure feedback,
4. key admin workflows have automated end-to-end coverage,
5. mobile/accessibility checks pass,
6. the current main-branch Application CI production gate passes.

Do not mark Phase 8 certified while its E2E and final CI evidence are incomplete.
