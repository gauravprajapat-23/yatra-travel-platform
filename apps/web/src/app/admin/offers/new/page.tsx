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
import { AdminMoneyField } from "@/components/admin-money-field";
import { AdminCurrencyField } from "@/components/admin-currency-field";
import { AdminDateTimeRange } from "@/components/admin-date-time-range";
import { requireAdminSession } from "@/lib/auth/session";
import {
  isPricingBasis,
  isPricingRuleStatus,
  isTripType,
  pricingBases,
  pricingRuleStatuses,
  savePricingRule,
  tripTypes,
} from "@/modules/pricing/pricing-rule-management-service";

export const dynamic = "force-dynamic";

function parseMinor(value: FormDataEntryValue | null): bigint | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(text)) {
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

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid date.");
  return parsed;
}

export default async function NewPricingRulePage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "settings.manage")) redirect("/admin/offers");

  const db = getDb();
  const classes = await db.vehicleClass.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  async function create(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "settings.manage")) {
      redirect("/admin/offers");
    }

    const tripType = String(formData.get("tripType") ?? "");
    const basis = String(formData.get("basis") ?? "");
    const status = String(formData.get("status") ?? "DRAFT");

    if (!isTripType(tripType)) throw new Error("Invalid trip type.");
    if (!isPricingBasis(basis)) throw new Error("Invalid pricing basis.");
    if (!isPricingRuleStatus(status)) throw new Error("Invalid pricing rule status.");

    const rule = await savePricingRule({
      name: String(formData.get("name") ?? ""),
      vehicleClassId: String(formData.get("vehicleClassId") ?? ""),
      tripType,
      basis,
      currency: String(formData.get("currency") ?? "INR"),
      baseAmountMinor: parseMinor(formData.get("baseAmount")),
      perKmMinor: parseMinor(formData.get("perKm")),
      minimumDistanceKm: parseOptionalInt(formData.get("minimumDistanceKm")),
      driverAllowancePerDayMinor: parseMinor(formData.get("driverAllowancePerDay")),
      nightAllowanceMinor: parseMinor(formData.get("nightAllowance")),
      originKey: String(formData.get("originKey") ?? ""),
      destinationKey: String(formData.get("destinationKey") ?? ""),
      priority: Number(formData.get("priority") ?? 0),
      status,
      activeFrom: parseOptionalDate(formData.get("activeFrom")),
      activeTo: parseOptionalDate(formData.get("activeTo")),
      actorUserId: currentSession.userId,
    });

    redirect(`/admin/offers/${rule.id}`);
  }

  return (
    <AdminShell
      active="Offers"
      title="New Pricing Rule"
      subtitle="Build a server-authoritative fare rule with scope, calculation basis and controlled activation dates."
      actions={<Link className="admin-secondary-button" href="/admin/offers">← Pricing Rules</Link>}
    >
      <AdminForm
        action={create}
        aside={
          <>
            <AdminFormAsideCard title="Pricing precedence">
              <p>More specific route scope and higher priority should only be used intentionally. Overlapping active rules with the same scope and priority are rejected.</p>
            </AdminFormAsideCard>
            <AdminFormAsideCard title="Use Quote Only when">
              <p>The final fare needs human review, trusted route distance is unavailable, or pricing cannot be safely automated.</p>
            </AdminFormAsideCard>
          </>
        }
      >
        <AdminFormSection title="Rule identity" description="Name the fare rule and select which vehicle/trip context it applies to." badge="Required">
          <AdminFormGrid columns={2}>
            <AdminField label="Rule name" htmlFor="name" required>
              <input id="name" name="name" required minLength={2} maxLength={160} placeholder="Indore to Ujjain Sedan One Way" />
            </AdminField>
            <AdminField label="Vehicle class" htmlFor="vehicleClassId" required>
              <select id="vehicleClassId" name="vehicleClassId" required defaultValue="">
                <option value="" disabled>Select class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Trip type" htmlFor="tripType">
              <select id="tripType" name="tripType" defaultValue="ONE_WAY">
                {tripTypes.map((item) => (
                  <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Pricing basis" htmlFor="basis">
              <select id="basis" name="basis" defaultValue="QUOTE_ONLY">
                {pricingBases.map((item) => (
                  <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
                ))}
              </select>
            </AdminField>
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection title="Fare calculation" description="All money values are entered in major currency units and stored server-side in minor units.">
          <AdminFormGrid columns={3}>
            <AdminCurrencyField
              id="currency"
              name="currency"
              defaultValue="INR"
            />
            <AdminMoneyField
              name="baseAmount"
              label="Fixed base amount"
              currency="INR"
              currencyInputId="currency"
              placeholder="4500.00"
            />
            <AdminMoneyField
              name="perKm"
              label="Per-km amount"
              currency="INR"
              currencyInputId="currency"
              placeholder="14.00"
            />
            <AdminField label="Minimum distance (km)" htmlFor="minimumDistanceKm">
              <input id="minimumDistanceKm" type="number" name="minimumDistanceKm" min={0} />
            </AdminField>
            <AdminMoneyField
              name="driverAllowancePerDay"
              label="Driver allowance / day"
              currency="INR"
              currencyInputId="currency"
            />
            <AdminMoneyField
              name="nightAllowance"
              label="Night allowance"
              currency="INR"
              currencyInputId="currency"
            />
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection title="Route scope" description="Restrict this rule to a route or leave either key blank as a wildcard.">
          <AdminFormGrid columns={2}>
            <AdminField label="Origin scope key" htmlFor="originKey" hint="Blank means any origin.">
              <input id="originKey" name="originKey" maxLength={200} placeholder="indore" />
            </AdminField>
            <AdminField label="Destination scope key" htmlFor="destinationKey" hint="Blank means any destination.">
              <input id="destinationKey" name="destinationKey" maxLength={200} placeholder="ujjain" />
            </AdminField>
            <AdminField label="Priority" htmlFor="priority" hint="Higher values win among otherwise matching rules.">
              <input id="priority" type="number" name="priority" defaultValue={0} min={-100000} max={100000} />
            </AdminField>
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection title="Activation" description="Control when the pricing rule may participate in server-side fare selection.">
          <AdminFormGrid columns={3}>
            <AdminDateTimeRange
              startName="activeFrom"
              endName="activeTo"
              startLabel="Active from"
              endLabel="Active to"
              startId="activeFrom"
              endId="activeTo"
              startHint="Leave blank to allow immediate activation."
              endHint="Optional expiry for this pricing rule."
            />
            <AdminField label="Status" htmlFor="status">
              <select id="status" name="status" defaultValue="DRAFT">
                {pricingRuleStatuses.map((item) => (
                  <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
                ))}
              </select>
            </AdminField>
          </AdminFormGrid>
          <AdminFormCallout tone="warning" title="Activation safety">
            Start with DRAFT unless the fare has been reviewed. Active rules with ambiguous overlapping scope, priority and effective dates are rejected.
          </AdminFormCallout>
        </AdminFormSection>

        <AdminFormActions submitLabel="Create Pricing Rule" cancelHref="/admin/offers" helper="Pricing remains server-authoritative." />
      </AdminForm>
    </AdminShell>
  );
}
