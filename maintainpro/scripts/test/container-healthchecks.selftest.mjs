#!/usr/bin/env node
/**
 * HEALTH-001 ... HEALTH-010 regression self-tests for container healthchecks.
 * Uses a child HTTP server process — no Docker, no secrets, no real .env.
 * Note: do not host the probe target in the same process as spawnSync (deadlocks the event loop).
 */

import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { createServer } from "node:http";
import net from "node:net";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const script = path.join(root, "scripts/container-http-healthcheck.cjs");

let failed = 0;
function check(id, condition, detail) {
  if (condition) {
    console.log(`PASS ${id}${detail ? ": " + detail : ""}`);
  } else {
    failed += 1;
    console.error(`FAIL ${id}${detail ? ": " + detail : ""}`);
  }
}

function runHealth(args) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    timeout: 15000
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
    srv.on("error", reject);
  });
}

async function withProbeServer(statusCode, fn) {
  const port = await freePort();
  const helper = path.join(root, "scripts/test/_tmp-health-probe-server.cjs");
  writeFileSync(
    helper,
    `"use strict";
const http=require("node:http");
const port=Number(process.argv[2]);
const code=Number(process.argv[3]);
http.createServer((q,r)=>{r.writeHead(code);r.end("ok");}).listen(port,"127.0.0.1",()=>process.stdout.write("ready"));
`,
    "utf8"
  );
  const child = spawn(process.execPath, [helper, String(port), String(statusCode)], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("probe server timeout")), 5000);
    child.stdout.once("data", () => {
      clearTimeout(t);
      resolve();
    });
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error("probe server exited " + code)));
  });
  try {
    return await fn(port);
  } finally {
    child.kill("SIGTERM");
    try {
      unlinkSync(helper);
    } catch {
      /* ignore */
    }
  }
}

check("HEALTH-001", existsSync(script), "healthcheck script exists (Node executable path)");

const apiDocker = readFileSync(path.join(root, "apps/api/Dockerfile"), "utf8");
const webDocker = readFileSync(path.join(root, "apps/web/Dockerfile"), "utf8");
check(
  "HEALTH-001b",
  apiDocker.includes("container-http-healthcheck.cjs") && !/apk add[^\n]*wget/.test(apiDocker),
  "API image ships Node health script without wget package"
);
check(
  "HEALTH-005",
  webDocker.includes("container-http-healthcheck.cjs") && !/apk add[^\n]*wget/.test(webDocker),
  "Web image ships Node health script without wget package"
);

const baseCompose = readFileSync(path.join(root, "docker-compose.yml"), "utf8");
const e2eCompose = readFileSync(path.join(root, "docker-compose.e2e.yml"), "utf8");
const workflow = readFileSync(
  path.join(root, "../.github/workflows/full-stack-e2e.yml"),
  "utf8"
);

check(
  "HEALTH-006",
  /nginx:[\s\S]*?healthcheck:[\s\S]*?\/api\/health/.test(baseCompose) &&
    /nginx:[\s\S]*?healthcheck:[\s\S]*?\/login/.test(baseCompose),
  "Nginx healthcheck verifies proxied routes"
);

check(
  "HEALTH-007",
  baseCompose.includes("condition: service_healthy") &&
    /web:[\s\S]*?depends_on:[\s\S]*?api:[\s\S]*?service_healthy/.test(baseCompose) &&
    /nginx:[\s\S]*?depends_on:[\s\S]*?api:[\s\S]*?service_healthy/.test(baseCompose),
  "E2E/base Compose waits for healthy API before Web/Nginx"
);

check(
  "HEALTH-008",
  workflow.includes("Wait for health") &&
    workflow.includes("compose-ps") &&
    !workflow.includes("docker inspect") &&
    workflow.includes("REDACTED"),
  "CI timeout diagnostics without env dumps"
);

check(
  "HEALTH-009",
  !/nelnafarm|20\.15\./i.test(e2eCompose) && e2eCompose.includes("127.0.0.1"),
  "No production host/IP in E2E health configuration"
);

check(
  "HEALTH-010",
  baseCompose.includes("container-http-healthcheck.cjs") &&
    e2eCompose.includes("container-http-healthcheck.cjs") &&
    apiDocker.includes("/usr/local/bin/container-http-healthcheck.cjs"),
  "Healthcheck commands compatible with production image stages"
);

await withProbeServer(200, async (port) => {
  const ok = runHealth([
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--path",
    "/",
    "--expect",
    "200",
    "--timeout-ms",
    "2000"
  ]);
  check("HEALTH-002", ok.status === 0, "API healthcheck passes on HTTP 200");
});

await withProbeServer(503, async (port) => {
  const bad = runHealth([
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--path",
    "/",
    "--expect",
    "200",
    "--timeout-ms",
    "2000"
  ]);
  check("HEALTH-003", bad.status === 1, "API healthcheck fails on non-200");
});

const refused = runHealth([
  "--host",
  "127.0.0.1",
  "--port",
  "1",
  "--path",
  "/api/health",
  "--expect",
  "200",
  "--timeout-ms",
  "500"
]);
check("HEALTH-004", refused.status === 1, "API healthcheck fails on connection refusal");

// Ensure http timeout module path still loads (unused createServer import kept for clarity)
void createServer;

if (failed > 0) {
  console.error("container-healthchecks.selftest: " + failed + " failed");
  process.exit(1);
}
console.log("container-healthchecks.selftest: all passed");