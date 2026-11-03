import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Machinery / Service / Vehicle Jobs pages filter on WorkOrder.jobDomain. A job created without it
 * shows on none of the three pages, so every direct workOrder.create must stamp a category.
 */
const SERVICES = [
  "src/modules/accidents/accidents.service.ts",
  "src/modules/fleet-lifecycle/fleet-lifecycle.service.ts",
  "src/modules/traffic-fines/traffic-fines.service.ts",
  "src/modules/predictive-ai/predictive-ai.service.ts",
  "src/modules/notifications/notifications.service.ts"
];

describe("work order job category stamping", () => {
  it.each(SERVICES)("%s sets jobDomain on every workOrder.create", (file) => {
    const source = readFileSync(join(__dirname, "..", file), "utf8");
    const creates = source.split(/workOrder\.create\(\s*\{/).slice(1);
    expect(creates.length).toBeGreaterThan(0);
    for (const block of creates) {
      expect(block.slice(0, 1500)).toMatch(/jobDomain\s*:/);
    }
  });

  it("ships a backfill so older jobs get a category", () => {
    const sql = join(__dirname, "../../../prisma/migrations/20261028150000_work_order_job_domain_backfill/migration.sql");
    expect(existsSync(sql)).toBe(true);
    const text = readFileSync(sql, "utf8");
    expect(text).toMatch(/WHERE \[jobDomain\] IS NULL/);
    expect(text).not.toMatch(/^\s*GO\s*$/m);
  });
});
