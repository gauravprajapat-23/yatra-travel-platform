import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminField,
  AdminFormActions,
  AdminFormAsideCard,
  AdminFormCallout,
  AdminFormGrid,
  AdminFormSection,
} from "@/components/admin-form";
import {
  AdminActionForm,
  type AdminActionState,
} from "@/components/admin-action-form";
import { requireAdminSession } from "@/lib/auth/session";
import { parseIstDateTimeLocal } from "@/lib/admin/datetime";
import { AdminDateTimeRange } from "@/components/admin-date-time-range";
import { AdminTextareaField } from "@/components/admin-textarea-field";
import {
  bookingPolicyCodes,
  createBookingPolicyDraft,
  isBookingPolicyCode,
} from "@/modules/booking/booking-policy-management-service";

export const dynamic = "force-dynamic";

export default async function NewBookingPolicyPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "settings.manage")) redirect("/admin");

  async function create(
    _previousState: AdminActionState,
    formData: FormData,
  ): Promise<AdminActionState> {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "settings.manage")) {
      redirect("/admin/settings/booking-policies");
    }

    let policyId: string;

    try {
      const code = String(formData.get("code") ?? "");
      if (!isBookingPolicyCode(code)) {
        throw new Error("Invalid booking policy code.");
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

      const policy = await createBookingPolicyDraft({
        code,
        rawDocument,
        effectiveFrom: parseIstDateTimeLocal(formData.get("effectiveFrom")),
        effectiveTo: parseIstDateTimeLocal(formData.get("effectiveTo")),
        actorUserId: currentSession.userId,
      });

      policyId = policy.id;
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to create booking policy draft.",
      };
    }

    redirect(`/admin/settings/booking-policies/${policyId}`);
  }

  return (
    <AdminShell
      active="Settings"
      title="New Booking Policy Version"
      subtitle="Create a draft policy version using guided commercial/legal sections."
      actions={
        <Link
          className="admin-secondary-button"
          href="/admin/settings/booking-policies"
        >
          ← Booking Policies
        </Link>
      }
    >
      <AdminActionForm
        action={create}
        className="admin-form"
        aside={
          <>
            <AdminFormAsideCard title="Policy lifecycle">
              <ul>
                <li>Create an editable draft.</li>
                <li>Complete all required policy sections.</li>
                <li>Review wording with the business/legal owner.</li>
                <li>Activate explicitly when approved.</li>
              </ul>
            </AdminFormAsideCard>
            <AdminFormAsideCard title="Version safety">
              <p>
                Activated versions become immutable and are snapshotted into
                new bookings for historical traceability.
              </p>
            </AdminFormAsideCard>
          </>
        }
      >
        <AdminFormSection
          title="Policy identity"
          description="Choose the booking channel and optional effective window for this new version."
          badge="Draft"
        >
          <AdminFormGrid columns={3}>
            <AdminField label="Policy code" htmlFor="code" required>
              <select id="code" name="code" defaultValue="CAR_BOOKING">
                {bookingPolicyCodes.map((code) => (
                  <option key={code} value={code}>
                    {code.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </AdminField>

            <AdminDateTimeRange
              startName="effectiveFrom"
              endName="effectiveTo"
              startLabel="Effective from"
              endLabel="Effective to"
              startId="effectiveFrom"
              endId="effectiveTo"
              startHint="Leave blank for immediate eligibility after activation."
              endHint="Optional expiry for time-bound policy versions."
            />
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection
          title="Cancellation & refunds"
          description="Define what customers can cancel, when refunds apply, and how changes are handled."
        >
          <AdminFormGrid columns={1}>
            <AdminTextareaField
                      id="cancellation"
                      name="cancellation"
                      label="Cancellation policy"
                      rows={5}
                      placeholder="Explain cancellation windows, charges and exceptions."
                    />

            <AdminTextareaField
                      id="refundEligibility"
                      name="refundEligibility"
                      label="Refund eligibility"
                      rows={5}
                      placeholder="Explain when refunds are available and any exclusions."
                    />

            <AdminTextareaField
                      id="rescheduling"
                      name="rescheduling"
                      label="Rescheduling policy"
                      rows={5}
                      placeholder="Explain date/time change rules, notice periods and charges."
                    />

            <AdminTextareaField
                      id="noShow"
                      name="noShow"
                      label="No-show policy"
                      rows={4}
                      placeholder="Explain how missed pickup/check-in is handled."
                    />
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection
          title="Responsibilities & limitations"
          description="Set customer obligations and operational boundaries clearly."
        >
          <AdminFormGrid columns={1}>
            <AdminTextareaField
                      id="customerResponsibilities"
                      name="customerResponsibilities"
                      label="Customer responsibilities"
                      rows={5}
                      placeholder="Required IDs, punctuality, accurate traveller details, conduct, etc."
                    />

            <AdminTextareaField
                      id="serviceLimitations"
                      name="serviceLimitations"
                      label="Service limitations"
                      rows={5}
                      placeholder="Weather, road restrictions, availability, force majeure and other limitations."
                    />

            <AdminTextareaField
                      id="bookingTerms"
                      name="bookingTerms"
                      label="Booking terms"
                      rows={6}
                      placeholder="General booking terms that apply to this policy version."
                    />
          </AdminFormGrid>

          <AdminFormCallout tone="warning" title="Activation validation">
            Drafts may be saved incomplete. Activation will fail until all
            required policy sections contain approved content.
          </AdminFormCallout>
        </AdminFormSection>

        <AdminFormActions
          submitLabel="Create Draft Version"
          cancelHref="/admin/settings/booking-policies"
          helper="Activation is a separate privileged action."
        />
      </AdminActionForm>
    </AdminShell>
  );
}
