const baseUrl = (process.env.ADMIN_SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

const protectedRoutes = [
  "/admin",
  "/admin/bookings",
  "/admin/bookings/bulk",
  "/admin/dispatch",
  "/admin/dispatch/resources",
  "/admin/dispatch/calendar",
  "/admin/vehicles",
  "/admin/drivers",
  "/admin/reports",
  "/admin/payments",
  "/admin/customers",
  "/admin/leads",
  "/admin/staff",
  "/admin/staff/new",
];

async function request(path) {
  return fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    headers: {
      "user-agent": "yatra-admin-route-certification/1.0",
    },
  });
}

const login = await request("/admin/login");
if (login.status !== 200) {
  throw new Error(`Expected /admin/login to return 200, received ${login.status}`);
}

for (const path of protectedRoutes) {
  const response = await request(path);
  const location = response.headers.get("location") ?? "";

  if (![302, 303, 307, 308].includes(response.status)) {
    throw new Error(
      `${path} must reject an unauthenticated request with a redirect; received ${response.status}`,
    );
  }

  const redirectUrl = new URL(location, baseUrl);
  if (redirectUrl.pathname !== "/admin/login") {
    throw new Error(
      `${path} redirected to ${redirectUrl.pathname} instead of /admin/login`,
    );
  }

  process.stdout.write(`PASS ${path} -> /admin/login\n`);
}

const exportResponse = await request("/api/admin/bookings/export");
if (![302, 303, 307, 308].includes(exportResponse.status)) {
  throw new Error(
    `Booking export must reject unauthenticated access; received ${exportResponse.status}`,
  );
}

const exportLocation = new URL(
  exportResponse.headers.get("location") ?? "/",
  baseUrl,
);
if (exportLocation.pathname !== "/admin/login") {
  throw new Error(
    `Booking export redirected to ${exportLocation.pathname} instead of /admin/login`,
  );
}

process.stdout.write("PASS /api/admin/bookings/export -> /admin/login\n");

const inviteResponse = await request("/admin/invite/invalid-certification-token");
if (inviteResponse.status !== 200) {
  throw new Error(
    `Invalid invite setup page must remain publicly reachable; received ${inviteResponse.status}`,
  );
}
process.stdout.write("PASS invalid invite setup page remains public\n");

process.stdout.write("Admin route protection certification passed.\n");
