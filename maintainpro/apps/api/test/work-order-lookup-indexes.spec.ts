import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../../..");
const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const migration = readFileSync(path.join(root, "prisma/migrations/20261031100000_work_order_lookup_indexes/migration.sql"), "utf8");
const workOrder = schema.slice(schema.indexOf("model WorkOrder {"), schema.indexOf("\n}\n", schema.indexOf("model WorkOrder {")));

describe("WorkOrder lookup indexes", () => {
  it.each(["vehicleId", "departmentId", "createdById"])("schema and migration both index (tenantId, %s)", (field) => {
    expect(workOrder).toContain(`@@index([tenantId, ${field}])`);
    expect(migration).toContain(`[WorkOrder_tenantId_${field}_idx] ON [dbo].[WorkOrder]([tenantId], [${field}])`);
  });

  it("the migration only adds indexes, safely re-runnable, and changes no data or columns", () => {
    expect(migration).not.toMatch(/\b(DROP|DELETE|UPDATE|ALTER\s+TABLE|TRUNCATE|INSERT)\b/i);
    expect((migration.match(/IF NOT EXISTS/g) ?? []).length).toBe(3);
  });
});
