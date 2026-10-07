import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminPanelHeading, AdminShell, StatusPill } from "@/components/admin-shell";
import { AdminEditorTabs } from "@/components/admin-editor-tabs";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { AdminField, AdminFormGrid } from "@/components/admin-form";
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

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "ACTIVE") return "green";
  if (status === "DRAFT") return "orange";
  if (status === "ARCHIVED") return "red";
  return "gray";
}

function decimal(minor: bigint | null): string {
  if (minor === null) return "";
  return (Number(minor) / 100).toFixed(2);
}

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

function localDateTime(value: Date | null): string {
  if (!value) return "";
  return new Date(
    value.getTime() - value.getTimezoneOffset() * 60_000,
  )
    .toISOString()
    .slice(0, 16);
}

export default async function PricingRuleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "settings.manage")) redirect("/admin");

  const { id } = await params;
  const { tab: requestedTab } = await searchParams;
  const activeTab = ["overview", "details", "activation"].includes(
    requestedTab ?? "",
  )
    ? requestedTab!
    : "overview";
  const db = getDb();

  const [rule, classes] = await Promise.all([
    db.pricingRule.findUnique({
      where: { id },
      include: {
        vehicleClass: { select: { name: true } },
      },
    }),
    db.vehicleClass.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  if (!rule) notFound();

  const ruleId = rule.id;

  async function save(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "settings.manage")) {
      redirect("/admin/offers");
    }

    const tripType = String(formData.get("tripType") ?? "");
    const basis = String(formData.get("basis") ?? "");
    const status = String(formData.get("status") ?? "");

    if (!isTripType(tripType)) throw new Error("Invalid trip type.");
    if (!isPricingBasis(basis)) throw new Error("Invalid pricing basis.");
    if (!isPricingRuleStatus(status)) throw new Error("Invalid pricing rule status.");

    await savePricingRule({
      id: ruleId,
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

    revalidatePath("/admin/offers");
    revalidatePath(`/admin/offers/${ruleId}`);
  }

  return (
    <AdminShell
      active="Offers"
      title={rule.name}
      subtitle="Server-authoritative pricing rule"
      actions={<Link className="admin-secondary-button" href="/admin/offers">← Pricing Rules</Link>}
    >
      <AdminEditorTabs
        basePath={`/admin/offers/${rule.id}`}
        active={activeTab}
        tabs={[
          { key: "overview", label: "Overview", description: "Scope & status" },
          { key: "details", label: "Rule Details", description: "Fare calculation" },
          { key: "activation", label: "Activation", description: "Dates & status" },
        ]}
      />

      <div className="admin-editor-section-stack">
        {activeTab === "overview" ? (
          <section className="admin-panel admin-detail-card">
            <AdminPanelHeading
              title="Rule Overview"
              meta={
                <StatusPill tone={tone(rule.status)}>
                {rule.status.replaceAll("_", " ")}
              </StatusPill>
              }
            />
            <dl>
              <div><dt>Vehicle class</dt><dd>{rule.vehicleClass.name}</dd></div>
              <div><dt>Trip type</dt><dd>{rule.tripType.replaceAll("_", " ")}</dd></div>
              <div><dt>Basis</dt><dd>{rule.basis.replaceAll("_", " ")}</dd></div>
              <div><dt>Priority</dt><dd>{rule.priority}</dd></div>
              <div><dt>Origin scope</dt><dd>{rule.originKey ?? "Wildcard"}</dd></div>
              <div><dt>Destination scope</dt><dd>{rule.destinationKey ?? "Wildcard"}</dd></div>
            </dl>
          </section>
        ) : null}

        {activeTab === "details" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Rule Details</h2>
            <form action={save}>
              <input type="hidden" name="activeFrom" value={localDateTime(rule.activeFrom)}/>
              <input type="hidden" name="activeTo" value={localDateTime(rule.activeTo)}/>
              <input type="hidden" name="status" value={rule.status}/>

              <AdminFormGrid columns={2}>
                <AdminField label="Rule name" htmlFor="ruleName" required wide>
                  <input
                    id="ruleName"
                    name="name"
                    defaultValue={rule.name}
                    required
                    minLength={2}
                    maxLength={160}
                  />
                </AdminField>

                <AdminField label="Vehicle class" htmlFor="vehicleClassId" required>
                  <select
                    id="vehicleClassId"
                    name="vehicleClassId"
                    defaultValue={rule.vehicleClassId}
                  >
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </AdminField>

                <AdminField label="Trip type" htmlFor="tripType" required>
                  <select id="tripType" name="tripType" defaultValue={rule.tripType}>
                    {tripTypes.map((item) => (
                      <option key={item} value={item}>
                        {item.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </AdminField>

                <AdminField label="Pricing basis" htmlFor="basis" required>
                  <select id="basis" name="basis" defaultValue={rule.basis}>
                    {pricingBases.map((item) => (
                      <option key={item} value={item}>
                        {item.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </AdminField>

                <AdminCurrencyField
                  id="currency"
                  name="currency"
                  defaultValue={rule.currency}
                />

                <AdminMoneyField
                  name="baseAmount"
                  label="Fixed base amount"
                  currency={rule.currency}
                  currencyInputId="currency"
                  defaultValue={decimal(rule.baseAmountMinor)}
                />

                <AdminMoneyField
                  name="perKm"
                  label="Per-km amount"
                  currency={rule.currency}
                  currencyInputId="currency"
                  defaultValue={decimal(rule.perKmMinor)}
                />

                <AdminField
                  label="Minimum distance (km)"
                  htmlFor="minimumDistanceKm"
                >
                  <input
                    id="minimumDistanceKm"
                    type="number"
                    name="minimumDistanceKm"
                    min={0}
                    defaultValue={rule.minimumDistanceKm ?? ""}
                  />
                </AdminField>

                <AdminMoneyField
                  name="driverAllowancePerDay"
                  label="Driver allowance / day"
                  currency={rule.currency}
                  currencyInputId="currency"
                  defaultValue={decimal(rule.driverAllowancePerDayMinor)}
                />

                <AdminMoneyField
                  name="nightAllowance"
                  label="Night allowance"
                  currency={rule.currency}
                  currencyInputId="currency"
                  defaultValue={decimal(rule.nightAllowanceMinor)}
                />

                <AdminField
                  label="Origin scope key"
                  htmlFor="originKey"
                  hint="Leave blank to match any origin."
                >
                  <input
                    id="originKey"
                    name="originKey"
                    defaultValue={rule.originKey ?? ""}
                    maxLength={200}
                  />
                </AdminField>

                <AdminField
                  label="Destination scope key"
                  htmlFor="destinationKey"
                  hint="Leave blank to match any destination."
                >
                  <input
                    id="destinationKey"
                    name="destinationKey"
                    defaultValue={rule.destinationKey ?? ""}
                    maxLength={200}
                  />
                </AdminField>

                <AdminField
                  label="Priority"
                  htmlFor="priority"
                  hint="Higher values win among otherwise matching rules."
                >
                  <input
                    id="priority"
                    type="number"
                    name="priority"
                    defaultValue={rule.priority}
                    min={-100000}
                    max={100000}
                  />
                </AdminField>
              </AdminFormGrid>

              <AdminSubmitButton
                label="Save Rule Details"
                pendingLabel="Saving Rule…"
              />
            </form>
          </section>
        ) : null}

        {activeTab === "activation" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Activation & Effective Dates</h2>
            <form action={save}>
              <input type="hidden" name="name" value={rule.name}/>
              <input type="hidden" name="vehicleClassId" value={rule.vehicleClassId}/>
              <input type="hidden" name="tripType" value={rule.tripType}/>
              <input type="hidden" name="basis" value={rule.basis}/>
              <input type="hidden" name="currency" value={rule.currency}/>
              <input type="hidden" name="baseAmount" value={decimal(rule.baseAmountMinor)}/>
              <input type="hidden" name="perKm" value={decimal(rule.perKmMinor)}/>
              <input type="hidden" name="minimumDistanceKm" value={rule.minimumDistanceKm ?? ""}/>
              <input type="hidden" name="driverAllowancePerDay" value={decimal(rule.driverAllowancePerDayMinor)}/>
              <input type="hidden" name="nightAllowance" value={decimal(rule.nightAllowanceMinor)}/>
              <input type="hidden" name="originKey" value={rule.originKey ?? ""}/>
              <input type="hidden" name="destinationKey" value={rule.destinationKey ?? ""}/>
              <input type="hidden" name="priority" value={rule.priority}/>

              <AdminFormGrid columns={2}>
                <AdminDateTimeRange
                  startName="activeFrom"
                  endName="activeTo"
                  startLabel="Active from"
                  endLabel="Active to"
                  startId="activeFrom"
                  endId="activeTo"
                  defaultStart={localDateTime(rule.activeFrom)}
                  defaultEnd={localDateTime(rule.activeTo)}
                  startHint="Leave blank to allow immediate activation."
                  endHint="Optional expiry for this pricing rule."
                />

                <AdminField
                  label="Status"
                  htmlFor="ruleStatus"
                  wide
                  hint="Keep the rule in draft until fare scope and amounts are reviewed."
                >
                  <select
                    id="ruleStatus"
                    name="status"
                    defaultValue={rule.status}
                  >
                    {pricingRuleStatuses.map((item) => (
                      <option key={item} value={item}>
                        {item.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </AdminField>
              </AdminFormGrid>

              <p>
                Activating a rule is rejected if another active rule has the same
                class, trip type, route scope, priority and overlapping dates.
              </p>

              <AdminSubmitButton
                label="Save Activation"
                pendingLabel="Saving Activation…"
              />
            </form>
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
