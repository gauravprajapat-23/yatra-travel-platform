const baseUrl = (process.env.ADMIN_SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? baseUrl;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
}

function assertIncludes(html, fragment, label) {
  if (!html.includes(fragment)) {
    throw new Error(`${label} is missing expected markup: ${fragment}`);
  }
}

async function getHtml(path, cookie) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
  if (response.status !== 200) {
    throw new Error(`${path} expected 200, received ${response.status}`);
  }
  return response.text();
}

const loginHtml = await getHtml("/admin/login");
assertIncludes(loginHtml, 'class="skip-link"', "Admin login");
assertIncludes(loginHtml, 'href="#main-content"', "Admin login skip link");
assertIncludes(loginHtml, "<h1", "Admin login");
assertIncludes(loginHtml, 'for="adminEmail"', "Admin email field");
assertIncludes(loginHtml, 'for="adminPassword"', "Admin password field");
assertIncludes(loginHtml, 'aria-label="Show password"', "Password visibility control");
process.stdout.write("PASS admin login accessibility structure\n");

const loginResponse = await fetch(`${baseUrl}/api/admin-auth/login`, {
  method: "POST",
  redirect: "manual",
  headers: {
    "content-type": "application/json",
    origin: appOrigin,
  },
  body: JSON.stringify({ email, password }),
});
if (loginResponse.status !== 200) {
  throw new Error(`Accessibility certification login failed: ${loginResponse.status}`);
}
const setCookie = loginResponse.headers.get("set-cookie");
if (!setCookie) throw new Error("Accessibility certification login returned no cookie.");
const cookie = setCookie.split(";")[0];

for (const path of [
  "/admin",
  "/admin/bookings",
  "/admin/dispatch",
  "/admin/dispatch/calendar",
  "/admin/reports",
]) {
  const html = await getHtml(path, cookie);
  assertIncludes(html, 'id="main-content"', path);
  assertIncludes(html, "<h1", path);

  if (html.includes("<table")) {
    assertIncludes(html, "<thead", `${path} table`);
    assertIncludes(html, "<th", `${path} table headings`);
  }

  if (html.includes("<form")) {
    const controls = (html.match(/<(input|select|textarea)\b/g) ?? []).length;
    const labels = (html.match(/<label\b/g) ?? []).length;
    if (controls > 0 && labels === 0) {
      throw new Error(`${path} renders form controls without labels.`);
    }
  }

  process.stdout.write(`PASS ${path} accessibility/runtime structure\n`);
}

process.stdout.write("Admin accessibility structure certification passed.\n");
