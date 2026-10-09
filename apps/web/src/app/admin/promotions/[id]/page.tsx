import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import {
  promotionDiscountKinds,
  promotionScopes,
} from "@yatra/domain/promotions/discount";
import { AdminPanelHeading, AdminShell, StatusPill } from "@/components/admin-shell";
import {
  AdminField,
  AdminFormCallout,
  AdminFormGrid,
  AdminFormSection,
} from "@/components/admin-form";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { AdminMoneyField } from "@/components/admin-money-field";
import { AdminCurrencyField } from "@/components/admin-currency-field";
import { AdminDateTimeRange } from "@/components/admin-date-time-range";
import { requireAdminSession } from "@/lib/auth/session";
import {
  formatIstDateTimeLocal,
  parseIstDateTimeLocal,
} from "@/lib/admin/datetime";
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

function decimal(minor: bigint | null): string {
  if (minor === null) return "";
  const whole = minor / 100n;
  const fraction = (minor % 100n).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "ACTIVE") return "green";
  if (status === "DRAFT") return "orange";
  if (status === "ARCHIVED") return "red";
  return "gray";
}

export default async function PromotionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "settings.manage")) redirect("/admin");

  const { id } = await params;
  const db = getDb();
  const promotion = await db.promotion.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          redemptions: true,
          carQuotes: true,
          packageQuotes: true,
          carBookings: true,
          packageBookings: true,
        },
      },
    },
  });

  if (!promotion) notFound();

  async function save(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "settings.manage")) {
      redirect("/admin");
    }

    const status = String(formData.get("status") ?? "");
    const scope = String(formData.get("scope") ?? "");
    const discountKind = String(formData.get("discountKind") ?? "");

    if (!isPromotionStatus(status)) throw new Error("Invalid promotion status.");
    if (!isPromotionScope(scope)) throw new Error("Invalid promotion scope.");
    if (!isPromotionDiscountKind(discountKind)) {
      throw new Error("Invalid promotion discount type.");
    }

    const percentageText = String(formData.get("percentage") ?? "").trim();
    const percentageBps = percentageText
      ? Math.round(Number(percentageText) * 100)
      : null;

    await savePromotion({
      id,
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

    revalidatePath("/admin/promotions");
    revalidatePath(`/admin/promotions/${id}`);
  }

  const percentage =
    promotion.percentageBps === null
      ? ""
      : (promotion.percentageBps / 100).toString();

  return (
    <AdminShell
      active="Promotions"
      title={promotion.code}
      subtitle="Promotion configuration. Customer quote application remains gated."
      actions={
        <Link className="admin-secondary-button" href="/admin/promotions">
          ← Promotions
        </Link>
      }
    >
      <section className="admin-panel admin-detail-card">
        <AdminPanelHeading
          title="Promotion Overview"
          meta={
            <StatusPill tone={tone(promotion.status)}>
              {promotion.status}
            </StatusPill>
          }
        />
        <dl>
          <div>
            <dt>Name</dt>
            <dd>{promotion.name}</dd>
          </div>
          <div>
            <dt>Scope</dt>
            <dd>{promotion.scope}</dd>
          </div>
          <div>
            <dt>Redemptions</dt>
            <dd>
              {promotion.redeemedCount}
              {promotion.maxRedemptions === null
                ? " / Unlimited"
                : ` / ${promotion.maxRedemptions}`}
            </dd>
          </div>
          <div>
            <dt>Recorded redemption rows</dt>
            <dd>{promotion._count.redemptions}</dd>
          </div>
          <div>
            <dt>Quotes carrying promotion</dt>
            <dd>{promotion._count.carQuotes + promotion._count.packageQuotes}</dd>
          </div>
          <div>
            <dt>Bookings carrying promotion</dt>
            <dd>{promotion._count.carBookings + promotion._count.packageBookings}</dd>
          </div>
        </dl>
      </section>

      <form action={save}>
        <AdminFormSection
          title="Identity & status"
          description="Code changes are audited. Existing booking snapshots remain immutable."
        >
          <AdminFormGrid columns={2}>
            <AdminField label="Code" htmlFor="promotionCode" required>
              <input
                id="promotionCode"
                name="code"
                defaultValue={promotion.code}
                minLength={3}
                maxLength={32}
                required
              />
            </AdminField>
            <AdminField label="Name" htmlFor="promotionName" required>
              <input
                id="promotionName"
                name="name"
                defaultValue={promotion.name}
                minLength={2}
                maxLength={160}
                required
              />
            </AdminField>
            <AdminField label="Description" htmlFor="promotionDescription" wide>
              <textarea
                id="promotionDescription"
                name="description"
                defaultValue={promotion.description ?? ""}
                rows={4}
                maxLength={1000}
              />
            </AdminField>
            <AdminField label="Status" htmlFor="promotionStatus">
              <select
                id="promotionStatus"
                name="status"
                defaultValue={promotion.status}
              >
                {promotionStatuses.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Scope" htmlFor="promotionScope">
              <select
                id="promotionScope"
                name="scope"
                defaultValue={promotion.scope}
              >
                {promotionScopes.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </AdminField>
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection
          title="Discount rule"
          description="The saved rule is validated server-side before any update is accepted."
        >
          <AdminFormGrid columns={3}>
            <AdminField label="Discount type" htmlFor="discountKind">
              <select
                id="discountKind"
                name="discountKind"
                defaultValue={promotion.discountKind}
              >
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
              hint="Used only for percentage promotions."
            >
              <input
                id="promotionPercentage"
                name="percentage"
                defaultValue={percentage}
                inputMode="decimal"
              />
            </AdminField>
            <AdminCurrencyField
              id="promotionCurrency"
              name="currency"
              defaultValue={promotion.currency ?? "INR"}
            />
            <AdminMoneyField
              name="fixedAmount"
              label="Fixed discount"
              currency={promotion.currency ?? "INR"}
              currencyInputId="promotionCurrency"
              defaultValue={decimal(promotion.fixedAmountMinor)}
            />
            <AdminMoneyField
              name="maxDiscount"
              label="Maximum discount"
              currency={promotion.currency ?? "INR"}
              currencyInputId="promotionCurrency"
              defaultValue={decimal(promotion.maxDiscountMinor)}
            />
            <AdminMoneyField
              name="minSubtotal"
              label="Minimum booking subtotal"
              currency={promotion.currency ?? "INR"}
              currencyInputId="promotionCurrency"
              defaultValue={decimal(promotion.minSubtotalMinor)}
            />
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection
          title="Usage limits"
          description="Redemption counts are system-managed and cannot be edited from this page."
        >
          <AdminFormGrid columns={2}>
            <AdminField label="Maximum redemptions" htmlFor="maxRedemptions">
              <input
                id="maxRedemptions"
                name="maxRedemptions"
                type="number"
                min={1}
                defaultValue={promotion.maxRedemptions ?? ""}
              />
            </AdminField>
            <AdminField label="Per-customer limit" htmlFor="perCustomerLimit">
              <input
                id="perCustomerLimit"
                name="perCustomerLimit"
                type="number"
                min={1}
                defaultValue={promotion.perCustomerLimit ?? ""}
              />
            </AdminField>
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection
          title="Activation window"
          description="Dates are entered in India Standard Time and stored as absolute instants."
        >
          <AdminFormGrid columns={2}>
            <AdminDateTimeRange
              startName="activeFrom"
              endName="activeTo"
              startLabel="Active from"
              endLabel="Active to"
              startId="activeFrom"
              endId="activeTo"
              defaultStart={formatIstDateTimeLocal(promotion.activeFrom)}
              defaultEnd={formatIstDateTimeLocal(promotion.activeTo)}
            />
          </AdminFormGrid>

          <AdminFormCallout tone="warning" title="Quote application still disabled">
            ACTIVE only means the configuration is eligible for the future
            promotion engine. Current customer quotes remain unchanged until the
            redemption concurrency gate is certified and integrated.
          </AdminFormCallout>

          <AdminSubmitButton
            label="Save Promotion"
            pendingLabel="Saving Promotion…"
          />
        </AdminFormSection>
      </form>
    </AdminShell>
  );
}
