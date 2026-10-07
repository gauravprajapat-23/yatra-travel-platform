import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminField,
  AdminForm,
  AdminFormActions,
  AdminFormAsideCard,
  AdminFormCallout,
  AdminFormGrid,
  AdminFormSection,
} from "@/components/admin-form";
import { AdminSlugFields } from "@/components/admin-slug-fields";
import { AdminTextareaField } from "@/components/admin-textarea-field";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

export default async function NewPackagePage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "package.write")) redirect("/admin/packages");

  async function createPackage(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "package.write")) {
      redirect("/admin/packages");
    }

    const db = getDb();
    const title = String(formData.get("title") ?? "").trim();
    const slug = normalizeSlug(String(formData.get("slug") ?? ""));
    const summary = String(formData.get("summary") ?? "").trim();
    const durationDays = Number(formData.get("durationDays"));
    const durationNights = Number(formData.get("durationNights"));

    if (title.length < 2 || title.length > 180) {
      throw new Error("Package title must be between 2 and 180 characters.");
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error("Slug must use lowercase letters, numbers and single hyphens.");
    }
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) {
      throw new Error("Duration days must be between 1 and 365.");
    }
    if (!Number.isInteger(durationNights) || durationNights < 0 || durationNights > durationDays) {
      throw new Error("Duration nights must be between 0 and the number of days.");
    }

    const existing = await db.tourPackage.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing) throw new Error("A package with this slug already exists.");

    const pkg = await db.$transaction(async (tx) => {
      const created = await tx.tourPackage.create({
        data: {
          slug,
          title,
          summary: summary || null,
          body: [],
          durationDays,
          durationNights,
          status: "DRAFT",
          robotsIndex: false,
          robotsFollow: false,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: currentSession.userId,
          action: "PACKAGE_CREATED",
          entityType: "TourPackage",
          entityId: created.id,
          metadata: { slug, title, durationDays, durationNights },
        },
      });

      return created;
    });

    redirect(`/admin/packages/${pkg.id}`);
  }

  return (
    <AdminShell
      active="Tours & Packages"
      title="New Package"
      subtitle="Create the package foundation first. Itinerary, destinations, pricing, media and SEO can be completed after the draft exists."
      actions={<Link className="admin-secondary-button" href="/admin/packages">← Packages</Link>}
    >
      <AdminForm
        action={createPackage}
        aside={
          <>
            <AdminFormAsideCard title="Package workflow">
              <ul>
                <li>Create the basic draft.</li>
                <li>Add destinations and itinerary.</li>
                <li>Configure price options and media.</li>
                <li>Review SEO before publishing.</li>
              </ul>
            </AdminFormAsideCard>
            <AdminFormAsideCard title="Draft safety">
              <p>New packages are created as non-indexed drafts, so incomplete content cannot appear publicly.</p>
            </AdminFormAsideCard>
          </>
        }
      >
        <AdminFormSection
          title="Package identity"
          description="The public-facing name and URL identity for this tour package."
          badge="Required"
        >
          <AdminFormGrid columns={2}>
            <AdminSlugFields
              sourceLabel="Package title"
              sourceName="title"
              sourcePlaceholder="Mahakal & Omkareshwar Spiritual Circuit"
              slugPlaceholder="ujjain-omkareshwar-3d2n"
              pathPrefix="/packages"
            />
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection
          title="Trip duration"
          description="Set the advertised duration. Detailed day-by-day itinerary is added after creation."
        >
          <AdminFormGrid columns={2}>
            <AdminField label="Duration days" htmlFor="durationDays" required>
              <input id="durationDays" type="number" name="durationDays" min={1} max={365} required />
            </AdminField>
            <AdminField label="Duration nights" htmlFor="durationNights" required>
              <input id="durationNights" type="number" name="durationNights" min={0} max={365} required />
            </AdminField>
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection
          title="Package summary"
          description="A concise internal/public summary. Rich body content is managed in the full editor."
        >
          <AdminFormGrid columns={1}>
            <AdminTextareaField
              id="summary"
              name="summary"
              label="Summary"
              maxLength={1000}
              rows={5}
              placeholder="Describe the core experience, destinations and traveller value."
              hint="Concise public summary for cards and package discovery."
            />
          </AdminFormGrid>
          <AdminFormCallout title="What happens next">
            After creation you will be redirected to the complete package editor for destinations, itinerary, pricing, hero media, publication and SEO.
          </AdminFormCallout>
        </AdminFormSection>

        <AdminFormActions
          submitLabel="Create Draft Package"
          cancelHref="/admin/packages"
          helper="Creates a safe non-indexed draft."
        />
      </AdminForm>
    </AdminShell>
  );
}
