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

const destinationKinds = ["CITY", "TEMPLE", "NATURE", "HERITAGE", "REGION"] as const;
type DestinationKindValue = (typeof destinationKinds)[number];

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

function isDestinationKind(value: string): value is DestinationKindValue {
  return (destinationKinds as readonly string[]).includes(value);
}

export default async function NewDestinationPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.write")) redirect("/admin/destinations");

  async function createDestination(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "content.write")) {
      redirect("/admin/destinations");
    }

    const db = getDb();
    const name = String(formData.get("name") ?? "").trim();
    const slug = normalizeSlug(String(formData.get("slug") ?? ""));
    const kind = String(formData.get("kind") ?? "");
    const summary = String(formData.get("summary") ?? "").trim();

    if (name.length < 2 || name.length > 180) {
      throw new Error("Destination name must be between 2 and 180 characters.");
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error("Slug must use lowercase letters, numbers and single hyphens.");
    }
    if (!isDestinationKind(kind)) throw new Error("Invalid destination kind.");

    const existing = await db.destination.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing) throw new Error("A destination with this slug already exists.");

    const destination = await db.$transaction(async (tx) => {
      const created = await tx.destination.create({
        data: {
          slug,
          name,
          kind,
          summary: summary || null,
          body: [],
          status: "DRAFT",
          robotsIndex: false,
          robotsFollow: false,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: currentSession.userId,
          action: "DESTINATION_CREATED",
          entityType: "Destination",
          entityId: created.id,
          metadata: { slug, name, kind },
        },
      });

      return created;
    });

    redirect(`/admin/content/destination/${destination.id}`);
  }

  return (
    <AdminShell
      active="Destinations"
      title="New Destination"
      subtitle="Create a destination foundation, then complete rich content, media, SEO and publishing in the editor."
      actions={<Link className="admin-secondary-button" href="/admin/destinations">← Destinations</Link>}
    >
      <AdminForm
        action={createDestination}
        aside={
          <>
            <AdminFormAsideCard title="Destination types">
              <p>Use CITY or REGION for broad destinations, TEMPLE for pilgrimage entities, and NATURE / HERITAGE for focused discovery pages.</p>
            </AdminFormAsideCard>
            <AdminFormAsideCard title="Draft safety">
              <p>New destinations remain non-indexed drafts until their complete content and SEO are reviewed.</p>
            </AdminFormAsideCard>
          </>
        }
      >
        <AdminFormSection title="Destination identity" description="Public name, URL slug and destination category." badge="Required">
          <AdminFormGrid columns={2}>
            <AdminSlugFields
              sourceLabel="Destination name"
              sourceName="name"
              sourcePlaceholder="Ujjain"
              slugPlaceholder="ujjain"
              pathPrefix="/destinations"
            />
            <AdminField label="Kind" htmlFor="kind" required>
              <select id="kind" name="kind" defaultValue="CITY">
                {destinationKinds.map((kind) => (
                  <option key={kind} value={kind}>{kind.replaceAll("_", " ")}</option>
                ))}
              </select>
            </AdminField>
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection title="Editorial summary" description="Short overview before building the complete destination story.">
          <AdminFormGrid columns={1}>
            <AdminTextareaField
              id="summary"
              name="summary"
              label="Summary"
              maxLength={700}
              rows={5}
              placeholder="Describe why travellers visit, what makes it special and the main experience."
              hint="Short destination overview used across discovery surfaces."
            />
          </AdminFormGrid>
          <AdminFormCallout title="Next step">
            The full editor adds structured body content, hero media, SEO metadata and publication scheduling.
          </AdminFormCallout>
        </AdminFormSection>

        <AdminFormActions submitLabel="Create Draft Destination" cancelHref="/admin/destinations" helper="Creates a non-indexed destination draft." />
      </AdminForm>
    </AdminShell>
  );
}
