import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell } from "@/components/admin-shell";
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
      subtitle="Create a server-authoritative fare rule. Coupon codes are not part of this model."
      actions={
        <Link className="admin-secondary-button" href="/admin/offers">
          ← Pricing Rules
        </Link>
      }
    >
      <section className="admin-panel admin-detail-card">
        <form action={create}>
          <label>
            Rule name
            <input name="name" required minLength={2} maxLength={160}/>
          </label>

          <label>
            Vehicle class
            <select name="vehicleClassId" required defaultValue="">
              <option value="" disabled>Select class</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          <label>
            Trip type
            <select name="tripType" defaultValue="ONE_WAY">
              {tripTypes.map((item) => (
                <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>

          <label>
            Pricing basis
            <select name="basis" defaultValue="QUOTE_ONLY">
              {pricingBases.map((item) => (
                <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>

          <label>
            Currency
            <input name="currency" defaultValue="INR" maxLength={3} required/>
          </label>

          <label>
            Fixed base amount
            <input name="baseAmount" inputMode="decimal" placeholder="4500.00"/>
          </label>

          <label>
            Per-km amount
            <input name="perKm" inputMode="decimal" placeholder="14.00"/>
          </label>

          <label>
            Minimum distance (km)
            <input type="number" name="minimumDistanceKm" min={0}/>
          </label>

          <label>
            Driver allowance / day
            <input name="driverAllowancePerDay" inputMode="decimal"/>
          </label>

          <label>
            Night allowance
            <input name="nightAllowance" inputMode="decimal"/>
          </label>

          <label>
            Origin scope key
            <input name="originKey" maxLength={200} placeholder="leave blank for wildcard"/>
          </label>

          <label>
            Destination scope key
            <input name="destinationKey" maxLength={200} placeholder="leave blank for wildcard"/>
          </label>

          <label>
            Priority
            <input type="number" name="priority" defaultValue={0} min={-100000} max={100000}/>
          </label>

          <label>
            Active from
            <input type="datetime-local" name="activeFrom"/>
          </label>

          <label>
            Active to
            <input type="datetime-local" name="activeTo"/>
          </label>

          <label>
            Status
            <select name="status" defaultValue="DRAFT">
              {pricingRuleStatuses.map((item) => (
                <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>

          <p>
            Use QUOTE ONLY when the final fare must be reviewed manually. Active
            rules with the same scope, priority and overlapping dates are rejected.
          </p>

          <button className="admin-primary-button" type="submit">
            Create Pricing Rule
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
