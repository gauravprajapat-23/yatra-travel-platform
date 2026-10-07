# Admin Form Design System

Updated: 2026-10-07

## Goal

All YATRA back-office forms should feel like one product. New admin forms must reuse the shared form primitives instead of hand-building isolated label/input stacks.

## Core Components

### `AdminForm`
Use for full create/edit forms with one primary submit action.

Supports:
- responsive main/aside layout
- consistent vertical rhythm
- optional guidance sidebar

### `AdminFormSection`
Use to split forms into meaningful business sections.

Each section should have:
- a short title
- an optional one-sentence description
- an optional badge only when it communicates real state

Do not create one section per individual field.

### `AdminFormGrid`
Use for responsive field alignment.

- 1 column: long text, policy content, body copy
- 2 columns: most normal admin forms
- 3 columns: compact numeric/date configuration

The grid collapses responsively on smaller screens.

### `AdminField`
Use for all normal inputs, selects and textareas.

Provide:
- clear human-readable label
- `htmlFor` matching the field id
- `required` when applicable
- concise hint text when business meaning is not obvious
- `wide` for fields that should span the form grid

### `AdminCheckbox`
Use for standalone boolean choices.

Prefer this over raw checkbox labels when the setting has business meaning such as:
- featured vehicle
- air conditioned
- primary media
- publication flags

### `AdminCheckboxGrid`
Use when several boolean choices belong together.

### `AdminFormCallout`
Use only for contextual safety/help information.

Tones:
- info
- warning
- success

Do not use callouts as decoration.

### `AdminFormAsideCard`
Use for workflow/checklist/help content that should stay visible while completing a form.

### `AdminFormActions`
Use on dedicated create/edit pages.

Provides:
- Cancel navigation
- sticky action area
- pending-aware submit behavior
- double-submit prevention through `AdminSubmitButton`

### `AdminSubmitButton`
Use for server-action mutations outside `AdminFormActions`.

Every mutation that can take noticeable time should expose a pending label.

Examples:
- Save FAQ
- Save Pricing Rule
- Save SEO & Publishing
- Add Availability Block
- Save Lead Status

Do not add pending behavior to simple GET search/filter forms.

## Editor Navigation

### `AdminEditorTabs`

Use URL-driven tabs for complex editors.

Preferred pattern:

`/admin/resource/:id?tab=overview`

Benefits:
- server-rendered
- bookmarkable
- refresh-safe
- browser-navigation friendly
- no hidden client-only state
- heavy sections can stay isolated

Use tabs when an editor has multiple distinct operational concerns.

Examples:

### Package
- Overview
- Destinations
- Itinerary
- Pricing
- Content
- Media
- SEO & Publishing

### Destination / Blog / CMS
- Overview
- type-specific details
- Content
- Media
- SEO & Publishing

### Vehicle
- Overview
- Vehicle Details
- Availability
- Media

### Driver
- Overview
- Driver Details
- Availability

### Pricing Rule
- Overview
- Rule Details
- Activation

### FAQ
- Overview
- Content
- Publishing

### Staff
- Overview
- Roles & Status
- Sessions

Do not create tabs for simple forms with only one or two small sections.

## Structured Content

Use `AdminStructuredContentEditor` instead of exposing raw JSON by default.

Guided blocks include:
- paragraph
- heading
- quote
- callout
- CTA
- list
- route highlights
- itinerary summary
- image
- gallery
- FAQ group

The component still submits the existing structured JSON field, so server-side validation remains authoritative.

Advanced JSON may remain available only as an explicit advanced option.

## Media Selection

Use `AdminMediaPicker` when choosing a visual asset.

Prefer:
- thumbnail-first cards
- visible selected state
- alt text / useful label
- explicit no-image option when removal is valid

Avoid long filename-only selects when images can be previewed.

## Multi-Select

Use `AdminMultiSelectCards` for larger searchable option sets such as:
- package destinations
- driver qualifications
- future multi-entity assignments

Do not remove filtered options from the DOM if that would cause already-selected values to disappear from form submission.

## Operational Forms

Bookings, Leads, refunds, assignment and similar operational mutations should:
- keep permission checks server-side
- use compact admin cards/tabs rather than full create-page chrome
- use `AdminSubmitButton` or inline feedback forms
- show clear success/failure feedback
- preserve idempotency/financial safeguards

UI state must never be the security boundary.

## Search / Filter Forms

Search/filter toolbars are intentionally lighter than create/edit forms.

They may use the compact table-query pattern and normal GET submit button.

Do not wrap ordinary filtering in `AdminForm`.

## Login Form

Admin login follows the shared field styling but keeps a compact authentication-specific layout.

Rules:
- never prefill demo credentials
- never expose placeholder production credentials
- do not show nonfunctional remember-me controls
- provide visible pending state
- allow password visibility toggle
- keep generic credential failure messaging
- preserve server-side throttling and same-origin enforcement

## Mobile Rules

- form grids collapse to one column
- touch controls must remain comfortably tappable
- sticky actions must not cover fields
- horizontal editor tabs may scroll
- media and card selectors collapse cleanly
- no critical action should require hover

## Accessibility Rules

- every field needs an accessible label
- required state should be visible and semantic
- focus states must remain visible
- icon-only controls need `aria-label`
- selected cards should expose selection semantics
- form errors/feedback should use appropriate live/alert semantics
- do not rely on color alone for state

## Data / Security Rules

Never:
- put decrypted sensitive values into hidden fields
- leak secrets into client components
- put plaintext sensitive data in audit metadata
- trust client-provided prices/status/permissions
- use UI hiding instead of server permission checks
- bypass payment/refund ledgers with ordinary status forms

For sensitive values such as driver phone/license:
- show masked state
- leave replacement field blank by default
- preserve the existing encrypted value if blank
- encrypt replacements server-side

## New Form Checklist

Before merging a new admin form:

1. Uses shared form primitives where appropriate.
2. Has logical sections and responsive layout.
3. Labels and hints explain business meaning.
4. Primary mutation has pending feedback.
5. Cancel/back navigation is clear.
6. Server action re-checks authorization.
7. Validation is server-authoritative.
8. No secrets or sensitive defaults are exposed.
9. Mobile layout is usable.
10. Lint, typecheck, tests and production build pass.
