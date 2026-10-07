import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell, StatusPill } from "@/components/admin-shell";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { AdminDateTimeRange } from "@/components/admin-date-time-range";
import {
  AdminField,
  AdminFormCallout,
  AdminFormGrid,
  AdminFormSection,
} from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";
import {
  activateBookingPolicy,
  retireBookingPolicy,
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

function policyValue(
  document: unknown,
  key:
    | "cancellation"
    | "refundEligibility"
    | "rescheduling"
    | "noShow"
    | "customerResponsibilities"
    | "serviceLimitations"
    | "bookingTerms",
): string {
  if (
    typeof document !== "object" ||
    document === null ||
    Array.isArray(document)
  ) {
    return "";
  }

  const value = (document as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
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

    const rawDocument = JSON.stringify({
      cancellation: String(formData.get("cancellation") ?? "").trim(),
      refundEligibility: String(
        formData.get("refundEligibility") ?? "",
      ).trim(),
      rescheduling: String(formData.get("rescheduling") ?? "").trim(),
      noShow: String(formData.get("noShow") ?? "").trim(),
      customerResponsibilities: String(
        formData.get("customerResponsibilities") ?? "",
      ).trim(),
      serviceLimitations: String(
        formData.get("serviceLimitations") ?? "",
      ).trim(),
      bookingTerms: String(formData.get("bookingTerms") ?? "").trim(),
    });

    await updateBookingPolicyDraft({
      policyId,
      rawDocument,
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
              <AdminSubmitButton
                label="Activate This Version"
                pendingLabel="Activating…"
              />
            </form>
          ) : null}

          {policy.status === "ACTIVE" ? (
            <form action={retire}>
              <AdminSubmitButton
                className="admin-danger-button"
                label="Retire Active Version"
                pendingLabel="Retiring…"
              />
            </form>
          ) : null}
        </section>

        <section className="admin-panel admin-detail-card">
          <h2>Policy Document</h2>

          {policy.status === "DRAFT" ? (
            <form action={saveDraft}>
              <AdminFormSection
                title="Effective window"
                description="Optional dates controlling when this version is eligible after activation."
              >
                <AdminFormGrid columns={2}>
                  <AdminDateTimeRange
                    startName="effectiveFrom"
                    endName="effectiveTo"
                    startLabel="Effective from"
                    endLabel="Effective to"
                    startId="effectiveFrom"
                    endId="effectiveTo"
                    defaultStart={localDateTime(policy.effectiveFrom)}
                    defaultEnd={localDateTime(policy.effectiveTo)}
                    startHint="Leave blank for immediate eligibility after activation."
                    endHint="Optional expiry for this policy version."
                  />
                </AdminFormGrid>
              </AdminFormSection>

              <AdminFormSection
                title="Cancellation & refunds"
                description="Complete the commercial rules customers rely on before activation."
              >
                <AdminFormGrid columns={1}>
                  <AdminField label="Cancellation policy" htmlFor="cancellation">
                    <textarea
                      id="cancellation"
                      name="cancellation"
                      rows={5}
                      defaultValue={policyValue(policy.document, "cancellation")}
                    />
                  </AdminField>

                  <AdminField label="Refund eligibility" htmlFor="refundEligibility">
                    <textarea
                      id="refundEligibility"
                      name="refundEligibility"
                      rows={5}
                      defaultValue={policyValue(policy.document, "refundEligibility")}
                    />
                  </AdminField>

                  <AdminField label="Rescheduling policy" htmlFor="rescheduling">
                    <textarea
                      id="rescheduling"
                      name="rescheduling"
                      rows={5}
                      defaultValue={policyValue(policy.document, "rescheduling")}
                    />
                  </AdminField>

                  <AdminField label="No-show policy" htmlFor="noShow">
                    <textarea
                      id="noShow"
                      name="noShow"
                      rows={4}
                      defaultValue={policyValue(policy.document, "noShow")}
                    />
                  </AdminField>
                </AdminFormGrid>
              </AdminFormSection>

              <AdminFormSection
                title="Responsibilities & limitations"
                description="Define customer obligations and operational boundaries."
              >
                <AdminFormGrid columns={1}>
                  <AdminField
                    label="Customer responsibilities"
                    htmlFor="customerResponsibilities"
                  >
                    <textarea
                      id="customerResponsibilities"
                      name="customerResponsibilities"
                      rows={5}
                      defaultValue={policyValue(
                        policy.document,
                        "customerResponsibilities",
                      )}
                    />
                  </AdminField>

                  <AdminField
                    label="Service limitations"
                    htmlFor="serviceLimitations"
                  >
                    <textarea
                      id="serviceLimitations"
                      name="serviceLimitations"
                      rows={5}
                      defaultValue={policyValue(
                        policy.document,
                        "serviceLimitations",
                      )}
                    />
                  </AdminField>

                  <AdminField label="Booking terms" htmlFor="bookingTerms">
                    <textarea
                      id="bookingTerms"
                      name="bookingTerms"
                      rows={6}
                      defaultValue={policyValue(policy.document, "bookingTerms")}
                    />
                  </AdminField>
                </AdminFormGrid>

                <AdminFormCallout tone="warning" title="Activation validation">
                  Every policy section above must contain approved content before
                  this draft can be activated.
                </AdminFormCallout>
              </AdminFormSection>

              <AdminSubmitButton
                label="Save Draft Policy"
                pendingLabel="Saving Draft…"
              />
            </form>
          ) : (
            <div className="admin-policy-readonly">
              <section><h3>Cancellation</h3><p>{policyValue(policy.document, "cancellation") || "—"}</p></section>
              <section><h3>Refund eligibility</h3><p>{policyValue(policy.document, "refundEligibility") || "—"}</p></section>
              <section><h3>Rescheduling</h3><p>{policyValue(policy.document, "rescheduling") || "—"}</p></section>
              <section><h3>No-show</h3><p>{policyValue(policy.document, "noShow") || "—"}</p></section>
              <section><h3>Customer responsibilities</h3><p>{policyValue(policy.document, "customerResponsibilities") || "—"}</p></section>
              <section><h3>Service limitations</h3><p>{policyValue(policy.document, "serviceLimitations") || "—"}</p></section>
              <section><h3>Booking terms</h3><p>{policyValue(policy.document, "bookingTerms") || "—"}</p></section>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
