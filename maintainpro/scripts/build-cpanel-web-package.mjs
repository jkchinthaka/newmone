#!/usr/bin/env node
/**
 * Build a Passenger-compatible cPanel deployment ZIP for the MaintainPro web app.
 *
 * Output:
 *   dist/deployment/cpanel/maintainpro-cpanel-web/
 *   dist/deployment/cpanel/maintainpro-cpanel-web.zip
 *   dist/deployment/cpanel/maintainpro-cpanel-web.zip.sha256
 */
import { createHash } from "node:crypto";
import {
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "..");
const webRoot = path.join(maintainproRoot, "apps", "web");
const outRoot = path.join(maintainproRoot, "dist", "deployment", "cpanel");
const packageName = "maintainpro-cpanel-web";
const packageDir = path.join(outRoot, packageName);
const zipPath = path.join(outRoot, `${packageName}.zip`);
const checksumPath = `${zipPath}.sha256`;

const EXCLUDED_NAME_PATTERNS = [
  /^\.env(\.|$)/i,
  /^\.git$/i,
  /^coverage$/i,
  /^test-results$/i,
  /^playwright-report$/i,
  /\.log$/i,
  /^tests?$/i,
  /^__tests__$/i,
  /\.spec\.(ts|tsx|js|jsx|mjs|cjs)$/i,
  /\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i
];

function fail(message) {
  console.error(`\n[build:cpanel:web] ERROR: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  console.log(`> ${command} ${args.join(" ")}`);
  const npmCmd =
    command === "npm" && process.platform === "win32" ? "npm.cmd" : command;
  const result = spawnSync(npmCmd, args, {
    cwd: options.cwd || maintainproRoot,
    env: { ...process.env, ...options.env },
    stdio: "inherit",
    shell: false
  });
  if (result.status !== 0) {
    fail(`Command failed (${result.status}): ${command} ${args.join(" ")}`);
  }
}

function shouldExclude(name) {
  return EXCLUDED_NAME_PATTERNS.some((re) => re.test(name));
}

function copyFiltered(src, dest) {
  if (!existsSync(src)) {
    fail(`Required path missing: ${src}`);
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest, {
    recursive: true,
    filter: (sourcePath) => {
      const base = path.basename(sourcePath);
      if (shouldExclude(base)) {
        console.log(`  skip: ${path.relative(maintainproRoot, sourcePath)}`);
        return false;
      }
      return true;
    }
  });
}

function findStandaloneLayout() {
  const standaloneRoot = path.join(webRoot, ".next", "standalone");
  if (!existsSync(standaloneRoot)) {
    fail(
      `Next.js standalone output not found at ${path.relative(maintainproRoot, standaloneRoot)}. ` +
        `Ensure DEPLOYMENT_TARGET=cpanel ran next build with output: "standalone".`
    );
  }

  const nestedServer = path.join(standaloneRoot, "apps", "web", "server.js");
  const flatServer = path.join(standaloneRoot, "server.js");

  if (existsSync(nestedServer)) {
    return {
      standaloneRoot,
      appServerDir: path.join(standaloneRoot, "apps", "web"),
      nested: true
    };
  }
  if (existsSync(flatServer)) {
    return {
      standaloneRoot,
      appServerDir: standaloneRoot,
      nested: false
    };
  }

  fail(
    `Could not locate server.js under standalone output. Checked:\n` +
      `  - ${path.relative(maintainproRoot, nestedServer)}\n` +
      `  - ${path.relative(maintainproRoot, flatServer)}`
  );
}

function copyStandaloneRuntime(layout) {
  mkdirSync(packageDir, { recursive: true });

  // Flatten so Passenger sees server.js at package root.
  for (const entry of readdirSync(layout.appServerDir, { withFileTypes: true })) {
    if (shouldExclude(entry.name)) continue;
    if (entry.name === "node_modules") continue;
    const from = path.join(layout.appServerDir, entry.name);
    const to = path.join(packageDir, entry.name);
    copyFiltered(from, to);
  }

  const rootNodeModules = path.join(layout.standaloneRoot, "node_modules");
  if (existsSync(rootNodeModules)) {
    copyFiltered(rootNodeModules, path.join(packageDir, "node_modules"));
  }

  const appNodeModules = path.join(layout.appServerDir, "node_modules");
  if (existsSync(appNodeModules)) {
    // Merge app-local traced modules on top if present.
    copyFiltered(appNodeModules, path.join(packageDir, "node_modules"));
  }

  if (layout.nested) {
    const packagesDir = path.join(layout.standaloneRoot, "packages");
    if (existsSync(packagesDir)) {
      copyFiltered(packagesDir, path.join(packageDir, "packages"));
    }
    // Preserve any other traced top-level dirs except apps (already flattened).
    for (const entry of readdirSync(layout.standaloneRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (["apps", "node_modules", "packages"].includes(entry.name)) continue;
      if (shouldExclude(entry.name)) continue;
      copyFiltered(
        path.join(layout.standaloneRoot, entry.name),
        path.join(packageDir, entry.name)
      );
    }
  }

  const serverJs = path.join(packageDir, "server.js");
  if (!existsSync(serverJs)) {
    fail(`standalone copy incomplete: missing ${path.relative(maintainproRoot, serverJs)}`);
  }
  const pkgJson = path.join(packageDir, "package.json");
  if (!existsSync(pkgJson)) {
    fail(`standalone copy incomplete: missing ${path.relative(maintainproRoot, pkgJson)}`);
  }
}

function writePassengerAppJs() {
  const contents = `/**
 * Passenger entrypoint for MaintainPro web (cPanel).
 * Uses the hosting-provided PORT — do not hard-code 3000.
 */
process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
require("./server.js");
`;
  writeFileSync(path.join(packageDir, "app.js"), contents, "utf8");
}

function writeBuildMetadata() {
  const deploymentDir = path.join(packageDir, "deployment");
  mkdirSync(deploymentDir, { recursive: true });

  let commitSha = "unknown";
  try {
    const r = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: maintainproRoot,
      encoding: "utf8"
    });
    if (r.status === 0) commitSha = r.stdout.trim();
  } catch {
    /* ignore */
  }

  const metadata = {
    package: packageName,
    builtAt: new Date().toISOString(),
    commitSha,
    deploymentTarget: "cpanel",
    nextOutput: "standalone",
    nodeHint: "Node.js 18+ recommended for Passenger",
    notes: [
      "This archive contains no .env files. Configure environment variables in cPanel.",
      "Passenger must start app.js; PORT is provided by the host."
    ]
  };
  writeFileSync(
    path.join(deploymentDir, "build-metadata.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8"
  );

  const installDoc = `# MaintainPro web — cPanel (Passenger) install

## Upload

1. Upload \`maintainpro-cpanel-web.zip\` to the cPanel account.
2. Extract into the application root (or a subdirectory mapped to the domain).
3. In **Setup Node.js App** (or Application Manager), set:
   - **Application startup file:** \`app.js\`
   - **Application root:** the extracted \`maintainpro-cpanel-web\` directory
   - **Node.js version:** 18.x or 20.x

Passenger injects \`PORT\`. Do not set port \`3000\` manually unless your host documents that requirement.

## Required environment variables

Set these in the cPanel Node.js app environment (not in a committed \`.env\`):

| Variable | Purpose |
| --- | --- |
| \`NODE_ENV\` | \`production\` |
| \`NEXT_PUBLIC_API_URL\` | Backend API base including \`/api\` (e.g. \`https://api.example.com/api\`) |
| \`NEXT_PUBLIC_API_BASE_URL\` | Same as API URL (compatibility) |
| \`NEXT_PUBLIC_API_ORIGIN\` | API origin without path (CSP + BFF upstream) |
| \`NEXT_PUBLIC_API_TIMEOUT_MS\` | Optional; default client timeout |
| \`NEXT_PUBLIC_USE_BFF\` | Leave unset/\`true\` for same-origin \`/api/backend\` proxy; set \`false\` only for direct API calls |
| \`NEXT_PUBLIC_APP_ENVIRONMENT\` | Optional build/runtime label (\`staging\` / \`production\`) |
| \`NEXT_PUBLIC_APP_COMMIT_SHA\` | Optional release identifier |
| \`NEXT_PUBLIC_APP_VERSION\` | Optional display version |

Server-side BFF routes also read the upstream API URL from \`NEXT_PUBLIC_API_URL\` / \`NEXT_PUBLIC_API_BASE_URL\`.

## Verify

1. Restart the Node.js application in cPanel.
2. Open the site URL and confirm login / health UI loads.
3. Confirm \`GET /api/build-info\` (or the packaged metadata under \`deployment/build-metadata.json\`).

## Notes

- This package is **web-only**. The NestJS API must be hosted separately (e.g. Render).
- Cloudflare Workers deploy remains available via \`npm run cloudflare:build\`.
- Do not upload repository \`.env\` files into the document root.
`;
  writeFileSync(path.join(deploymentDir, "INSTALL.md"), installDoc, "utf8");
}

function assertNoSecretsInPackage() {
  const stack = [packageDir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        stack.push(full);
        continue;
      }
      if (/^\.env(\.|$)/i.test(entry.name) || entry.name.endsWith(".pem")) {
        fail(`Refusing to package secret-like file: ${path.relative(packageDir, full)}`);
      }
    }
  }
}

function createZipArchive() {
  if (existsSync(zipPath)) rmSync(zipPath, { force: true });

  // Prefer system tar (available on modern Windows / macOS / Linux) so .next is included.
  const tarResult = spawnSync(
    "tar",
    ["-a", "-c", "-f", zipPath, packageName],
    { cwd: outRoot, encoding: "utf8" }
  );
  if (tarResult.status === 0 && existsSync(zipPath) && statSync(zipPath).size > 0) {
    return;
  }

  if (process.platform === "win32") {
    const ps = `
$ErrorActionPreference = 'Stop'
Compress-Archive -Path '${packageDir.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force
`;
    const psResult = spawnSync("powershell", ["-NoProfile", "-Command", ps], {
      encoding: "utf8"
    });
    if (psResult.status === 0 && existsSync(zipPath) && statSync(zipPath).size > 0) {
      return;
    }
    fail(
      `Failed to create ZIP via tar and Compress-Archive.\n` +
        `tar: ${tarResult.stderr || tarResult.stdout || tarResult.error}\n` +
        `powershell: ${psResult.stderr || psResult.stdout || psResult.error}`
    );
  }

  fail(`Failed to create ZIP at ${zipPath}: ${tarResult.stderr || tarResult.error || "unknown error"}`);
}

function writeChecksum() {
  const hash = createHash("sha256").update(readFileSync(zipPath)).digest("hex");
  writeFileSync(checksumPath, `${hash}  ${path.basename(zipPath)}\n`, "utf8");
  return hash;
}

function main() {
  console.log("[build:cpanel:web] Cleaning dist/deployment/cpanel ...");
  rmSync(outRoot, { recursive: true, force: true });
  mkdirSync(outRoot, { recursive: true });

  console.log("[build:cpanel:web] Building shared-types ...");
  run("npm", ["run", "build", "--workspace", "@maintainpro/shared-types"]);

  console.log("[build:cpanel:web] Building web with DEPLOYMENT_TARGET=cpanel ...");
  run("npm", ["run", "build", "--workspace", "@maintainpro/web"], {
    env: {
      DEPLOYMENT_TARGET: "cpanel",
      NODE_ENV: "production"
    }
  });

  const staticDir = path.join(webRoot, ".next", "static");
  const publicDir = path.join(webRoot, "public");
  if (!existsSync(staticDir)) {
    fail(`Missing Next.js static assets at ${path.relative(maintainproRoot, staticDir)}`);
  }
  if (!existsSync(publicDir)) {
    fail(`Missing public directory at ${path.relative(maintainproRoot, publicDir)}`);
  }

  const layout = findStandaloneLayout();
  console.log(
    `[build:cpanel:web] Standalone layout: ${layout.nested ? "monorepo-nested" : "flat"}`
  );

  console.log("[build:cpanel:web] Copying standalone runtime ...");
  copyStandaloneRuntime(layout);

  console.log("[build:cpanel:web] Copying public and .next/static ...");
  copyFiltered(publicDir, path.join(packageDir, "public"));
  mkdirSync(path.join(packageDir, ".next"), { recursive: true });
  copyFiltered(staticDir, path.join(packageDir, ".next", "static"));

  mkdirSync(path.join(packageDir, "tmp"), { recursive: true });
  writeFileSync(path.join(packageDir, "tmp", ".gitkeep"), "", "utf8");

  writePassengerAppJs();
  writeBuildMetadata();
  assertNoSecretsInPackage();

  const required = ["app.js", "server.js", "package.json", "public", path.join(".next", "static"), "tmp", "deployment"];
  for (const rel of required) {
    const full = path.join(packageDir, rel);
    if (!existsSync(full)) {
      fail(`Package incomplete — missing ${rel}`);
    }
  }

  console.log("[build:cpanel:web] Creating ZIP ...");
  createZipArchive();
  const sha256 = writeChecksum();
  const zipSize = statSync(zipPath).size;

  console.log("\n[build:cpanel:web] SUCCESS");
  console.log(`  package: ${path.relative(maintainproRoot, packageDir)}`);
  console.log(`  zip:     ${path.relative(maintainproRoot, zipPath)} (${zipSize} bytes)`);
  console.log(`  sha256:  ${sha256}`);
}

main();