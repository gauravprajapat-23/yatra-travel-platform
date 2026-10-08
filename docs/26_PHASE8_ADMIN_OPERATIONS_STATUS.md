# Phase 8 — Admin Operations & Dispatch Status

Status: CERTIFICATION PENDING FINAL MAINTENANCE-ALERT CI

Updated: 2026-10-08

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

### Cross-chat regression hardening
- [x] Admin-wide explicit IST formatting for operational dates/timestamps
- [x] Explicit IST parsing/round-trip for pricing, content, package, FAQ, vehicle/driver availability and booking-policy date windows
- [x] Global unsaved-change guard mounted at the admin layout
- [x] Structured temple JSON fields preserve untouched object/array shape
- [x] SUPER_ADMIN hierarchy enforced server-side across staff access, invite and session-management paths
- [x] Non-super staff managers cannot grant or manage SUPER_ADMIN access in the UI
- [x] Staff-invite database/runtime certification added to normal Application CI
- [x] Razorpay webhook request-size/event-id bounds added
- [x] Payment runtime safety certification added to CI

### Browser E2E certification
- [x] Playwright 1.63.0 pinned in the repository
- [x] Desktop Chromium authentication/logout coverage
- [x] Keyboard skip-link/focus coverage
- [x] OPERATIONS role navigation and direct-route RBAC coverage
- [x] Vehicle/driver assignment and conflict filtering coverage
- [x] Booking lifecycle transition coverage
- [x] Refund-control permission visibility coverage with refund writes kept disabled
- [x] Mobile no-page-overflow checks for dispatch, bookings, reports, assignment detail and payment detail
- [x] CI browser login-rate isolation without weakening production rate limits

## Remaining Phase 8 work

### Booking operations
- [x] Add richer operational filters for departure date and assignment state
- [x] Add safe bulk operational actions where they do not weaken lifecycle validation
- [x] Improve booking timeline/event visibility
- [x] Add cancellation/refund operational summaries
- [x] Add permission-gated CSV booking export

### Dispatch
- [x] Add resource-specific schedule views for vehicles and drivers
- [x] Add explicit overlap/conflict indicators before assignment submission
- [x] Surface existing vehicle MAINTENANCE status in Dispatch; document-expiry warnings remain deferred because no vehicle-document model exists
- [x] Add configurable near-term departure alerts
- [→] Package/tour departure handoff deferred to Phase 13 because no departure/inventory model exists yet

### Dashboard and reporting
- [x] Add trend charts and date-aware operational KPIs
- [x] Add revenue/refund/booking trend views
- [x] Add route and package performance summaries
- [x] Add permission-gated CSV exports for booking operations and management reports

### Fleet operations
- [x] Improve availability calendar UX
- [→] Full service/maintenance lifecycle deferred to Phase 12; current schema exposes status only
- [→] Vehicle document-compliance lifecycle deferred to Phase 12 because no corresponding model exists

### Admin QA
- [x] Admin runtime + Playwright certification covers unauthenticated protection, authenticated login/logout, RBAC, protected routes, booking assignment/conflicts, booking lifecycle transitions, refund-control permissions and mobile operational views against migrated CI Postgres
- [x] Verify mobile table/dispatch usability, including booking operations and payment detail views
- [x] Verify keyboard/focus behavior for admin login skip navigation and labeled credential controls
- [x] Permission/audit certification covers role-permission matrix tests, login success/failure audit persistence, RBAC browser checks, lifecycle-validated booking mutations and assignment audit/timeline behavior
- [x] Final production build / CI certification for the current Phase 8 QA baseline — Application CI run 37739171347 PASS

## Deferred by data-model boundary

These items are intentionally not blockers for Phase 8 certification because their source models do not exist yet:

- Vehicle service/maintenance history and compliance documents → Phase 12 Fleet Operations Upgrade.
- Package departure dates, capacity/inventory and operations handoff → Phase 13 Package Inventory & Departure Management.

Phase 8 must not invent placeholder tables for these future domains.

## Phase 8 acceptance rule

Phase 8 is complete only when:
1. dispatch and operational views cover routine booking-to-trip execution,
2. assignments remain conflict-safe and permission checked,
3. operational actions provide clear success/failure feedback,
4. key admin workflows have automated end-to-end coverage,
5. mobile/accessibility checks pass,
6. the current main-branch Application CI production gate passes.

Do not mark Phase 8 certified while its E2E and final CI evidence are incomplete.
