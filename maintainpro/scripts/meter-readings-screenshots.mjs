import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import esbuild from "esbuild";
import { chromium } from "playwright";

const webRoot = resolve("apps/web");
const outDir = resolve("docs/handover/ui-redesign/meter-readings");
const cssPath = join(tmpdir(), "meter-readings-preview.css");
const jsPath = join(tmpdir(), "meter-readings-preview.js");
mkdirSync(outDir, { recursive: true });

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited ${result.status}`);
  }
}

run("npx", ["tailwindcss", "-i", "app/globals.css", "-o", cssPath], webRoot);
await esbuild.build({
  absWorkingDir: webRoot,
  entryPoints: ["components/utilities/meter-readings/screenshot-preview.tsx"],
  bundle: true,
  outfile: jsPath,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  banner: { js: "var process = window.process || { env: { NODE_ENV: 'production' } };" },
  plugins: [
    {
      name: "at-alias",
      setup(build) {
        build.onResolve({ filter: /^@\// }, (args) => {
          const base = join(webRoot, args.path.slice(2));
          const path = [base, `${base}.tsx`, `${base}.ts`, `${base}.js`, join(base, "index.tsx"), join(base, "index.ts")].find(
            (candidate) => existsSync(candidate) && statSync(candidate).isFile()
          );
          if (!path) return { errors: [{ text: `Cannot resolve ${args.path}` }] };
          return { path };
        });
      }
    }
  ]
});

const css = readFileSync(cssPath, "utf8");
const js = readFileSync(jsPath, "utf8");
const widths = [360, 390, 768, 1280, 1440];
const states = ["search", "record", "warning"];

function html(state) {
  return `<!doctype html>
<html lang="en" style="color-scheme:light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${css}</style>
</head>
<body style="margin:0;background:#EAF5ED">
  <div id="root"></div>
  <script>window.__meterState=${JSON.stringify(state)};</script>
  <script>${js}</script>
</body>
</html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (error) => console.error("PAGE", error.message));
page.on("console", (message) => {
  if (message.type() === "error") console.error("CONSOLE", message.text());
});
const overflows = [];
const missing = [];

for (const state of states) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(html(state), { waitUntil: "load" });
    const ready = await page.waitForSelector("h1", { timeout: 8000 }).then(() => true).catch(() => false);
    if (!ready) {
      const body = await page.evaluate(() => document.body.innerText.slice(0, 500));
      console.error("NO H1", state, width, body);
      missing.push(`${state}-${width}`);
      continue;
    }
    await page.waitForTimeout(300);
    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const offenders = [...document.querySelectorAll("body *")]
        .filter((node) => node instanceof HTMLElement && node.scrollWidth > node.clientWidth + 1 && node.clientWidth > 0)
        .slice(0, 6)
        .map((node) => ({
          tag: node.tagName,
          className: String(node.className).slice(0, 140),
          scrollWidth: node.scrollWidth,
          clientWidth: node.clientWidth
        }));
      return {
        overflow: root.scrollWidth - root.clientWidth,
        scrollWidth: root.scrollWidth,
        clientWidth: root.clientWidth,
        offenders
      };
    });
    if (metrics.overflow > 0) overflows.push({ state, width, ...metrics });
    await page.screenshot({ path: join(outDir, `${state}-${width}.png`), fullPage: true });
    console.log(`${state} ${width} overflow ${metrics.overflow}`);
  }
}

await browser.close();
if (missing.length) {
  console.error("Missing screenshots", missing.join(", "));
  process.exit(1);
}
if (overflows.length) {
  writeFileSync(join(outDir, "overflow.json"), JSON.stringify(overflows, null, 2));
  console.error(JSON.stringify(overflows, null, 2));
  process.exit(1);
}
