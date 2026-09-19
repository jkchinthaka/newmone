import "dotenv/config";
import { chromium } from "@playwright/test";

const baseUrl = process.env.ACTION_CENTER_QA_BASE_URL ?? "http://localhost:3001";
const password = process.env.MAINTAINPRO_SEED_PASSWORD;
if (!password) throw new Error("MAINTAINPRO_SEED_PASSWORD is required");

const allUsers = [
  ["ADMIN", "admin@maintainpro.local"],
  ["MANAGER", "manager@maintainpro.local"],
  ["OPERATIONS_MANAGER", "qa-operations_manager@maintainpro.local"],
  ["SUPERVISOR", "supervisor@maintainpro.local"],
  ["ASSET_MANAGER", "qa-asset_manager@maintainpro.local"],
  ["FACILITY_MANAGER", "qa-facility_manager@maintainpro.local"],
  ["BUILDING_SUPERVISOR", "qa-building_supervisor@maintainpro.local"],
  ["FLEET_MANAGER", "qa-fleet_manager@maintainpro.local"],
  ["COMPLIANCE_MANAGER", "qa-compliance_manager@maintainpro.local"],
  ["SECURITY_OFFICER", "security@maintainpro.local"],
  ["TECHNICIAN", "tech@maintainpro.local"],
  ["MECHANIC", "mechanic@maintainpro.local"],
  ["INVENTORY_KEEPER", "inventory@maintainpro.local"],
  ["PROCUREMENT_OFFICER", "qa-procurement_officer@maintainpro.local"],
  ["FINANCE", "qa-finance@maintainpro.local"],
  ["VIEWER", "qa-viewer@maintainpro.local"],
  ["DRIVER", "driver1@maintainpro.local"],
  ["CLEANER", "cleaner@maintainpro.local"]
];
const requestedRoles = new Set((process.env.ACTION_CENTER_QA_ROLES ?? "").split(",").map((role) => role.trim()).filter(Boolean));
const users = requestedRoles.size > 0 ? allUsers.filter(([role]) => requestedRoles.has(role)) : allUsers;

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [index, [role, email]] of users.entries()) {
    // The login limiter is IP-scoped. Give each independent role scenario a
    // distinct loopback address so the QA itself does not manufacture 429s.
    const context = await browser.newContext({
      extraHTTPHeaders: { "x-real-ip": `127.0.1.${index + 2}` }
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    const consoleErrors = [];
    const failedRequests = [];
    const badResponses = [];
    const sockets = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    page.on("requestfailed", (request) => {
      const error = request.failure()?.errorText ?? "failed";
      // Chromium reports an old document navigation as aborted when the SPA
      // redirects immediately after login. That is not a network failure.
      if (request.isNavigationRequest() && error === "net::ERR_ABORTED") return;
      if (error === "net::ERR_ABORTED" && request.url().includes("/api/backend/auth/me")) return;
      failedRequests.push(`${request.method()} ${request.url()} ${error}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400) badResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    });
    page.on("websocket", (socket) => {
      const entry = { url: socket.url(), opened: false, closed: false, errors: [], framesSent: [], framesReceived: [] };
      sockets.push(entry);
      socket.on("open", () => { entry.opened = true; });
      socket.on("close", () => { entry.closed = true; });
      socket.on("socketerror", (error) => entry.errors.push(String(error)));
      socket.on("framesent", (event) => {
        if (entry.framesSent.length < 5) entry.framesSent.push(String(event.payload).slice(0, 500));
      });
      socket.on("framereceived", (event) => {
        if (entry.framesReceived.length < 5) entry.framesReceived.push(String(event.payload).slice(0, 500));
      });
    });
    const handshakes = [];
    cdp.on("Network.webSocketWillSendHandshakeRequest", (event) => {
      handshakes.push({
        requestId: event.requestId,
        url: event.request.url,
        origin: event.request.headers?.Origin ?? event.request.headers?.origin ?? null,
        cookieAvailable: Boolean(event.request.headers?.Cookie ?? event.request.headers?.cookie),
        responseStatus: null,
        responseStatusText: null
      });
    });
    cdp.on("Network.webSocketHandshakeResponseReceived", (event) => {
      const handshake = handshakes.find((entry) => entry.requestId === event.requestId);
      if (handshake) {
        handshake.responseStatus = event.response.status;
        handshake.responseStatusText = event.response.statusText;
      }
    });

    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    // Next dev can paint the server-rendered form before client hydration has
    // attached the login handler; wait a tick to avoid a native POST /login.
    await page.waitForTimeout(250);
    await page.locator("#login-email").fill(email);
    await page.locator("#login-password").fill(password);
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/backend/auth/login")),
      page.getByRole("button", { name: /sign in/i }).click()
    ]);
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 }).catch(() => {});
    await page.goto(`${baseUrl}/action-center`, { waitUntil: "networkidle" });
    const heading = await page.getByRole("heading", { level: 1 }).first().textContent().catch(() => null);
    const sectionHeadings = await page.locator("h2, h3").allTextContents();
    const links = await page.locator("main a[href]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")).filter(Boolean));
    const metricText = await page.locator("main").innerText();
    const queueSummary = role === "ADMIN"
      ? await page.evaluate(async () => {
          const response = await fetch("/api/backend/work-orders/queues", { credentials: "include" });
          return { status: response.status, body: await response.json() };
        })
      : null;
    const linkStatuses = [];
    for (const href of [...new Set(links)]) {
      const response = await context.request.get(new URL(href, baseUrl).toString(), { maxRedirects: 5 });
      linkStatuses.push({ href, status: response.status() });
    }
    if (role === "ADMIN") {
      const search = page.getByRole("searchbox", { name: "Search Action Center" });
      await search.fill("compliance");
      const searchText = await page.locator("main").innerText();
      if (!searchText.includes("Compliance")) consoleErrors.push("Action Center search did not return Compliance");
      await search.fill("zzz-not-a-real-match-zzz");
      if (!(await page.locator("main").innerText()).includes("No matches")) consoleErrors.push("Action Center search empty state missing");
      await search.fill("");
    }
    const cookies = (await context.cookies()).map(({ name, httpOnly, secure, sameSite, path }) => ({ name, httpOnly, secure, sameSite, path }));
    const legacyTokens = await page.evaluate(() => ({
      access: localStorage.getItem("maintainpro_access_token"),
      refresh: localStorage.getItem("maintainpro_refresh_token")
    }));
    results.push({ role, email, heading, sectionHeadings, links, linkStatuses, metricText, queueSummary, badResponses, failedRequests, consoleErrors, sockets, handshakes, cookies, legacyTokens });
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results.map((result) => ({
  role: result.role,
  heading: result.heading,
  sectionHeadings: result.sectionHeadings,
  metrics: result.metricText.match(/(OPEN \/ IN PROGRESS|HIGH PRIORITY|PENDING POS|PENDING)\s*\n([^\n]+)/gi) ?? [],
  queueSummary: result.queueSummary,
  badResponses: result.badResponses,
  failedRequests: result.failedRequests,
  consoleErrors: result.consoleErrors,
  badLinks: result.linkStatuses.filter((link) => link.status >= 400),
  notificationSocket: result.sockets.find((socket) => socket.url.includes("/socket.io/")) ?? null,
  notificationHandshake: result.handshakes.find((handshake) => handshake.cookieAvailable) ?? null,
  authCookies: result.cookies,
  legacyTokens: result.legacyTokens
})), null, 2));
if (results.some((result) => result.heading !== "Home" || result.badResponses.length || result.failedRequests.length || result.consoleErrors.length || result.linkStatuses.some((link) => link.status >= 400) || result.legacyTokens.access || result.legacyTokens.refresh)) {
  process.exitCode = 1;
}
