import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission } from "@yatra/domain/auth/permissions";
import {
  promotionDiscountKinds,
  promotionScopes,
} from "@yatra/domain/promotions/discount";
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
import { AdminMoneyField } from "@/components/admin-money-field";
import { AdminCurrencyField } from "@/components/admin-currency-field";
import { AdminDateTimeRange } from "@/components/admin-date-time-range";
import { requireAdminSession } from "@/lib/auth/session";
import { parseIstDateTimeLocal } from "@/lib/admin/datetime";
import {
  isPromotionDiscountKind,
  isPromotionScope,
  isPromotionStatus,
  promotionStatuses,
  savePromotion,
} from "@/modules/promotions/promotion-management-service";

export const dynamic = "force-dynamic";

function parseMinor(value: FormDataEntryValue | null): bigint | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(text)) {
    throw new Error("Money values must be positive with up to two decimals.");
  }
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
}

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isInteger(parsed)) throw new Error("Expected a whole number.");
  return parsed;
}

export default async function NewPromotionPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "settings.manage")) redirect("/admin");

  async function create(
    _previousState: AdminActionState,
    formData: FormData,
  ): Promise<AdminActionState> {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "settings.manage")) {
      redirect("/admin");
    }

    try {
      const status = String(formData.get("status") ?? "DRAFT");
      const scope = String(formData.get("scope") ?? "ALL");
      const discountKind = String(
        formData.get("discountKind") ?? "PERCENTAGE",
      );

      if (!isPromotionStatus(status)) throw new Error("Invalid promotion status.");
      if (!isPromotionScope(scope)) throw new Error("Invalid promotion scope.");
      if (!isPromotionDiscountKind(discountKind)) {
        throw new Error("Invalid promotion discount type.");
      }

      const percentageText = String(formData.get("percentage") ?? "").trim();
      const percentageBps = percentageText
        ? Math.round(Number(percentageText) * 100)
        : null;

      const promotion = await savePromotion({
        code: String(formData.get("code") ?? ""),
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        status,
        scope,
        discountKind,
        percentageBps,
        fixedAmountMinor: parseMinor(formData.get("fixedAmount")),
        currency: String(formData.get("currency") ?? "INR"),
        minSubtotalMinor: parseMinor(formData.get("minSubtotal")),
        maxDiscountMinor: parseMinor(formData.get("maxDiscount")),
        maxRedemptions: parseOptionalInt(formData.get("maxRedemptions")),
        perCustomerLimit: parseOptionalInt(formData.get("perCustomerLimit")),
        activeFrom: parseIstDateTimeLocal(formData.get("activeFrom")),
        activeTo: parseIstDateTimeLocal(formData.get("activeTo")),
        actorUserId: currentSession.userId,
      });

      redirect(`/admin/promotions/${promotion.id}`);
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error ? error.message : "Unable to create promotion.",
      };
    }
  }

  return (
    <AdminShell
      active="Promotions"
      title="New Promotion"
      subtitle="Create a promotion configuration without changing live quote totals until promotion application is certified."
      actions={
        <Link className="admin-secondary-button" href="/admin/promotions">
          ← Promotions
        </Link>
      }
    >
      <AdminActionForm
        action={create}
        className="admin-form"
        aside={
          <>
            <AdminFormAsideCard title="Activation safety">
              <p>
                DRAFT is recommended until scope, limits and dates are reviewed.
                Active configuration alone does not apply discounts to quotes yet.
              </p>
            </AdminFormAsideCard>
            <AdminFormAsideCard title="Usage safety">
              <p>
                Quote requests never consume usage. A redemption is recorded only
                when a booking is created from a discounted quote.
              </p>
            </AdminFormAsideCard>
          </>
        }
      >
        <AdminFormSection
          title="Promotion identity"
          description="Use a short normalized code customers can enter during checkout."
          badge="Required"
        >
          <AdminFormGrid columns={2}>
            <AdminField label="Code" htmlFor="promotionCode" required>
              <input
                id="promotionCode"
                name="code"
                required
                minLength={3}
                maxLength={32}
                placeholder="YATRA10"
              />
            </AdminField>
            <AdminField label="Name" htmlFor="promotionName" required>
              <input
                id="promotionName"
                name="name"
                required
                minLength={2}
                maxLength={160}
                placeholder="Welcome discount"
              />
            </AdminField>
            <AdminField label="Description" htmlFor="promotionDescription" wide>
              <textarea
                id="promotionDescription"
                name="description"
                maxLength={1000}
                rows={4}
              />
            </AdminField>
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection
          title="Discount rule"
          description="Choose the booking scope and a server-authoritative discount mode."
        >
          <AdminFormGrid columns={3}>
            <AdminField label="Scope" htmlFor="promotionScope">
              <select id="promotionScope" name="scope" defaultValue="ALL">
                {promotionScopes.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Discount type" htmlFor="discountKind">
              <select id="discountKind" name="discountKind" defaultValue="PERCENTAGE">
                {promotionDiscountKinds.map((item) => (
                  <option key={item} value={item}>
                    {item.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField
              label="Percentage"
              htmlFor="promotionPercentage"
              hint="For percentage promotions only. Example: 10 or 12.5."
            >
              <input
                id="promotionPercentage"
                name="percentage"
                inputMode="decimal"
                placeholder="10"
              />
            </AdminField>

            <AdminCurrencyField id="promotionCurrency" name="currency" defaultValue="INR" />
            <AdminMoneyField
              name="fixedAmount"
              label="Fixed discount"
              currency="INR"
              currencyInputId="promotionCurrency"
              hint="Used only for FIXED promotions."
            />
            <AdminMoneyField
              name="maxDiscount"
              label="Maximum discount"
              currency="INR"
              currencyInputId="promotionCurrency"
              hint="Optional cap, mainly useful for percentage promotions."
            />
            <AdminMoneyField
              name="minSubtotal"
              label="Minimum booking subtotal"
              currency="INR"
              currencyInputId="promotionCurrency"
            />
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection
          title="Usage limits"
          description="Limit total redemptions and optionally the number allowed per customer/email identity."
        >
          <AdminFormGrid columns={2}>
            <AdminField label="Maximum redemptions" htmlFor="maxRedemptions">
              <input id="maxRedemptions" name="maxRedemptions" type="number" min={1} />
            </AdminField>
            <AdminField label="Per-customer limit" htmlFor="perCustomerLimit">
              <input id="perCustomerLimit" name="perCustomerLimit" type="number" min={1} />
            </AdminField>
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection
          title="Activation"
          description="Control when the rule is eligible for future quote application."
        >
          <AdminFormGrid columns={3}>
            <AdminDateTimeRange
              startName="activeFrom"
              endName="activeTo"
              startLabel="Active from"
              endLabel="Active to"
              startId="activeFrom"
              endId="activeTo"
            />
            <AdminField label="Status" htmlFor="promotionStatus">
              <select id="promotionStatus" name="status" defaultValue="DRAFT">
                {promotionStatuses.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </AdminField>
          </AdminFormGrid>
          <AdminFormCallout tone="warning" title="Pricing remains gated">
            Creating or activating a promotion here does not yet modify customer
            quote totals. Quote integration will be enabled only after redemption
            concurrency and booking snapshot tests pass.
          </AdminFormCallout>
        </AdminFormSection>

        <AdminFormActions
          submitLabel="Create Promotion"
          cancelHref="/admin/promotions"
          helper="Promotion configuration is audited."
        />
      </AdminActionForm>
    </AdminShell>
  );
}
