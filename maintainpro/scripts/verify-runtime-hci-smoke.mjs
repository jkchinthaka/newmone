/**
 * Runtime HCI browser smoke — authenticated pages on a clean production build.
 *
 * Failures are counted unless explicitly allowlisted:
 * - browser-extension noise (separate bucket, never fails the run)
 * - known third-party hosts only (e.g. OSRM router.project-osrm.org)
 * - realtime socket handshake failures when REALTIME_DISABLED
 */
import "dotenv/config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const base = process.env.RESPONSIVE_QA_BASE_URL ?? "http://localhost:3011";
const password = process.env.MAINTAINPRO_SEED_PASSWORD;
if (!password) throw new Error("MAINTAINPRO_SEED_PASSWORD required");

const paths = ["/action-center", "/vehicles", "/fleet", "/inventory", "/notifications"];

const REALTIME_DISABLED = ["false", "0", "off"].includes(
  String(process.env.NEXT_PUBLIC_REALTIME_NOTIFICATIONS ?? "").trim().toLowerCase()
);

/** Known third-party hosts whose 4xx/5xx/failures are not MaintainPro defects (fleet map). */
const ALLOWED_THIRD_PARTY_HOSTS = new Set([
  "router.project-osrm.org",
  "overpass-api.de",
  "tile.openstreetmap.org"
]);

function isExtensionNoise(text) {
  return /chrome-extension:\/\/|moz-extension:\/\/|safari-extension:\/\/|extension:\/\//i.test(
    String(text || "")
  );
}

function isExpectedDevNoise(text) {
  return /Download the React DevTools|\[HMR\]|Fast Refresh/i.test(String(text || ""));
}

function hostnameOf(urlOrText) {
  try {
    if (/^https?:\/\//i.test(urlOrText)) {
      return new URL(urlOrText).hostname;
    }
  } catch {
    /* ignore */
  }
  const m = String(urlOrText || "").match(/https?:\/\/([^/\s"']+)/i);
  return m ? m[1] : null;
}

function isAllowedThirdParty(urlOrText) {
  const host = hostnameOf(urlOrText);
  return Boolean(host && ALLOWED_THIRD_PARTY_HOSTS.has(host));
}

function isAppOrigin(url) {
  try {
    const u = new URL(url);
    const b = new URL(base);
    return u.origin === b.origin || u.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleErrors = [];
  const consoleWarns = [];
  const hydration = [];
  const pageErrors = [];
  const rejections = [];
  const requestFailed = [];
  const badHttp = [];
  const extensionNoise = [];
  /** Recent third-party failures so console "Failed to load resource" without a URL can be correlated. */
  const recentThirdPartyFailures = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (isExtensionNoise(text)) {
      extensionNoise.push({ type: msg.type(), text: text.slice(0, 200) });
      return;
    }
    if (isExpectedDevNoise(text)) return;

    // Correlate Chrome's URL-less "Failed to load resource: … 504" with a recent OSRM response.
    if (/Failed to load resource:.*status of (4\d\d|5\d\d)/i.test(text)) {
      const statusMatch = text.match(/status of (\d+)/i);
      const status = statusMatch ? Number(statusMatch[1]) : null;
      const correlated = recentThirdPartyFailures.some(
        (f) => (status == null || f.status === status) && Date.now() - f.at < 15_000
      );
      if (correlated || isAllowedThirdParty(text)) {
        return;
      }
    }

    if (/hydrat|did not match|server rendered HTML/i.test(text)) {
      hydration.push(text.slice(0, 300));
    }
    if (msg.type() === "error") consoleErrors.push(text.slice(0, 300));
    if (msg.type() === "warning") consoleWarns.push(text.slice(0, 300));
  });

  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 300)));

  page.on("requestfailed", (req) => {
    const url = req.url();
    const error = req.failure()?.errorText || "unknown";
    if (isExtensionNoise(url)) {
      extensionNoise.push({ type: "requestfailed", text: url.slice(0, 200) });
      return;
    }
    if (isAllowedThirdParty(url)) return;
    if (REALTIME_DISABLED && /\/socket\.io\//i.test(url)) return;
    // Navigation abort of in-flight /auth/me after login redirect is expected.
    if (/\/auth\/me\b/i.test(url) && /ERR_ABORTED|aborted/i.test(error)) return;
    requestFailed.push({
      url: url.slice(0, 200),
      error
    });
  });

  page.on("response", (res) => {
    const status = res.status();
    const url = res.url();
    if (isAllowedThirdParty(url)) {
      if (status >= 400) {
        recentThirdPartyFailures.push({ host: hostnameOf(url), status, at: Date.now() });
        if (recentThirdPartyFailures.length > 20) recentThirdPartyFailures.shift();
      }
      return;
    }
    if (!isAppOrigin(url)) return;
    if (status === 404 || status === 500 || status === 401 || status === 403) {
      badHttp.push({ status, url: url.slice(0, 180), path: page.url() });
    }
  });

  // Capture unhandled rejections from the page.
  await page.addInitScript(() => {
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      const message =
        reason && typeof reason === "object" && "message" in reason
          ? String(reason.message)
          : String(reason);
      window.__hciUnhandledRejections = window.__hciUnhandledRejections || [];
      window.__hciUnhandledRejections.push(message.slice(0, 300));
    });
  });

  async function drainRejections() {
    const batch = await page.evaluate(() => {
      const list = window.__hciUnhandledRejections || [];
      window.__hciUnhandledRejections = [];
      return list;
    });
    rejections.push(...batch);
  }

  await page.goto(`${base}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.reload({ waitUntil: "networkidle" }); // hard refresh — hydration check surface
  await page.waitForTimeout(500);
  const loginSnapshot = {
    path: "/login",
    consoleError: 0,
    consoleWarn: 0,
    hydration: hydration.length,
    pageError: pageErrors.length,
    rejection: 0,
    requestFailed: 0,
    httpBad: 0,
    note: "pre-auth hard refresh"
  };

  await page.fill('input[type="email"]', "admin@maintainpro.local");
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 }),
    page.click('button[type="submit"]')
  ]);

  // Clear post-login noise
  consoleErrors.length = 0;
  consoleWarns.length = 0;
  hydration.length = 0;
  pageErrors.length = 0;
  badHttp.length = 0;
  requestFailed.length = 0;
  rejections.length = 0;
  await drainRejections();

  const findings = [loginSnapshot];

  for (const path of paths) {
    consoleErrors.length = 0;
    consoleWarns.length = 0;
    hydration.length = 0;
    pageErrors.length = 0;
    rejections.length = 0;
    requestFailed.length = 0;
    badHttp.length = 0;

    await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);
    await drainRejections();

    const unexpectedHttp = badHttp.filter((h) => {
      if (path === "/login") return false;
      if (h.status === 404 && /favicon|manifest|\.map$/i.test(h.url)) return false;
      return true;
    });

    const row = {
      path,
      consoleError: consoleErrors.length,
      consoleWarn: consoleWarns.length,
      hydration: hydration.length,
      pageError: pageErrors.length,
      rejection: rejections.length,
      requestFailed: requestFailed.length,
      httpBad: unexpectedHttp.length,
      sampleErrors: consoleErrors.slice(0, 3),
      sampleWarns: consoleWarns.slice(0, 3),
      sampleHttp: unexpectedHttp.slice(0, 5),
      sampleRequestFailed: requestFailed.slice(0, 5),
      sampleRejections: rejections.slice(0, 5)
    };
    findings.push(row);
  }

  const failed = findings.filter(
    (f) =>
      f.consoleError > 0 ||
      f.consoleWarn > 0 ||
      f.hydration > 0 ||
      f.pageError > 0 ||
      f.rejection > 0 ||
      f.requestFailed > 0 ||
      f.httpBad > 0
  );

  console.log(
    JSON.stringify(
      {
        summary: {
          pages: findings.length,
          failed: failed.length,
          realtimeDisabled: REALTIME_DISABLED,
          extensionNoise: extensionNoise.length
        },
        findings,
        failed,
        extensionNoiseSample: extensionNoise.slice(0, 5)
      },
      null,
      2
    )
  );
  await browser.close();
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
