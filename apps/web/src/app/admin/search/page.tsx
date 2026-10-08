import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell, StatusPill } from "@/components/admin-shell";
import { AdminField } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type SearchItem = {
  key: string;
  title: string;
  meta: string;
  href: string;
  status?: string;
};

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (["ACTIVE", "PUBLISHED", "CONFIRMED", "COMPLETED", "QUALIFIED"].includes(status)) {
    return "green";
  }
  if (["NEW", "DRAFT", "REVIEW", "PENDING_PAYMENT", "PENDING_REVIEW"].includes(status)) {
    return "orange";
  }
  if (["SUSPENDED", "DISABLED", "CANCELLED", "FAILED", "ARCHIVED", "SPAM"].includes(status)) {
    return "red";
  }
  if (["IN_PROGRESS", "SCHEDULED", "DRIVER_ASSIGNED"].includes(status)) {
    return "blue";
  }
  return "gray";
}

function ResultsGroup({
  title,
  items,
}: {
  title: string;
  items: SearchItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="admin-panel admin-detail-card">
      <div className="admin-panel-heading">
        <h2>{title}</h2>
        <span>{items.length} result{items.length === 1 ? "" : "s"}</span>
      </div>

      <div className="admin-search-results">
        {items.map((item) => (
          <Link className="admin-search-result" href={item.href} key={item.key}>
            <div>
              <strong>{item.title}</strong>
              <small>{item.meta}</small>
            </div>
            {item.status ? (
              <StatusPill tone={tone(item.status)}>
                {item.status.replaceAll("_", " ")}
              </StatusPill>
            ) : (
              <span>View →</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "admin.access")) redirect("/admin/login");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 120);
  const db = getDb();

  if (q.length < 2) {
    return (
      <AdminShell
        active="Dashboard"
        title="Admin Search"
        subtitle="Search across the operational areas your role can access."
      >
        <section className="admin-panel admin-detail-card">
          <h2>Search the admin</h2>
          <form className="admin-table-query admin-table-query--compact" method="get">
            <AdminField label="Search" htmlFor="adminSearchEmpty">
              <input
                id="adminSearchEmpty"
                name="q"
                minLength={2}
                maxLength={120}
                placeholder="Booking reference, customer, lead, package, vehicle…"
                autoFocus
              />
            </AdminField>
            <button className="admin-primary-button" type="submit">
              Search
            </button>
          </form>
          <p>Enter at least two characters.</p>
        </section>
      </AdminShell>
    );
  }

  const [
    cars,
    packageBookings,
    leads,
    packages,
    destinations,
    cmsPages,
    blogPosts,
    customers,
    vehicles,
    drivers,
    staff,
  ] = await Promise.all([
    hasPermission(session.roles, "booking.read")
      ? db.carBooking.findMany({
          where: {
            OR: [
              { reference: { contains: q, mode: "insensitive" } },
              { guestName: { contains: q, mode: "insensitive" } },
              { guestEmail: { contains: q, mode: "insensitive" } },
              { originText: { contains: q, mode: "insensitive" } },
              { destinationText: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            reference: true,
            guestName: true,
            originText: true,
            destinationText: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    hasPermission(session.roles, "booking.read")
      ? db.packageBooking.findMany({
          where: {
            OR: [
              { reference: { contains: q, mode: "insensitive" } },
              { guestName: { contains: q, mode: "insensitive" } },
              { guestEmail: { contains: q, mode: "insensitive" } },
              { package: { title: { contains: q, mode: "insensitive" } } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            reference: true,
            guestName: true,
            status: true,
            package: { select: { title: true } },
          },
        })
      : Promise.resolve([]),
    hasPermission(session.roles, "lead.read")
      ? db.lead.findMany({
          where: {
            OR: [
              { reference: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { message: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            reference: true,
            name: true,
            email: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    hasPermission(session.roles, "package.read")
      ? db.tourPackage.findMany({
          where: {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { summary: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
          select: { id: true, title: true, slug: true, status: true },
        })
      : Promise.resolve([]),
    hasPermission(session.roles, "content.read")
      ? db.destination.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { summary: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 6,
          select: { id: true, name: true, slug: true, status: true },
        })
      : Promise.resolve([]),
    hasPermission(session.roles, "content.read")
      ? db.cmsPage.findMany({
          where: {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { excerpt: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 6,
          select: { id: true, title: true, slug: true, status: true },
        })
      : Promise.resolve([]),
    hasPermission(session.roles, "content.read")
      ? db.blogPost.findMany({
          where: {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { excerpt: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 6,
          select: { id: true, title: true, slug: true, status: true },
        })
      : Promise.resolve([]),
    hasPermission(session.roles, "customer.read")
      ? db.user.findMany({
          where: {
            AND: [
              {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
              },
              {
                OR: [
                  { carBookings: { some: {} } },
                  { packageBookings: { some: {} } },
                ],
              },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
          select: { id: true, name: true, email: true, status: true },
        })
      : Promise.resolve([]),
    hasPermission(session.roles, "vehicle.read")
      ? db.vehicle.findMany({
          where: {
            OR: [
              { displayName: { contains: q, mode: "insensitive" } },
              { registrationNumber: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 6,
          select: {
            id: true,
            displayName: true,
            registrationNumber: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    hasPermission(session.roles, "driver.read")
      ? db.driver.findMany({
          where: { displayName: { contains: q, mode: "insensitive" } },
          orderBy: { updatedAt: "desc" },
          take: 6,
          select: { id: true, displayName: true, status: true, phoneLast4: true },
        })
      : Promise.resolve([]),
    hasPermission(session.roles, "staff.manage")
      ? db.user.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
            roles: { some: { role: { key: { not: "CUSTOMER" } } } },
          },
          orderBy: { updatedAt: "desc" },
          take: 6,
          select: { id: true, name: true, email: true, status: true },
        })
      : Promise.resolve([]),
  ]);

  const bookingItems: SearchItem[] = [
    ...cars.map((item) => ({
      key: `car-${item.reference}`,
      title: item.reference,
      meta: `${item.guestName ?? "Account customer"} · ${item.originText} → ${item.destinationText}`,
      href: `/admin/bookings/${item.reference}`,
      status: item.status,
    })),
    ...packageBookings.map((item) => ({
      key: `package-booking-${item.reference}`,
      title: item.reference,
      meta: `${item.guestName ?? "Account customer"} · ${item.package.title}`,
      href: `/admin/bookings/${item.reference}`,
      status: item.status,
    })),
  ];

  const contentItems: SearchItem[] = [
    ...packages.map((item) => ({
      key: `package-${item.id}`,
      title: item.title,
      meta: `Package · /${item.slug}`,
      href: `/admin/packages/${item.id}`,
      status: item.status,
    })),
    ...destinations.map((item) => ({
      key: `destination-${item.id}`,
      title: item.name,
      meta: `Destination · /${item.slug}`,
      href: `/admin/content/destination/${item.id}`,
      status: item.status,
    })),
    ...cmsPages.map((item) => ({
      key: `cms-${item.id}`,
      title: item.title,
      meta: `CMS · /${item.slug}`,
      href: `/admin/content/cms/${item.id}`,
      status: item.status,
    })),
    ...blogPosts.map((item) => ({
      key: `blog-${item.id}`,
      title: item.title,
      meta: `Blog · /${item.slug}`,
      href: `/admin/content/blog/${item.id}`,
      status: item.status,
    })),
  ];

  const peopleItems: SearchItem[] = [
    ...customers.map((item) => ({
      key: `customer-${item.id}`,
      title: item.name ?? item.email,
      meta: `Customer · ${item.email}`,
      href: `/admin/customers/${encodeURIComponent(item.email.toLowerCase())}`,
      status: item.status,
    })),
    ...staff.map((item) => ({
      key: `staff-${item.id}`,
      title: item.name ?? item.email,
      meta: `Staff · ${item.email}`,
      href: `/admin/staff/${item.id}`,
      status: item.status,
    })),
    ...drivers.map((item) => ({
      key: `driver-${item.id}`,
      title: item.displayName,
      meta: item.phoneLast4 ? `Driver · •••• ${item.phoneLast4}` : "Driver",
      href: `/admin/drivers/${item.id}`,
      status: item.status,
    })),
  ];

  const fleetItems: SearchItem[] = vehicles.map((item) => ({
    key: `vehicle-${item.id}`,
    title: item.displayName,
    meta: item.registrationNumber,
    href: `/admin/vehicles/${item.id}`,
    status: item.status,
  }));

  const leadItems: SearchItem[] = leads.map((item) => ({
    key: `lead-${item.reference}`,
    title: item.reference,
    meta: `${item.name} · ${item.email}`,
    href: `/admin/leads/${item.reference}`,
    status: item.status,
  }));

  const total =
    bookingItems.length +
    leadItems.length +
    contentItems.length +
    peopleItems.length +
    fleetItems.length;

  return (
    <AdminShell
      active="Dashboard"
      title="Admin Search"
      subtitle={`Results for “${q}” across areas your role can access.`}
    >
      <section className="admin-panel admin-card-body">
        <form className="admin-table-query admin-table-query--compact" method="get">
          <AdminField label="Search" htmlFor="adminSearchQuery">
            <input
              id="adminSearchQuery"
              name="q"
              defaultValue={q}
              minLength={2}
              maxLength={120}
              autoFocus
            />
          </AdminField>
          <button className="admin-primary-button" type="submit">
            Search
          </button>
        </form>
        <p>{total} loaded result{total === 1 ? "" : "s"}.</p>
      </section>

      {total === 0 ? (
        <section className="admin-panel admin-detail-card">
          <h2>No results</h2>
          <p>Try a booking reference, customer email, lead, package, destination, vehicle or staff name.</p>
        </section>
      ) : (
        <div className="admin-editor-section-stack">
          <ResultsGroup title="Bookings" items={bookingItems} />
          <ResultsGroup title="Leads" items={leadItems} />
          <ResultsGroup title="Content & Packages" items={contentItems} />
          <ResultsGroup title="People" items={peopleItems} />
          <ResultsGroup title="Fleet" items={fleetItems} />
        </div>
      )}
    </AdminShell>
  );
}
