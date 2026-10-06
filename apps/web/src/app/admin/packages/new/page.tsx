import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell } from "@/components/admin-shell";
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
      subtitle="Create a draft package, then configure destinations, body, itinerary, pricing, hero media and SEO."
      actions={<Link className="admin-secondary-button" href="/admin/packages">← Packages</Link>}
    >
      <section className="admin-panel admin-detail-card">
        <form action={createPackage}>
          <label>
            Package title
            <input name="title" required minLength={2} maxLength={180}/>
          </label>
          <label>
            Slug
            <input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="ujjain-omkareshwar-3d2n"/>
          </label>
          <label>
            Duration days
            <input type="number" name="durationDays" min={1} max={365} required/>
          </label>
          <label>
            Duration nights
            <input type="number" name="durationNights" min={0} max={365} required/>
          </label>
          <label>
            Summary
            <textarea name="summary" maxLength={1000}/>
          </label>
          <button className="admin-primary-button" type="submit">Create Draft Package</button>
        </form>
      </section>
    </AdminShell>
  );
}
