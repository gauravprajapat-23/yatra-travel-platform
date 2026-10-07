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

for (const file of tabbedEditors) {
  requireFragments(file, [
    "<AdminEditorTabs",
    "admin-editor-section-stack",
  ]);

  process.stdout.write(`PASS tabbed editor: ${file}\n`);
}

process.stdout.write("Admin form-system certification passed.\n");
