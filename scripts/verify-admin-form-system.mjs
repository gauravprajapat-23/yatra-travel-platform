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
];

const actionNewPages = [
  "apps/web/src/app/admin/staff/new/page.tsx",
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

for (const item of primitiveCoverage) {
  requireFragments(item.file, item.fragments);
  process.stdout.write(`PASS specialized admin form coverage: ${item.label}\n`);
}

for (const file of newPages) {
  const source = requireFragments(file, [
    "<AdminForm",
    "<AdminFormSection",
    "<AdminFormGrid",
    "<AdminFormActions",
  ]);

  if (source.includes("<label")) {
    throw new Error(
      `${file} contains raw <label> markup. Use AdminField/AdminCheckbox instead.`,
    );
  }

  process.stdout.write(`PASS shared create form: ${file}\n`);
}

for (const file of actionNewPages) {
  const source = requireFragments(file, [
    "<AdminActionForm",
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

for (const file of tabbedEditors) {
  requireFragments(file, [
    "<AdminEditorTabs",
    "admin-editor-section-stack",
  ]);

  process.stdout.write(`PASS tabbed editor: ${file}\n`);
}

process.stdout.write(
  `Admin form-system certification passed: ${newPages.length} shared create pages, ${actionNewPages.length} action-create pages, ${tabbedEditors.length} tabbed editors, ${sharedComponents.length} shared components, ${primitiveCoverage.length} specialized primitive coverage checks.\n`,
);
