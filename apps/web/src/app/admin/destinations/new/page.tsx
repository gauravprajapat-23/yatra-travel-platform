import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell } from "@/components/admin-shell";
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
      subtitle="Create a non-indexed draft, then add body, hero media, SEO and publication settings."
      actions={<Link className="admin-secondary-button" href="/admin/destinations">← Destinations</Link>}
    >
      <section className="admin-panel admin-detail-card">
        <form action={createDestination}>
          <label>
            Destination name
            <input name="name" required minLength={2} maxLength={180}/>
          </label>
          <label>
            Slug
            <input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="ujjain"/>
          </label>
          <label>
            Kind
            <select name="kind" defaultValue="CITY">
              {destinationKinds.map((kind) => (
                <option key={kind} value={kind}>{kind.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>
          <label>
            Summary
            <textarea name="summary" maxLength={700}/>
          </label>
          <button className="admin-primary-button" type="submit">Create Draft Destination</button>
        </form>
      </section>
    </AdminShell>
  );
}
