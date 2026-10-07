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
  "apps/web/src/components/admin-editor-tabs.tsx",
  "apps/web/src/components/admin-submit-button.tsx",
  "apps/web/src/components/admin-slug-fields.tsx",
  "apps/web/src/components/admin-money-field.tsx",
  "apps/web/src/components/admin-currency-field.tsx",
  "apps/web/src/components/admin-date-time-range.tsx",
  "apps/web/src/components/admin-publication-fields.tsx",
  "apps/web/src/components/admin-textarea-field.tsx",
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
  `Admin form-system certification passed: ${newPages.length} shared create pages, ${actionNewPages.length} action-create pages, ${tabbedEditors.length} tabbed editors, ${sharedComponents.length} shared components.\n`,
);
