#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseEnvText,
  validateProductionConfig
} from "../lib/production-config-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;
const check = (id, ok, d) => {
  if (ok) console.log(`PASS ${id}: ${d}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}: ${d}`);
  }
};

const fixture = path.join(root, ".env.production.security-fixture.example");
check("SEC-CONFIG-001", existsSync(fixture), "security fixture exists");
const env = parseEnvText(readFileSync(fixture, "utf8"));
const good = validateProductionConfig(env, { requireAll: true });
check("SEC-CONFIG-001b", good.ok, good.ok ? "fixture validates" : good.findings[0]?.category);

const cookie = validateProductionConfig(
  { ...env, COOKIE_SECURE: "true", FRONTEND_URL: "https://app.example.invalid" },
  { requireAll: false }
);
check("SEC-TLS-001", cookie.ok || !cookie.findings.some((f) => f.category.includes("cookie")), "secure cookie fixture");

const dual = validateProductionConfig(
  {
    ...env,
    COOKIE_SECURE: "false",
    ALLOW_INSECURE_HTTP: "true",
    FRONTEND_URL: "http://app.example.invalid",
    CORS_ORIGIN: "http://app.example.invalid",
    NEXT_PUBLIC_API_ORIGIN: "http://app.example.invalid"
  },
  { requireAll: false }
);
check(
  "SEC-TLS-002",
  dual.findings.every((f) => f.category !== "insecure_cookie_mismatch"),
  "HTTP dual opt-in accepted when both flags set"
);

if (failed) process.exit(1);
console.log("All production-config-contract selftests passed.");
