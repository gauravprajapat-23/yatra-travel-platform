import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const newPages = [
  "apps/web/src/app/admin/blog/new/page.tsx",
  "apps/web/src/app/admin/cms/new/page.tsx",
  "apps/web/src/app/admin/destinations/new/page.tsx",
  "apps/web/src/app/admin/drivers/new/page.tsx",
  "apps/web/src/app/admin/faq/new/page.tsx",
  "apps/web/src/app/admin/offers/new/page.tsx",
  "apps/web/src/app/admin/packages/new/page.tsx",
  "apps/web/src/app/admin/settings/booking-policies/new/page.tsx",
  "apps/web/src/app/admin/vehicles/new/page.tsx",
  "apps/web/src/app/admin/staff/new/page.tsx",
];

const actionNewPages = [];

const managedInlinePages = [
  {
    file: "apps/web/src/app/admin/blog/categories/page.tsx",
    fragments: [
      "<AdminField",
      "<AdminSubmitButton",
    ],
    label: "blog category management",
  },
  {
    file: "apps/web/src/app/admin/settings/booking-policies/[id]/page.tsx",
    fragments: [
      "<AdminFormSection",
      "<AdminSubmitButton",
      "<AdminDateTimeRange",
      "<AdminTextareaField",
    ],
    label: "booking policy version management",
  },
];

const lightweightFilterPages = [
  "apps/web/src/app/admin/packages/page.tsx",
  "apps/web/src/app/admin/vehicles/page.tsx",
  "apps/web/src/app/admin/drivers/page.tsx",
  "apps/web/src/app/admin/leads/page.tsx",
  "apps/web/src/app/admin/faq/page.tsx",
  "apps/web/src/app/admin/payments/page.tsx",
  "apps/web/src/app/admin/search/page.tsx",
  "apps/web/src/app/admin/dispatch/page.tsx",
  "apps/web/src/app/admin/dispatch/calendar/page.tsx",
  "apps/web/src/app/admin/dispatch/resources/page.tsx",
  "apps/web/src/app/admin/reports/page.tsx",
  "apps/web/src/app/admin/seo/page.tsx",
];

const tabbedEditors = [
  "apps/web/src/app/admin/bookings/[reference]/page.tsx",
  "apps/web/src/app/admin/content/[type]/[id]/page.tsx",
  "apps/web/src/app/admin/drivers/[id]/page.tsx",
  "apps/web/src/app/admin/faq/[id]/page.tsx",
  "apps/web/src/app/admin/leads/[reference]/page.tsx",
  "apps/web/src/app/admin/offers/[id]/page.tsx",
  "apps/web/src/app/admin/packages/[id]/page.tsx",
  "apps/web/src/app/admin/staff/[id]/page.tsx",
  "apps/web/src/app/admin/vehicles/[id]/page.tsx",
];

function walkAdminPages(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const pages = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      pages.push(...walkAdminPages(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name === "page.tsx") {
      pages.push(path.relative(root, fullPath).replaceAll("\\", "/"));
    }
  }

  return pages;
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function requireFragments(file, fragments) {
  const source = read(file);
  const missing = fragments.filter((fragment) => !source.includes(fragment));

  if (missing.length > 0) {
    throw new Error(
      `${file} is missing required admin form-system primitives: ${missing.join(", ")}`,
    );
  }

  return source;
}


const sharedComponents = [
  "apps/web/src/components/admin-form.tsx",
  "apps/web/src/components/admin-action-form.tsx",
  "apps/web/src/components/admin-editor-tabs.tsx",
  "apps/web/src/components/admin-submit-button.tsx",
  "apps/web/src/components/admin-confirm-submit-button.tsx",
  "apps/web/src/components/admin-danger-zone.tsx",
  "apps/web/src/components/admin-slug-fields.tsx",
  "apps/web/src/components/admin-money-field.tsx",
  "apps/web/src/components/admin-currency-field.tsx",
  "apps/web/src/components/admin-date-time-range.tsx",
  "apps/web/src/components/admin-publication-fields.tsx",
  "apps/web/src/components/admin-textarea-field.tsx",
  "apps/web/src/components/admin-text-input-field.tsx",
  "apps/web/src/components/admin-file-upload-field.tsx",
  "apps/web/src/components/admin-media-picker.tsx",
  "apps/web/src/components/admin-multi-select-cards.tsx",
  "apps/web/src/components/admin-structured-content-editor.tsx",
];

for (const file of sharedComponents) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Required admin form-system component is missing: ${file}`);
  }

  process.stdout.write(`PASS shared form component: ${file}\n`);
}

const primitiveCoverage = [
  {
    file: "apps/web/src/components/admin-shell.tsx",
    fragments: ["export function AdminPanelHeading"],
    label: "shared panel heading primitive",
  },
  {
    file: "apps/web/src/app/admin/packages/[id]/page.tsx",
    fragments: ["<AdminPanelHeading"],
    label: "package shared overview heading",
  },
  {
    file: "apps/web/src/app/admin/vehicles/[id]/page.tsx",
    fragments: ["<AdminPanelHeading"],
    label: "vehicle shared overview heading",
  },
  {
    file: "apps/web/src/app/admin/drivers/[id]/page.tsx",
    fragments: ["<AdminPanelHeading"],
    label: "driver shared overview heading",
  },
  {
    file: "apps/web/src/app/admin/staff/[id]/page.tsx",
    fragments: ["<AdminPanelHeading"],
    label: "staff shared overview heading",
  },
  {
    file: "apps/web/src/app/admin/offers/[id]/page.tsx",
    fragments: ["<AdminPanelHeading"],
    label: "pricing shared overview heading",
  },
  {
    file: "apps/web/src/app/admin/faq/[id]/page.tsx",
    fragments: ["<AdminPanelHeading"],
    label: "FAQ shared overview heading",
  },
  {
    file: "apps/web/src/app/admin/content/[type]/[id]/page.tsx",
    fragments: ["<AdminPanelHeading"],
    label: "content shared overview heading",
  },
  {
    file: "apps/web/src/components/admin-table-page.tsx",
    fragments: [
      "emptyTitle",
      "emptyMessage",
      "emptyAction",
      "admin-table-empty__action",
    ],
    label: "contextual table empty-state contract",
  },
  {
    file: "apps/web/src/app/admin/staff/[id]/page.tsx",
    fragments: ["<AdminDangerZone"],
    label: "staff destructive-action hierarchy",
  },
  {
    file: "apps/web/src/app/globals.css",
    fragments: [
      "env(safe-area-inset-bottom)",
      "-webkit-overflow-scrolling: touch",
      "min-height: 48px",
    ],
    label: "mobile safe-area and touch editor ergonomics",
  },
  {
    file: "apps/web/src/components/admin-form.tsx",
    fragments: [
      '"aria-invalid": true',
      '"aria-describedby"',
      "admin-field__error",
    ],
    label: "field-level accessibility linkage",
  },
  {
    file: "apps/web/src/components/admin-action-form.tsx",
    fragments: [
      "feedbackRef",
      "scrollIntoView",
      "prefers-reduced-motion",
      'aria-atomic="true"',
    ],
    label: "action feedback focus and live-region accessibility",
  },
  {
    file: "apps/web/src/app/admin/packages/new/page.tsx",
    fragments: ["<AdminSlugFields", "<AdminTextareaField"],
    label: "package create guided identity/content",
  },
  {
    file: "apps/web/src/app/admin/cms/new/page.tsx",
    fragments: ["<AdminSlugFields", "<AdminTextareaField"],
    label: "CMS create guided identity/content",
  },
  {
    file: "apps/web/src/app/admin/destinations/new/page.tsx",
    fragments: ["<AdminSlugFields", "<AdminTextareaField"],
    label: "destination create guided identity/content",
  },
  {
    file: "apps/web/src/app/admin/blog/new/page.tsx",
    fragments: ["<AdminSlugFields", "<AdminTextareaField"],
    label: "blog create guided identity/content",
  },
  {
    file: "apps/web/src/app/admin/offers/new/page.tsx",
    fragments: [
      "<AdminMoneyField",
      "<AdminCurrencyField",
      "<AdminDateTimeRange",
    ],
    label: "pricing create money/currency/date primitives",
  },
  {
    file: "apps/web/src/app/admin/drivers/[id]/page.tsx",
    fragments: ["<AdminMultiSelectCards", "<AdminDateTimeRange"],
    label: "driver searchable qualifications/date range",
  },
  {
    file: "apps/web/src/app/admin/vehicles/[id]/page.tsx",
    fragments: ["<AdminMediaPicker", "<AdminDateTimeRange"],
    label: "vehicle visual media/date range",
  },
  {
    file: "apps/web/src/app/admin/offers/[id]/page.tsx",
    fragments: [
      "<AdminMoneyField",
      "<AdminCurrencyField",
      "<AdminDateTimeRange",
    ],
    label: "pricing editor money/currency/date primitives",
  },
  {
    file: "apps/web/src/app/admin/packages/[id]/page.tsx",
    fragments: [
      "<AdminStructuredContentEditor",
      "<AdminMediaPicker",
      "<AdminMultiSelectCards",
      "<AdminMoneyField",
      "<AdminCurrencyField",
      "<AdminPublicationFields",
    ],
    label: "package rich editor primitives",
  },
  {
    file: "apps/web/src/app/admin/content/[type]/[id]/page.tsx",
    fragments: [
      "<AdminStructuredContentEditor",
      "<AdminMediaPicker",
      "<AdminPublicationFields",
    ],
    label: "content rich editor primitives",
  },
  {
    file: "apps/web/src/app/admin/faq/new/page.tsx",
    fragments: ["<AdminPublicationFields", "<AdminTextareaField"],
    label: "FAQ create publication/content primitives",
  },
  {
    file: "apps/web/src/app/admin/faq/[id]/page.tsx",
    fragments: ["<AdminPublicationFields", "<AdminTextareaField"],
    label: "FAQ editor publication/content primitives",
  },
  {
    file: "apps/web/src/app/admin/settings/booking-policies/new/page.tsx",
    fragments: ["<AdminDateTimeRange", "<AdminTextareaField"],
    label: "booking policy create guided policy/date primitives",
  },
  {
    file: "apps/web/src/app/admin/settings/booking-policies/[id]/page.tsx",
    fragments: ["<AdminDateTimeRange", "<AdminTextareaField"],
    label: "booking policy editor guided policy/date primitives",
  },
  {
    file: "apps/web/src/app/admin/packages/[id]/page.tsx",
    fragments: ["<AdminConfirmSubmitButton"],
    label: "package destructive-action confirmation",
  },
  {
    file: "apps/web/src/app/admin/staff/[id]/page.tsx",
    fragments: ["<AdminConfirmSubmitButton"],
    label: "staff destructive-action confirmation",
  },
  {
    file: "apps/web/src/app/admin/vehicles/[id]/page.tsx",
    fragments: ["<AdminConfirmSubmitButton"],
    label: "vehicle destructive-action confirmation",
  },
  {
    file: "apps/web/src/app/admin/drivers/[id]/page.tsx",
    fragments: ["<AdminConfirmSubmitButton"],
    label: "driver destructive-action confirmation",
  },
  {
    file: "apps/web/src/components/admin-media-manager.tsx",
    fragments: [
      "<AdminFileUploadField",
      "mediaSearch",
      "mediaFilter",
      "filteredMedia",
      "<AdminTextInputField",
      "<AdminTextareaField",
    ],
    label: "media library upload/search/metadata primitives",
  },
];

const allAdminPages = walkAdminPages(
  path.join(root, "apps/web/src/app/admin"),
);

for (const file of allAdminPages) {
  const source = read(file);

  if (source.includes("<label")) {
    throw new Error(
      `${file} contains raw <label> markup. Use AdminField/AdminCheckbox or another shared admin field primitive.`,
    );
  }
}

process.stdout.write(
  `PASS global admin raw-label audit: ${allAdminPages.length} admin pages\n`,
);

const rawSubmitAllowed = new Set(lightweightFilterPages);

for (const file of allAdminPages) {
  const source = read(file);

  if (
    /<button[^>]*type=["']submit["']/.test(source) &&
    !rawSubmitAllowed.has(file)
  ) {
    throw new Error(
      `${file} contains a raw submit button. Use AdminSubmitButton/AdminConfirmSubmitButton unless the page is an approved lightweight GET filter page.`,
    );
  }
}

process.stdout.write(
  `PASS global admin raw-submit audit: ${allAdminPages.length} admin pages, ${rawSubmitAllowed.size} lightweight GET-filter exceptions\n`,
);

for (const item of primitiveCoverage) {
  requireFragments(item.file, item.fragments);
  process.stdout.write(`PASS specialized admin form coverage: ${item.label}\n`);
}

for (const file of newPages) {
  const source = requireFragments(file, [
    "<AdminActionForm",
    "AdminActionState",
    'status: "error"',
    "<AdminFormSection",
    "<AdminFormGrid",
    "<AdminFormActions",
  ]);

  if (source.includes("<label")) {
    throw new Error(
      `${file} contains raw <label> markup. Use AdminField/AdminCheckbox instead.`,
    );
  }

  process.stdout.write(`PASS recoverable shared create form: ${file}\n`);
}

for (const file of actionNewPages) {
  const source = requireFragments(file, [
    "<AdminActionForm",
    "AdminActionState",
    'status: "error"',
    "<AdminFormSection",
    "<AdminFormGrid",
    "<AdminSubmitButton",
  ]);

  if (source.includes("<label")) {
    throw new Error(
      `${file} contains raw <label> markup. Use AdminField/AdminCheckbox instead.`,
    );
  }

  process.stdout.write(`PASS shared action create form: ${file}\n`);
}

for (const item of managedInlinePages) {
  const source = requireFragments(item.file, item.fragments);

  if (source.includes("<label")) {
    throw new Error(
      `${item.file} contains raw <label> markup. Use shared admin field primitives.`,
    );
  }

  if (/<button[^>]*type=["']submit["']/.test(source)) {
    throw new Error(
      `${item.file} contains a raw submit button. Use AdminSubmitButton or AdminConfirmSubmitButton.`,
    );
  }

  process.stdout.write(`PASS managed inline admin form: ${item.label}\n`);
}

for (const file of lightweightFilterPages) {
  const source = requireFragments(file, ["<AdminField"]);

  if (source.includes("<label")) {
    throw new Error(
      `${file} contains raw filter labels. Use AdminField while keeping the GET toolbar lightweight.`,
    );
  }

  process.stdout.write(`PASS lightweight shared filter form: ${file}\n`);
}

for (const file of tabbedEditors) {
  const source = requireFragments(file, [
    "<AdminEditorTabs",
    "admin-editor-section-stack",
  ]);

  if (source.includes("<label")) {
    throw new Error(
      `${file} contains raw <label> markup. Use shared admin field primitives.`,
    );
  }

  if (/<button[^>]*type=["']submit["']/.test(source)) {
    throw new Error(
      `${file} contains a raw submit button. Use AdminSubmitButton or AdminConfirmSubmitButton.`,
    );
  }

  process.stdout.write(`PASS tabbed editor: ${file}\n`);
}

process.stdout.write(
  `Admin form-system certification passed: ${newPages.length} recoverable shared create pages, ${tabbedEditors.length} tabbed editors, ${managedInlinePages.length} managed inline pages, ${lightweightFilterPages.length} lightweight shared filter pages, ${sharedComponents.length} shared components, ${primitiveCoverage.length} specialized primitive coverage checks.\n`,
);
