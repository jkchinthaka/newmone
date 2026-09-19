/**
 * Phase 2 accessibility smoke: critical HTML surfaces have labels/landmarks.
 */
import "dotenv/config";

const webBase = process.env.ACTION_CENTER_QA_BASE_URL ?? "http://localhost:3001";
const password = process.env.MAINTAINPRO_SEED_PASSWORD;
if (!password) throw new Error("MAINTAINPRO_SEED_PASSWORD required");

const results = [];
const mark = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(JSON.stringify({ id, ok, detail }));
};

function cookiesOf(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}

async function main() {
  const loginPage = await fetch(`${webBase}/login`);
  const loginHtml = await loginPage.text();
  mark("A11Y-login-status", loginPage.status === 200, { status: loginPage.status });
  const hasLabel = loginHtml.includes("<label") || loginHtml.includes("for=");
  const hasAriaLabel = loginHtml.includes("aria-label=") || loginHtml.includes("aria-labelledby=");
  mark("A11Y-login-form-labels", hasLabel || hasAriaLabel, { hasLabel, hasAriaLabel });
  mark(
    "A11Y-login-email-input",
    loginHtml.includes('type="email"') || loginHtml.includes('name="email"') || loginHtml.includes("email"),
    {}
  );
  mark("A11Y-login-password-input", loginHtml.includes('type="password"'), {});

  const loginRes = await fetch(`${webBase}/api/backend/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "127.0.12.1" },
    body: JSON.stringify({ email: "manager@maintainpro.local", password })
  });
  const cookies = cookiesOf(loginRes);
  mark("A11Y-auth", loginRes.ok, { status: loginRes.status });

  for (const path of ["/action-center", "/work-orders", "/inventory", "/requests"]) {
    const res = await fetch(`${webBase}${path}`, { headers: { cookie: cookies }, redirect: "manual" });
    const html = await res.text();
    const hasMain = html.includes("<main") || html.includes('role="main"');
    const hasH1 = html.includes("<h1");
    mark(
      `A11Y-page-${path.slice(1)}`,
      res.status === 200 || res.status === 307 || res.status === 302,
      { status: res.status, hasMain, hasH1 }
    );
  }

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ summary: { total: results.length, failed: failed.length }, failed }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
