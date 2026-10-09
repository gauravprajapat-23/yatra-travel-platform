# Phase 14 — Customer Communication & CRM Status

Status: INTERNAL CRM CODE + BROWSER BASELINE CERTIFIED — LATEST REASSIGNMENT HEAD RUNNING

Updated: 2026-10-09

## Goal

Give Booking/Sales and administrators a production-safe internal CRM workflow for leads and customers before enabling outbound communication automation.

This phase intentionally separates:
1. internal CRM history/follow-ups, which can be certified entirely in-app, from
2. outbound email/SMS/WhatsApp delivery, which must remain gated by the Phase 10 provider certification.

## Implemented

### CRM data model
- [x] CrmInteraction
- [x] CrmFollowUpTask
- [x] Interaction types: NOTE, CALL, EMAIL, SMS, WHATSAPP, OTHER
- [x] Interaction directions: INTERNAL, INBOUND, OUTBOUND
- [x] Follow-up statuses: OPEN, COMPLETED, CANCELLED
- [x] Lead-linked CRM subjects
- [x] Registered-customer-linked CRM subjects
- [x] Guest-customer email CRM subjects
- [x] Optional staff assignee
- [x] Creator/audit actor relationships
- [x] Indexed interaction/follow-up timelines

### Database safety
- [x] Every CRM record belongs to exactly one subject identity
- [x] Guest email identities must be normalized
- [x] Interaction body/subject length checks
- [x] Follow-up title/notes checks
- [x] COMPLETED follow-ups require completedAt
- [x] Non-completed follow-ups cannot carry completedAt
- [x] Foreign keys for lead/customer/creator/assignee
- [x] CRM database foundation verifier
- [x] Neon migration verification PASS

### CRM service layer
- [x] Audited interaction creation
- [x] Audited follow-up creation
- [x] Audited follow-up completion
- [x] Audited follow-up cancellation
- [x] Audited staff reassignment
- [x] Reassignment only permits active staff accounts
- [x] Closed/completed follow-ups cannot be reassigned
- [x] No external message is sent merely because an interaction is logged

### Lead workspace
- [x] CRM tab on lead detail
- [x] Recent interaction history
- [x] Log note/call/email/SMS/WhatsApp activity
- [x] Schedule follow-up in IST
- [x] Complete/cancel follow-up
- [x] Open/overdue CRM badge
- [x] Existing lead status workflow remains separate

### Customer workspace
- [x] CRM interaction history on customer detail
- [x] Registered customer uses stable user ID identity
- [x] Guest customer uses normalized email identity
- [x] Log internal interactions
- [x] Schedule follow-ups
- [x] Complete/cancel follow-ups

### Central CRM queue
- [x] /admin/crm
- [x] Open follow-ups ordered by due date
- [x] Overdue metric
- [x] Due-next-24h metric
- [x] Recent interaction feed
- [x] Links back to lead/customer subjects
- [x] Filters: All Open / My Follow-ups / Overdue / Due Next 24h
- [x] Staff reassignment for crm.write roles
- [x] Mobile admin route coverage

### RBAC
- [x] crm.read
- [x] crm.write
- [x] Super Admin / Owner Admin receive full CRM access
- [x] Booking/Sales: read + write
- [x] Operations: read-only
- [x] Auditor: read-only
- [x] Finance: no CRM access
- [x] Customer accounts: no admin CRM access
- [x] Permission regression tests
- [x] /admin/crm route-protection certification

### Reporting
- [x] Open CRM follow-up count
- [x] Overdue follow-up count
- [x] CRM interaction count for selected report period
- [x] Aggregate reporting does not expose note content

### Browser certification
- [x] Disposable CRM lead fixture created
- [x] Fixture wired into Application CI
- [x] E2E logs an interaction
- [x] E2E creates a follow-up
- [x] E2E verifies central queue visibility
- [x] E2E completes the follow-up
- [x] E2E checks read-only Operations access on central CRM queue
- [x] Prisma Client removed from lead server-action closure
- [x] Form-system shared submit controls used for follow-up mutations
- [x] CRM interaction/follow-up browser baseline PASS — Application CI 37903691606
- [ ] Final newest-head CI PASS after queue reassignment/report refinements

## Certification evidence

Already green:
- CRM schema: Neon Migration Verify PASS
- CRM migration / DB foundation: Application CI PASS
- Audited CRM service layer: Application CI PASS
- Post-Prisma-fix Application CI 37903691606 PASS, including CRM browser lifecycle, typechecks, tests, production build, admin form-system certification, route protection and Playwright.

## Outbound communication gate

CRM interaction types such as EMAIL, SMS and WHATSAPP currently record activity only.

They do **not** send external messages.

Do not add automatic outbound delivery until Phase 10 notification production certification is complete.

Remaining external dependency:
- real Resend credential/sender-domain connectivity drill for email
- provider decision/certification for SMS
- provider decision/certification for WhatsApp

## Remaining Phase 14 work

- [ ] Final newest-head Application CI / Playwright PASS
- [ ] E2E staff reassignment
- [ ] Optional assignee filter beyond “My Follow-ups”
- [ ] CRM activity export if operationally required
- [ ] Link outbound email actions to NotificationDelivery after provider certification
- [ ] Add SMS provider only after provider/security decision
- [ ] Add WhatsApp provider only after provider/security decision
- [ ] Production acceptance with real sales staff workflow

## Acceptance rule

Internal CRM may be used once current-head CI is green.

Outbound communication must stay disabled until each external provider is separately configured and certified.
