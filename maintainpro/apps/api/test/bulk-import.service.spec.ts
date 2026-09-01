import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { BulkImportMode, BulkImportRowAction, BulkImportRunStatus, RoleName } from "@prisma/client";

import { AssetBulkImportAdapter } from "../src/modules/bulk-import/adapters/asset.adapter";
import { DepartmentBulkImportAdapter } from "../src/modules/bulk-import/adapters/department.adapter";
import { JobCodeBulkImportAdapter } from "../src/modules/bulk-import/adapters/job-code.adapter";
import { SupplierBulkImportAdapter } from "../src/modules/bulk-import/adapters/supplier.adapter";
import { VehicleBulkImportAdapter } from "../src/modules/bulk-import/adapters/vehicle.adapter";
import { BulkImportAdapterRegistry } from "../src/modules/bulk-import/bulk-import-adapter-registry.service";
import { BulkImportParserService } from "../src/modules/bulk-import/bulk-import-parser.service";
import { BulkImportService } from "../src/modules/bulk-import/bulk-import.service";

const TENANT_1 = "tenant-1";
const TENANT_2 = "tenant-2";
const actor = { sub: "user-1", email: "admin@test.local", role: RoleName.SUPER_ADMIN, tenantId: TENANT_1 };

function csvFile(name: string, content: string) {
  const buffer = Buffer.from(content, "utf-8");
  return { originalname: name, mimetype: "text/csv", size: buffer.length, buffer };
}

function buildHarness() {
  const runs = new Map<string, any>();
  const rows = new Map<string, any>();
  const departments = new Map<string, any>();
  const vehicles = new Map<string, any>();
  let runSeq = 0;
  let rowSeq = 0;
  let deptSeq = 0;
  let vehicleSeq = 0;

  const prisma: any = {
    bulkImportRun: {
      create: jest.fn(async ({ data }: any) => {
        runSeq += 1;
        const run = { id: `run-${runSeq}`, ...data };
        runs.set(run.id, run);
        return run;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const run = runs.get(where.id);
        if (!run) return null;
        if (where.tenantId && run.tenantId !== where.tenantId) return null;
        if (where.entityType && run.entityType !== where.entityType) return null;
        return run;
      }),
      findUnique: jest.fn(async ({ where }: any) => runs.get(where.id) ?? null),
      findMany: jest.fn(async ({ where, skip, take }: any) => {
        let list = Array.from(runs.values()).filter(
          (run) => run.tenantId === where.tenantId && (!where.entityType || run.entityType === where.entityType)
        );
        list = list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        if (typeof skip === "number") list = list.slice(skip);
        if (typeof take === "number") list = list.slice(0, take);
        return list;
      }),
      count: jest.fn(async ({ where }: any) =>
        Array.from(runs.values()).filter(
          (run) => run.tenantId === where.tenantId && (!where.entityType || run.entityType === where.entityType)
        ).length
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const next = { ...runs.get(where.id), ...data };
        runs.set(where.id, next);
        return next;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const current = runs.get(where.id);
        if (!current) return { count: 0 };
        if (where.status && current.status !== where.status) return { count: 0 };
        runs.set(where.id, { ...current, ...data });
        return { count: 1 };
      })
    },
    bulkImportRow: {
      createMany: jest.fn(async ({ data }: any) => {
        for (const row of data) {
          rowSeq += 1;
          const id = `row-${rowSeq}`;
          rows.set(id, { id, ...row });
        }
        return { count: data.length };
      }),
      findMany: jest.fn(async ({ where, take }: any) => {
        let list = Array.from(rows.values()).filter((row) => row.runId === where.runId);
        if (where.action) {
          list = where.action.in ? list.filter((row) => where.action.in.includes(row.action)) : list.filter((row) => row.action === where.action);
        }
        list = list.sort((a, b) => a.rowNumber - b.rowNumber);
        if (typeof take === "number") list = list.slice(0, take);
        return list;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const next = { ...rows.get(where.id), ...data };
        rows.set(where.id, next);
        return next;
      })
    },
    auditLog: {
      create: jest.fn(async ({ data }: any) => ({ id: `audit-${runSeq}-${rowSeq}`, ...data }))
    },
    department: {
      findMany: jest.fn(async ({ where }: any) =>
        Array.from(departments.values()).filter(
          (dept) => dept.tenantId === where.tenantId && (!where.code?.in || where.code.in.includes(dept.code))
        )
      ),
      create: jest.fn(async ({ data }: any) => {
        deptSeq += 1;
        const dept = { id: `dept-${deptSeq}`, isActive: true, ...data };
        departments.set(dept.id, dept);
        return dept;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const next = { ...departments.get(where.id), ...data };
        departments.set(where.id, next);
        return next;
      })
    },
    vehicle: {
      findMany: jest.fn(async ({ where }: any) =>
        Array.from(vehicles.values()).filter((vehicle) => where.registrationNo?.in?.includes(vehicle.registrationNo))
      ),
      create: jest.fn(async ({ data }: any) => {
        vehicleSeq += 1;
        const vehicle = { id: `veh-${vehicleSeq}`, ...data };
        vehicles.set(vehicle.id, vehicle);
        return vehicle;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const next = { ...vehicles.get(where.id), ...data };
        vehicles.set(where.id, next);
        return next;
      })
    },
    asset: { findMany: jest.fn(async () => []), create: jest.fn(), update: jest.fn() },
    supplier: { findMany: jest.fn(async () => []), create: jest.fn(), update: jest.fn() },
    jobCode: { findMany: jest.fn(async () => []), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma)))
  };

  const registry = new BulkImportAdapterRegistry(
    new VehicleBulkImportAdapter(prisma),
    new AssetBulkImportAdapter(prisma),
    new DepartmentBulkImportAdapter(prisma),
    new SupplierBulkImportAdapter(prisma),
    new JobCodeBulkImportAdapter(prisma)
  );
  const service = new BulkImportService(prisma, new BulkImportParserService(), registry);

  return { service, prisma, runs, rows, departments, vehicles };
}

describe("BulkImportService", () => {
  it("preview never mutates the target collection", async () => {
    const { service, departments } = buildHarness();
    const file = csvFile("departments.csv", "Code,Name\nMAINT,Maintenance\n");
    const result = await service.preview("department", actor, undefined, file);

    expect(departments.size).toBe(0);
    expect(result.summary.createCount).toBe(1);
    expect(result.run.status).toBe(BulkImportRunStatus.VALIDATED);
    expect(result.blocked).toBe(false);
  });

  it("flags duplicate natural keys within the same file and skips both rows (never last-row-wins)", async () => {
    const { service } = buildHarness();
    const file = csvFile("departments.csv", "Code,Name\nMAINT,Maintenance\nMAINT,Maintenance Dept\n");
    const result = await service.preview("department", actor, undefined, file);

    expect(result.rows.every((row: any) => row.action === BulkImportRowAction.SKIP_DUPLICATE_FILE_ROW)).toBe(true);
    expect(result.summary.skipCount).toBe(2);
    expect(result.summary.createCount).toBe(0);
    expect(result.blocked).toBe(true);
  });

  it("skips existing records by default (CREATE_NEW_SKIP_EXISTING)", async () => {
    const { service, departments } = buildHarness();
    departments.set("dept-existing", { id: "dept-existing", tenantId: TENANT_1, code: "MAINT", name: "Maintenance", isActive: true });

    const file = csvFile("departments.csv", "Code,Name\nMAINT,Maintenance Updated\n");
    const result = await service.preview("department", actor, undefined, file);

    expect(result.rows[0].action).toBe(BulkImportRowAction.SKIP_EXISTING);
    expect(result.summary.skipCount).toBe(1);
    expect(result.blocked).toBe(true);
  });

  it("classifies a changed existing record as UPDATE in UPDATE_EXISTING mode and applies it on commit", async () => {
    const { service, departments } = buildHarness();
    departments.set("dept-existing", { id: "dept-existing", tenantId: TENANT_1, code: "MAINT", name: "Maintenance", isActive: true });

    const file = csvFile("departments.csv", "Code,Name\nMAINT,Maintenance Department\n");
    const preview = await service.preview("department", actor, BulkImportMode.UPDATE_EXISTING, file);
    expect(preview.rows[0].action).toBe(BulkImportRowAction.UPDATE);

    const commitResult = await service.commit("department", preview.run.id, actor, true);
    expect(commitResult.run.status).toBe(BulkImportRunStatus.COMPLETED);
    expect(departments.get("dept-existing").name).toBe("Maintenance Department");
  });

  it("never clears an existing value from a blank cell in UPDATE_EXISTING mode", async () => {
    const { service, departments } = buildHarness();
    departments.set("dept-existing", {
      id: "dept-existing",
      tenantId: TENANT_1,
      code: "MAINT",
      name: "Maintenance",
      description: "Original description",
      isActive: true
    });

    // Description left blank in the file — must not erase "Original description".
    const file = csvFile("departments.csv", "Code,Name,Description\nMAINT,Maintenance HQ,\n");
    const preview = await service.preview("department", actor, BulkImportMode.UPDATE_EXISTING, file);
    await service.commit("department", preview.run.id, actor, true);

    expect(departments.get("dept-existing").name).toBe("Maintenance HQ");
    expect(departments.get("dept-existing").description).toBe("Original description");
  });

  it("reports an invalid enum value as a row error", async () => {
    const { service } = buildHarness();
    const file = csvFile(
      "vehicles.csv",
      "Registration No,Make,Model,Year,Type,Fuel Type\nWP-CAB-1,Toyota,Hilux,2022,SPACESHIP,DIESEL\n"
    );
    const result = await service.preview("vehicle", actor, undefined, file);

    expect(result.rows[0].action).toBe(BulkImportRowAction.ERROR);
    expect((result.rows[0].errors as any[]).some((issue: any) => issue.field === "type")).toBe(true);
  });

  it("reports a missing required field as a row error", async () => {
    const { service } = buildHarness();
    const file = csvFile("departments.csv", "Code,Name\n,Maintenance\n");
    const result = await service.preview("department", actor, undefined, file);

    expect(result.rows[0].action).toBe(BulkImportRowAction.ERROR);
    expect((result.rows[0].errors as any[]).some((issue: any) => issue.field === "code")).toBe(true);
  });

  it("blocks a cross-tenant natural key conflict without leaking which tenant owns it", async () => {
    const { service, vehicles } = buildHarness();
    vehicles.set("veh-other-tenant", { id: "veh-other-tenant", tenantId: TENANT_2, registrationNo: "WP-CAB-9", make: "Toyota" });

    const file = csvFile(
      "vehicles.csv",
      "Registration No,Make,Model,Year,Type,Fuel Type\nWP-CAB-9,Nissan,Navara,2023,TRUCK,DIESEL\n"
    );
    const result = await service.preview("vehicle", actor, undefined, file);

    expect(result.rows[0].action).toBe(BulkImportRowAction.ERROR);
    const message = JSON.stringify(result.rows[0].errors);
    expect(message).toContain("NATURAL_KEY_CONFLICT");
    expect(message).not.toContain(TENANT_2);
  });

  it("is idempotent on double commit — no duplicate record is created", async () => {
    const { service, departments } = buildHarness();
    const file = csvFile("departments.csv", "Code,Name\nOPS,Operations\n");
    const preview = await service.preview("department", actor, undefined, file);

    const first = await service.commit("department", preview.run.id, actor, true);
    const second = await service.commit("department", preview.run.id, actor, true);

    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(departments.size).toBe(1);
  });

  it("re-checks authoritative DB state at commit time and never duplicates a concurrently-created record", async () => {
    const { service, departments } = buildHarness();
    const file = csvFile("departments.csv", "Code,Name\nOPS,Operations\n");
    const preview = await service.preview("department", actor, undefined, file);
    expect(preview.rows[0].action).toBe(BulkImportRowAction.CREATE);

    // Simulate another admin creating the same department between preview and commit.
    departments.set("dept-concurrent", { id: "dept-concurrent", tenantId: TENANT_1, code: "OPS", name: "Operations (created concurrently)" });

    const result = await service.commit("department", preview.run.id, actor, true);
    expect(result.run.status).toBe(BulkImportRunStatus.COMPLETED);
    expect(departments.size).toBe(1);
  });

  it("throws NotFoundException for a foreign/unknown importId", async () => {
    const { service } = buildHarness();
    await expect(service.getRun("department", "does-not-exist", actor)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.commit("department", "does-not-exist", actor, true)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("requires explicit confirmation before committing", async () => {
    const { service } = buildHarness();
    const file = csvFile("departments.csv", "Code,Name\nOPS,Operations\n");
    const preview = await service.preview("department", actor, undefined, file);
    await expect(service.commit("department", preview.run.id, actor, false)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("expires a stale preview session and refuses to commit it", async () => {
    const { service, runs } = buildHarness();
    const file = csvFile("departments.csv", "Code,Name\nOPS,Operations\n");
    const preview = await service.preview("department", actor, undefined, file);

    runs.set(preview.run.id, { ...runs.get(preview.run.id), expiresAt: new Date(Date.now() - 1_000) });

    await expect(service.commit("department", preview.run.id, actor, true)).rejects.toBeInstanceOf(BadRequestException);
    expect(runs.get(preview.run.id).status).toBe(BulkImportRunStatus.EXPIRED);
  });

  it("rejects a commit already in progress instead of racing a second write", async () => {
    const { service, runs } = buildHarness();
    const file = csvFile("departments.csv", "Code,Name\nOPS,Operations\n");
    const preview = await service.preview("department", actor, undefined, file);

    runs.set(preview.run.id, { ...runs.get(preview.run.id), status: BulkImportRunStatus.COMMITTING });

    await expect(service.commit("department", preview.run.id, actor, true)).rejects.toBeInstanceOf(ConflictException);
  });

  it("enforces tenant isolation — another tenant cannot see or commit this import", async () => {
    const { service } = buildHarness();
    const file = csvFile("departments.csv", "Code,Name\nOPS,Operations\n");
    const preview = await service.preview("department", actor, undefined, file);

    const otherTenantActor = { ...actor, tenantId: TENANT_2 };
    await expect(service.getRun("department", preview.run.id, otherTenantActor)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.commit("department", preview.run.id, otherTenantActor, true)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("produces a flat, field-level error report with no stack traces or internal details", async () => {
    const { service } = buildHarness();
    const file = csvFile("departments.csv", "Code,Name\n,Maintenance\n");
    const preview = await service.preview("department", actor, undefined, file);

    const report = await service.getErrorReportRows("department", preview.run.id, actor);
    expect(report).toEqual([
      expect.objectContaining({ rowNumber: 2, field: "code", errorCode: "REQUIRED" })
    ]);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toMatch(/at\s+\w+\s+\(/); // no stack-trace-looking content
  });

  it("returns 404 for an entity slug that has no adapter wired up", async () => {
    const { service } = buildHarness();
    await expect(service.getTemplate("warehouse", "csv")).rejects.toBeInstanceOf(NotFoundException);
  });
});
