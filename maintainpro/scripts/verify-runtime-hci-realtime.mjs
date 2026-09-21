/**
 * Prove notifications + fleet socket.io channels connect for an authorized admin,
 * with no reconnect loop / unexpected console noise.
 *
 * Requires a production web build with NEXT_PUBLIC_REALTIME_NOTIFICATIONS unset/true
 * (baked at build time) and a reachable API origin that hosts the gateways.
 */
import "dotenv/config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const base = process.env.RESPONSIVE_QA_BASE_URL ?? "http://localhost:3011";
const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3000";
const password = process.env.MAINTAINPRO_SEED_PASSWORD;
if (!password) throw new Error("MAINTAINPRO_SEED_PASSWORD required");

/** Known third-party hosts used by fleet map — not MaintainPro defects. */
const ALLOWED_THIRD_PARTY_HOSTS = new Set([
  "router.project-osrm.org",
  "overpass-api.de",
  "tile.openstreetmap.org"
]);
const ALLOWED_THIRD_PARTY_SUFFIXES = [".tile.openstreetmap.org"];

function isExtensionNoise(text) {
  return /chrome-extension:\/\/|moz-extension:\/\/|extension:\/\//i.test(String(text || ""));
}

function hostnameOf(urlOrText) {
  try {
    if (/^https?:\/\//i.test(urlOrText)) return new URL(urlOrText).hostname;
  } catch {
    /* ignore */
  }
  const m = String(urlOrText || "").match(/https?:\/\/([^/\s"']+)/i);
  return m ? m[1] : null;
}

function isAllowedThirdParty(urlOrText) {
  const host = hostnameOf(urlOrText);
  if (!host) return false;
  if (ALLOWED_THIRD_PARTY_HOSTS.has(host)) return true;
  return ALLOWED_THIRD_PARTY_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/** socket.io v4: namespace connect ack looks like `40/notifications,` or `40/fleet,{...}` */
function namespaceFromFrame(payload) {
  const text = String(payload || "");
  const m = text.match(/^40(\/[^,\s]+)(?:,|$)/);
  return m ? m[1] : null;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleErrors = [];
  const consoleWarns = [];
  const extensionNoise = [];
  const socketUrls = [];
  const reconnectSignals = [];
  const namespacesSeen = new Set();
  const wsUrls = [];
  const recentThirdPartyFailures = [];
  let engineOpenCount = 0;

  page.on("console", (msg) => {
    const text = msg.text();
    if (isExtensionNoise(text)) {
      extensionNoise.push(text.slice(0, 160));
      return;
    }
    if (/Failed to load resource:.*status of (4\d\d|5\d\d)/i.test(text)) {
      const statusMatch = text.match(/status of (\d+)/i);
      const status = statusMatch ? Number(statusMatch[1]) : null;
      const correlated = recentThirdPartyFailures.some(
        (f) => (status == null || f.status === status) && Date.now() - f.at < 15_000
      );
      if (correlated || isAllowedThirdParty(text)) return;
    }
    if (msg.type() === "error") consoleErrors.push(text.slice(0, 300));
    if (msg.type() === "warning") consoleWarns.push(text.slice(0, 300));
    if (/reconnect_failed|connect_error|realtime channel unavailable/i.test(text)) {
      reconnectSignals.push(text.slice(0, 200));
    }
  });

  page.on("request", (req) => {
    const url = req.url();
    if (/\/socket\.io\//i.test(url)) {
      socketUrls.push(url.slice(0, 220));
      if (/transport=polling/i.test(url) && /EIO=4/i.test(url) && !/[?&]sid=/i.test(url)) {
        engineOpenCount += 1;
      }
    }
  });

  page.on("websocket", (ws) => {
    wsUrls.push(ws.url().slice(0, 220));
    ws.on("framereceived", (frame) => {
      const ns = namespaceFromFrame(frame.payload);
      if (ns) namespacesSeen.add(ns);
    });
    ws.on("framesent", (frame) => {
      const ns = namespaceFromFrame(frame.payload);
      if (ns) namespacesSeen.add(ns);
    });
  });

  page.on("response", async (res) => {
    const url = res.url();
    if (isAllowedThirdParty(url) && res.status() >= 400) {
      recentThirdPartyFailures.push({ status: res.status(), at: Date.now(), url: url.slice(0, 160) });
    }
    // Long-polling namespace connects appear in response bodies.
    if (!/\/socket\.io\//i.test(url)) return;
    try {
      const body = await res.text();
      for (const part of String(body).split(/\x1e/)) {
        const ns = namespaceFromFrame(part);
        if (ns) namespacesSeen.add(ns);
      }
    } catch {
      /* binary / already consumed — ignore */
    }
  });

  await page.goto(`${base}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.fill('input[type="email"]', "admin@maintainpro.local");
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 }),
    page.click('button[type="submit"]')
  ]);

  // Notifications bell mounts on dashboard shell — hit action-center.
  await page.goto(`${base}/action-center`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(5000);

  const notifConnectedAfterShell =
    namespacesSeen.has("/notifications") || namespacesSeen.has("notifications");

  // Fleet map mounts fleet socket (ADMIN authorized).
  await page.goto(`${base}/fleet`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(6000);

  const fleetConnected = namespacesSeen.has("/fleet") || namespacesSeen.has("fleet");
  const notificationsConnected =
    notifConnectedAfterShell ||
    namespacesSeen.has("/notifications") ||
    namespacesSeen.has("notifications");

  const result = {
    apiOrigin,
    realtimeExpected: true,
    notificationsConnected,
    fleetConnected,
    namespaces: [...namespacesSeen],
    socketRequestCount: socketUrls.length,
    websocketCount: wsUrls.length,
    enginePollingOpens: engineOpenCount,
    sampleSockets: socketUrls.slice(0, 8),
    sampleWebsockets: wsUrls.slice(0, 4),
    consoleError: consoleErrors.length,
    consoleWarn: consoleWarns.length,
    extensionNoise: extensionNoise.length,
    reconnectSignals: reconnectSignals.length,
    sampleErrors: consoleErrors.slice(0, 5),
    sampleWarns: consoleWarns.slice(0, 5),
    sampleReconnect: reconnectSignals.slice(0, 5),
    // Bounded policy is 3 attempts; a storm opens many fresh engine sessions.
    reconnectLoopSuspected: engineOpenCount > 12
  };

  console.log(JSON.stringify(result, null, 2));

  const ok =
    result.notificationsConnected &&
    result.fleetConnected &&
    !result.reconnectLoopSuspected &&
    result.consoleError === 0 &&
    result.consoleWarn === 0 &&
    result.reconnectSignals === 0;

  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
