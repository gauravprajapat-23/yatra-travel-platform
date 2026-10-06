import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell, StatusPill } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";
import {
  activateBookingPolicy,
  retireBookingPolicy,
  stringifyBookingPolicyDocument,
  updateBookingPolicyDraft,
} from "@/modules/booking/booking-policy-management-service";

export const dynamic = "force-dynamic";

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "ACTIVE") return "green";
  if (status === "DRAFT") return "orange";
  return "gray";
}

function localDateTime(value: Date | null): string {
  if (!value) return "";
  return new Date(
    value.getTime() - value.getTimezoneOffset() * 60_000,
  )
    .toISOString()
    .slice(0, 16);
}

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date.");
  return date;
}

export default async function BookingPolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "settings.manage")) redirect("/admin");

  const { id } = await params;
  const db = getDb();

  const policy = await db.bookingPolicyVersion.findUnique({
    where: { id },
  });

  if (!policy) notFound();

  const policyId = policy.id;

  async function saveDraft(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "settings.manage")) {
      redirect("/admin/settings/booking-policies");
    }

    await updateBookingPolicyDraft({
      policyId,
      rawDocument: String(formData.get("document") ?? "{}"),
      effectiveFrom: parseOptionalDate(formData.get("effectiveFrom")),
      effectiveTo: parseOptionalDate(formData.get("effectiveTo")),
      actorUserId: currentSession.userId,
    });

    revalidatePath("/admin/settings/booking-policies");
    revalidatePath(`/admin/settings/booking-policies/${policyId}`);
  }

  async function activate() {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "settings.manage")) {
      redirect("/admin/settings/booking-policies");
    }

    await activateBookingPolicy({
      policyId,
      actorUserId: currentSession.userId,
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin/settings/booking-policies");
    revalidatePath(`/admin/settings/booking-policies/${policyId}`);
    revalidatePath("/api/health/launch");
  }

  async function retire() {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "settings.manage")) {
      redirect("/admin/settings/booking-policies");
    }

    await retireBookingPolicy({
      policyId,
      actorUserId: currentSession.userId,
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin/settings/booking-policies");
    revalidatePath(`/admin/settings/booking-policies/${policyId}`);
    revalidatePath("/api/health/launch");
  }

  return (
    <AdminShell
      active="Settings"
      title={`${policy.code} v${policy.version}`}
      subtitle="Versioned booking policy"
      actions={
        <Link className="admin-secondary-button" href="/admin/settings/booking-policies">
          ← Booking Policies
        </Link>
      }
    >
      <div className="admin-detail-grid">
        <section className="admin-panel admin-detail-card">
          <div className="admin-panel-heading">
            <h2>Policy Overview</h2>
            <StatusPill tone={tone(policy.status)}>
              {policy.status}
            </StatusPill>
          </div>

          <dl>
            <div><dt>Code</dt><dd>{policy.code}</dd></div>
            <div><dt>Version</dt><dd>{policy.version}</dd></div>
            <div><dt>Effective from</dt><dd>{policy.effectiveFrom?.toLocaleString("en-IN") ?? "Immediate"}</dd></div>
            <div><dt>Effective to</dt><dd>{policy.effectiveTo?.toLocaleString("en-IN") ?? "No expiry"}</dd></div>
            <div><dt>Activated</dt><dd>{policy.activatedAt?.toLocaleString("en-IN") ?? "—"}</dd></div>
            <div><dt>Retired</dt><dd>{policy.retiredAt?.toLocaleString("en-IN") ?? "—"}</dd></div>
          </dl>

          {policy.status === "DRAFT" ? (
            <form action={activate}>
              <button className="admin-primary-button" type="submit">
                Activate This Version
              </button>
            </form>
          ) : null}

          {policy.status === "ACTIVE" ? (
            <form action={retire}>
              <button className="admin-danger-button" type="submit">
                Retire Active Version
              </button>
            </form>
          ) : null}
        </section>

        <section className="admin-panel admin-detail-card">
          <h2>Policy Document</h2>

          {policy.status === "DRAFT" ? (
            <form action={saveDraft}>
              <label>
                Effective from
                <input
                  type="datetime-local"
                  name="effectiveFrom"
                  defaultValue={localDateTime(policy.effectiveFrom)}
                />
              </label>

              <label>
                Effective to
                <input
                  type="datetime-local"
                  name="effectiveTo"
                  defaultValue={localDateTime(policy.effectiveTo)}
                />
              </label>

              <label>
                Document JSON
                <textarea
                  name="document"
                  rows={28}
                  defaultValue={stringifyBookingPolicyDocument(policy.document)}
                  spellCheck={false}
                />
              </label>

              <p>
                Active and retired versions are immutable. Activation validates
                the required legal/business sections and automatically retires
                the previous active version for this code.
              </p>

              <button className="admin-secondary-button" type="submit">
                Save Draft
              </button>
            </form>
          ) : (
            <pre>{stringifyBookingPolicyDocument(policy.document)}</pre>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
