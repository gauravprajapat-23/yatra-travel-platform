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

### `AdminActionForm`

Use for create/edit server-action forms that can return recoverable validation or business-rule errors.

Behavior:
- uses React action state
- keeps validation/service errors on the current form
- supports the same main/aside layout as `AdminForm`
- renders accessible alert/status feedback
- focuses and scrolls returned feedback into view for long forms
- keeps framework redirects outside broad recoverable-error `try/catch` blocks

All dedicated admin create pages currently use `AdminActionForm`.

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
- `error` for field-level validation feedback when a form uses recoverable action state

When `error` is present, the shared field renders an alert-style message and error styling. It also marks the child control with `aria-invalid` and links the control to the error text through `aria-describedby` when an `htmlFor`/id is available.


### `AdminSlugFields`

Use for create flows where an editor enters a title/name and a public slug.

Current uses:
- Packages
- CMS Pages
- Destinations
- Blog Posts

Behavior:
- derives a normalized lowercase slug while the source field is edited
- stops overwriting once the editor manually changes the slug
- keeps the existing server-side slug validation authoritative
- explicitly associates labels with both inputs for accessibility

Do not use auto-slug behavior when changing an existing stable public URL unless the product explicitly supports URL migration/redirects.

### `AdminMoneyField`

Use for admin monetary inputs stored in minor units server-side.

Current uses:
- Pricing Rule creation
- Pricing Rule editing
- Package price option creation/editing

Behavior:
- displays the active ISO currency beside the amount
- accepts major-unit decimal input with up to two fractional digits
- can bind to a sibling currency input through `currencyInputId`
- updates its displayed currency prefix live when that field changes

Money display is only a UX aid. Server parsing, currency validation and amount authority remain server-side.


### `AdminCurrencyField`

Use for editable ISO currency codes.

Behavior:
- keeps the value uppercase
- strips non-letter characters
- enforces a 3-letter ISO-style code
- integrates with `AdminMoneyField` through the currency input id

Current uses:
- Pricing Rule creation/editing
- Package price option creation/editing

### `AdminDateTimeRange`

Use for start/end date-time pairs.

Behavior:
- keeps the end field constrained to the selected start
- clears an end value that becomes earlier than the new start
- supports required or optional ranges
- preserves the existing field names expected by server actions

Current uses:
- Pricing Rule activation windows
- Booking Policy effective windows
- Vehicle availability blocks
- Driver availability blocks

Server-side date/order validation remains authoritative.



### `AdminTextInputField`

Use for bounded single-line text where editors should see the character budget.

Behavior:
- supports required/min/max length and normal input submission
- shows live `current/max` count
- supports hints, placeholders, autocomplete and full-width layout
- shares the same counter styles as `AdminTextareaField`

Current uses include:
- Package/content SEO titles
- Media Library alt text

As with textarea counters, only use a visible limit when the product/server contract has a real max length.

### `AdminTextareaField`

Use for bounded multi-line text where editors benefit from seeing the remaining size budget.

Behavior:
- preserves the normal textarea submission contract
- shows a live `current/max` character count
- supports required/min/max length, hints, placeholders and full-width layout
- highlights the counter when the configured limit is reached

Current uses include:
- Booking Policy guided sections
- Package summary
- CMS short description
- Destination summary
- Blog excerpt
- Package/content SEO descriptions
- FAQ question/answer
- Temple darshan notes and dress code

Only show a counter when a real product/server limit exists. Do not invent arbitrary max lengths just for UI consistency.


### `AdminPublicationFields`

Use for content workflows that combine publication status with an optional schedule date.

Behavior:
- owns the `status` and `scheduledFor` form fields
- only shows the schedule date when status is `SCHEDULED`
- requires a schedule date when scheduling is selected
- clears stale schedule values when switching back to a non-scheduled status
- keeps server-side status/date validation authoritative

Current uses:
- Package SEO & Publishing
- CMS/Blog/Destination SEO & Publishing
- FAQ create/edit publishing


### `AdminFileUploadField`

Use for admin file uploads that benefit from immediate client feedback.

Behavior:
- supports click-to-browse and drag/drop
- previews selected images
- shows filename, MIME type and human-readable size
- applies client-side accept/type and size checks
- keeps the normal file input in the submitted `FormData`
- never replaces server-side MIME/magic-byte/size validation

Current use:
- Media Library upload

The Media Library remains limited to the server-approved JPEG, PNG, WebP, GIF and PDF types with a 10 MB server-side limit.

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


### `AdminConfirmSubmitButton`

Use for destructive non-financial server actions that should require explicit confirmation.

Behavior:
- shows a browser confirmation prompt before submit
- prevents submission when the editor cancels
- disables during pending submission
- supports a pending label
- defaults to the destructive button style

Current uses:
- package itinerary day deletion
- staff invite cancellation
- staff session revocation
- vehicle availability block deletion
- vehicle media detach
- driver availability block deletion

Do not use this as the sole safeguard for financial actions such as refunds. Financial workflows must keep their dedicated server-side confirmation, authorization, idempotency and ledger protections.

## Dedicated Create-Page Coverage

Every dedicated `/admin/**/new` page currently uses the common form primitives and recoverable `AdminActionForm` state.

Create actions must:
- re-check authorization server-side before the recoverable validation block
- return an inline `AdminActionState` error for business/validation failures
- keep framework redirects outside broad `try/catch` blocks
- redirect only after a successful mutation

Current dedicated create coverage:

- Blog Post
- CMS Page
- Destination
- Driver
- FAQ
- Pricing Rule
- Package
- Booking Policy Version
- Vehicle
- Staff Invite

New dedicated create pages should not ship with raw label/input stacks or error-boundary-only validation unless there is a documented exception.

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
- sticky action bars must respect mobile safe-area insets
- horizontal editor tabs may scroll with touch momentum and contained overscroll
- media and card selectors collapse cleanly
- no critical action should require hover

## Accessibility Rules

- every field needs an accessible label
- required state should be visible and semantic
- focus states must remain visible
- icon-only controls need `aria-label`
- selected cards should expose selection semantics
- form errors/feedback should use appropriate live/alert semantics
- recoverable server-action feedback should be focusable and brought into view
- field-level errors should be linked to their controls with `aria-describedby`
- validation-feedback scrolling must respect `prefers-reduced-motion`
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
