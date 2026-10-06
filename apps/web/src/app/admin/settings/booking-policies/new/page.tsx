import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";
import {
  bookingPolicyCodes,
  createBookingPolicyDraft,
  isBookingPolicyCode,
} from "@/modules/booking/booking-policy-management-service";

export const dynamic = "force-dynamic";

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date.");
  return date;
}

const starterDocument = JSON.stringify(
  {
    cancellation: "",
    refundEligibility: "",
    rescheduling: "",
    noShow: "",
    customerResponsibilities: "",
    serviceLimitations: "",
    bookingTerms: "",
  },
  null,
  2,
);

export default async function NewBookingPolicyPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "settings.manage")) redirect("/admin");

  async function create(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "settings.manage")) {
      redirect("/admin/settings/booking-policies");
    }

    const code = String(formData.get("code") ?? "");
    if (!isBookingPolicyCode(code)) {
      throw new Error("Invalid booking policy code.");
    }

    const policy = await createBookingPolicyDraft({
      code,
      rawDocument: String(formData.get("document") ?? "{}"),
      effectiveFrom: parseOptionalDate(formData.get("effectiveFrom")),
      effectiveTo: parseOptionalDate(formData.get("effectiveTo")),
      actorUserId: currentSession.userId,
    });

    redirect(`/admin/settings/booking-policies/${policy.id}`);
  }

  return (
    <AdminShell
      active="Settings"
      title="New Booking Policy Version"
      subtitle="Create an editable draft. Activation is a separate privileged action."
      actions={
        <Link className="admin-secondary-button" href="/admin/settings/booking-policies">
          ← Booking Policies
        </Link>
      }
    >
      <section className="admin-panel admin-detail-card">
        <form action={create}>
          <label>
            Policy code
            <select name="code" defaultValue="CAR_BOOKING">
              {bookingPolicyCodes.map((code) => (
                <option key={code} value={code}>
                  {code.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <label>
            Effective from
            <input type="datetime-local" name="effectiveFrom"/>
          </label>

          <label>
            Effective to
            <input type="datetime-local" name="effectiveTo"/>
          </label>

          <label>
            Policy document JSON
            <textarea
              name="document"
              rows={24}
              defaultValue={starterDocument}
              spellCheck={false}
            />
          </label>

          <p>
            Drafts may be incomplete. Activation will fail until all required
            business/legal sections contain approved content.
          </p>

          <button className="admin-primary-button" type="submit">
            Create Draft Version
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
