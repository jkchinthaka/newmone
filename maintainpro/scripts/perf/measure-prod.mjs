import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const envText = readFileSync("C:/Users/chint/OneDrive/Pictures/newmone/maintainpro/.env", "utf8");
const password = envText.match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m)?.[1]?.trim();
if (!password) process.exit(2);

const base = process.env.PERF_BASE || "http://127.0.0.1:3019";
const login = await fetch(`${base}/api/backend/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@maintainpro.local", password }),
  signal: AbortSignal.timeout(30000)
});
const setCookies = login.headers.getSetCookie?.() ?? [];
console.log(JSON.stringify({ event: "login", status: login.status, ms: 0, cookies: setCookies.length }));
if (login.status !== 200 || setCookies.length === 0) process.exit(3);
const cookies = setCookies.map((line) => {
  const [pair, ...attrs] = line.split(";").map((part) => part.trim());
  const eq = pair.indexOf("=");
  const attr = new Map(attrs.map((item) => {
    const [key, raw] = item.split("=");
    return [key.toLowerCase(), raw ?? ""];
  }));
  return {
    name: pair.slice(0, eq),
    value: pair.slice(eq + 1),
    domain: "127.0.0.1",
    path: attr.get("path") || "/",
    httpOnly: attr.has("httponly"),
    secure: false,
    sameSite: "Lax"
  };
});

const ready = {
  "/maintenance/jobs": () => {
    const text = document.querySelector("main")?.innerText ?? "";
    const loading = text.includes("Loading work order") || text.includes("Checking access");
    const rows = document.querySelectorAll("table tbody tr, [data-work-order-card], .space-y-2 > article, .space-y-2 > a, .space-y-2 > button").length;
    return !loading && text.includes("Work") && (rows > 0 || /No work|Unable to load/i.test(text));
  },
  "/assets": () => {
    const text = document.querySelector("main")?.innerText ?? "";
    return !text.includes("Loading assets") && !text.includes("Checking access") && text.includes("Asset") && (document.querySelectorAll("table tbody tr, ul li").length > 0 || /Unable to load assets|match these filters/i.test(text));
  },
  "/inventory": () => {
    const text = document.querySelector("main")?.innerText ?? "";
    return text.includes("Inventory Control Center") && !text.includes("Loading inventory") && (document.querySelectorAll("main table tbody tr, main ul li").length > 0 || text.includes("No inventory") || text.includes("Unable to load inventory"));
  },
  "/fleet/gate": () => {
    const text = document.querySelector("main")?.innerText ?? "";
    return text.includes("Fleet Gate Operations") && !text.includes("Loading vehicles") && (document.querySelectorAll("main table tbody tr, main ul li").length > 0 || text.includes("No fleet") || text.includes("Unable to load vehicles"));
  },
  "/requests": () => {
    const text = document.querySelector("main")?.innerText ?? "";
    const live = document.querySelector("[aria-live='polite']")?.textContent ?? "";
    return text.includes("Maintenance Requests") && !live.includes("Loading") && (document.querySelectorAll("table tbody tr, .space-y-2 > *").length > 0 || /no requests|couldn't load/i.test(text));
  },
  "/reports": () => {
    const text = document.querySelector("main")?.innerText ?? "";
    return text.includes("Report") && !text.includes("Checking access") && !/Loading reports/i.test(text);
  },
  "/action-center": () => {
    const text = document.querySelector("main")?.innerText ?? "";
    return text.length > 80 && !text.includes("Checking access");
  }
};

const browser = await chromium.launch({ headless: true });

async function run(label, viewport, mode) {
  const context = await browser.newContext({ viewport });
  await context.addCookies(cookies);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text().slice(0, 180));
  });
  const homeStart = Date.now();
  await page.goto(`${base}/action-center`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(ready["/action-center"], { timeout: 30000 });
  console.log(JSON.stringify({ event: "home-document", label, ms: Date.now() - homeStart }));
  if (mode === "sidebar") {
    for (let i = 0; i < 12; i += 1) {
      const button = page.locator("aside button[aria-expanded='false']").first();
      if ((await button.count()) === 0) break;
      await button.click();
    }
  }

  async function clickPath(path) {
    const apis = [];
    if (mode === "sidebar") {
      if ((await page.locator(`aside a[href='${path}']`).count()) === 0) {
        for (let i = 0; i < 8; i += 1) {
          const button = page.locator("aside button[aria-expanded='false']").first();
          if ((await button.count()) === 0) break;
          await button.click();
        }
      }
    } else if (path !== "/action-center" && path !== "/maintenance/jobs") {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      const drawer = page.locator("#mobile-navigation-drawer");
      for (let i = 0; i < 8; i += 1) {
        const button = drawer.locator("button[aria-expanded='false']").first();
        if ((await button.count()) === 0) break;
        await button.click();
      }
    }
    await page.evaluate(() => { window.__spa = 1; });
    const clickAt = Date.now();
    const onResponse = (response) => {
      const url = response.url();
      if (!url.includes("/api/") || url.includes("/_next/")) return;
      const pathname = new URL(url).pathname.replace(/^\/api\/backend/, "").replace(/^\/api/, "");
      if (!/work-orders\/queues|\/assets|\/inventory\/|\/vehicles|maintenance-requests|\/reports/.test(pathname)) return;
      apis.push({ path: pathname.split("?")[0], status: response.status(), ms: Date.now() - clickAt });
    };
    page.on("response", onResponse);
    if (mode === "sidebar") {
      await page.locator(`aside a[href='${path}']`).first().click();
    } else if (path === "/action-center" || path === "/maintenance/jobs") {
      const name = path === "/action-center" ? "Home" : "Work Orders";
      await page.locator("nav[aria-label='Quick navigation']").getByRole("link", { name }).click();
    } else {
      await page.locator("#mobile-navigation-drawer").locator(`a[href='${path}']`).first().click();
    }
    const urlAt = await page.waitForURL((url) => url.pathname === path, { timeout: 20000 }).then(() => Date.now() - clickAt);
    let headingAt = null;
    try {
      await page.locator("main h1, main h2").first().waitFor({ timeout: 15000 });
      headingAt = Date.now() - clickAt;
    } catch { headingAt = null; }
    let dataAt = null;
    try {
      await page.waitForFunction(ready[path], { timeout: 20000 });
      dataAt = Date.now() - clickAt;
    } catch { dataAt = null; }
    const documentReload = await page.evaluate(() => window.__spa !== 1);
    page.off("response", onResponse);
    return { url: page.url().replace(base, ""), urlMs: urlAt, headingMs: headingAt, dataMs: dataAt, documentReload, api: apis.slice(0, 5) };
  }

  const hops = [
    ["/maintenance/jobs", "Home to Work Orders"],
    ["/assets", "Work Orders to Assets"],
    ["/inventory", "Assets to Inventory"],
    ["/fleet/gate", "Inventory to Fleet Gate"],
    ["/action-center", "return Home"],
    ["/requests", "Home to Requests"],
    ["/action-center", "return Home"],
    ["/reports", "Home to Reports"]
  ];
  for (let pass = 0; pass < 4; pass += 1) {
    if (pass > 0) await clickPath("/action-center");
    let atJobs = page.url().includes("/maintenance/jobs");
    for (const [path, name] of hops) {
      if (path === "/assets" && !page.url().includes("/maintenance/jobs")) await clickPath("/maintenance/jobs");
      if ((path === "/requests" || path === "/reports") && !page.url().includes("/action-center")) await clickPath("/action-center");
      const row = await clickPath(path);
      if (pass === 0 || path !== "/action-center") console.log(JSON.stringify({ label, pass, name, ...row }));
      atJobs = path === "/maintenance/jobs";
      void atJobs;
    }
  }
  const rsc = errors.filter((line) => line.includes("RSC") || line.includes("Falling back"));
  console.log(JSON.stringify({ event: "errors", label, rsc: rsc.slice(0, 3), other: errors.filter((line) => !rsc.includes(line)).slice(0, 3) }));
  await context.close();
}

if (process.env.PERF_ONLY !== "mobile") {
  await run("desktop", { width: 1440, height: 900 }, "sidebar");
}
await run("mobile", { width: 390, height: 844 }, "mobile");
await browser.close();
