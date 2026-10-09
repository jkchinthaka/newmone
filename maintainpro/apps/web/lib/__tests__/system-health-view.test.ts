import assert from "node:assert/strict";
import test from "node:test";

import { compactSystemHealthRows, configurationWarnings, type HealthCheckInput } from "../system-health-view";

const checks: HealthCheckInput[] = [
  { key: "primaryDatabase", label: "Primary database", status: "operational", message: "Connected." },
  { key: "redis", label: "Redis", status: "degraded", message: "Slow.", action: "Check the Redis host." },
  { key: "objectStorage", label: "Object storage", status: "unconfigured", action: "Set the storage endpoint." },
  { key: "email", label: "Email", status: "operational", message: "Provider ready." },
  { key: "sms", label: "SMS", status: "disabled" },
  { key: "erp", label: "ERP", status: "failed", message: "Sync failed.", action: "Review ERP credentials." },
  { key: "oauthGoogle", label: "Google OAuth", status: "unconfigured", action: "Add OAuth client settings." }
];

test("compact rows cover the operator status list and combine email with SMS", () => {
  const rows = compactSystemHealthRows(checks, "degraded");
  assert.deepEqual(
    rows.map((row) => [row.id, row.status]),
    [
      ["api", "degraded"],
      ["database", "operational"],
      ["redis", "degraded"],
      ["storage", "unconfigured"],
      ["messaging", "operational"],
      ["erp", "failed"]
    ]
  );
});

test("warnings keep only checks that tell the operator what to change", () => {
  const warnings = configurationWarnings(checks);
  assert.deepEqual(
    warnings.map((warning) => warning.key),
    ["redis", "objectStorage", "erp", "oauthGoogle"]
  );
  assert.equal(warnings.find((warning) => warning.key === "redis")?.detail, "Check the Redis host.");
});
