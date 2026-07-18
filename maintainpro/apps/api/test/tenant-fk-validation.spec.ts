import { ForbiddenException, NotFoundException } from "@nestjs/common";

import { requestContext } from "../src/common/context/request-context";
import {
  assertTenantEntitiesExist,
  assertTenantEntityExists,
  findTenantEntityOrThrow,
  requireTenantId,
  tenantWhere
} from "../src/common/utils/tenant-scope.util";

const ctx = (tenantId: string | null) => ({
  actorId: "user-1",
  actorEmail: "a@example.com",
  actorRole: "ADMIN",
  tenantId,
  module: null,
  ipAddress: null,
  userAgent: null,
  requestPath: null
});

const run = <T>(tenantId: string | null, fn: () => Promise<T> | T) =>
  requestContext.run(ctx(tenantId), fn);

describe("tenant-scope fail-closed helpers", () => {
  it("requireTenantId throws when no tenant context", () => {
    expect(() => requireTenantId()).toThrow(ForbiddenException);
  });

  it("requireTenantId returns explicit tenant id", () => {
    expect(requireTenantId("tenant-a")).toBe("tenant-a");
  });

  it("requireTenantId reads active request context", async () => {
    await run("tenant-a", () => {
      expect(requireTenantId()).toBe("tenant-a");
    });
  });

  it("tenantWhere builds a fail-closed filter", async () => {
    await run("tenant-a", () => {
      expect(tenantWhere()).toEqual({ tenantId: "tenant-a" });
    });
    expect(() => tenantWhere()).toThrow(ForbiddenException);
  });
});

describe("cross-tenant FK validation", () => {
  const makeDelegate = (rows: Array<{ id: string; tenantId: string }>) => ({
    findFirst: jest.fn(async ({ where }: { where: any }) => {
      const match = rows.find((r) => r.id === where.id && r.tenantId === where.tenantId);
      return match ? { id: match.id } : null;
    }),
    findMany: jest.fn(async ({ where }: { where: any }) => {
      const ids: string[] = where.id.in;
      return rows.filter((r) => ids.includes(r.id) && r.tenantId === where.tenantId).map((r) => ({ id: r.id }));
    })
  });

  it("assertTenantEntityExists passes for same-tenant id", async () => {
    const delegate = makeDelegate([{ id: "x1", tenantId: "tenant-a" }]);
    await expect(run("tenant-a", () => assertTenantEntityExists(delegate, "x1"))).resolves.toBeUndefined();
  });

  it("assertTenantEntityExists throws NotFound for other-tenant id (non-enumerating)", async () => {
    const delegate = makeDelegate([{ id: "x1", tenantId: "tenant-b" }]);
    await expect(run("tenant-a", () => assertTenantEntityExists(delegate, "x1"))).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("assertTenantEntityExists throws Forbidden without tenant context", async () => {
    const delegate = makeDelegate([{ id: "x1", tenantId: "tenant-a" }]);
    await expect(assertTenantEntityExists(delegate, "x1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("findTenantEntityOrThrow returns the record for same tenant", async () => {
    const delegate = makeDelegate([{ id: "x1", tenantId: "tenant-a" }]);
    const found = await run("tenant-a", () => findTenantEntityOrThrow(delegate, "x1"));
    expect(found).toEqual({ id: "x1" });
  });

  it("assertTenantEntitiesExist passes only when all ids belong to tenant", async () => {
    const delegate = makeDelegate([
      { id: "x1", tenantId: "tenant-a" },
      { id: "x2", tenantId: "tenant-a" }
    ]);
    await expect(run("tenant-a", () => assertTenantEntitiesExist(delegate, ["x1", "x2"]))).resolves.toBeUndefined();
  });

  it("assertTenantEntitiesExist throws when any id belongs to another tenant", async () => {
    const delegate = makeDelegate([
      { id: "x1", tenantId: "tenant-a" },
      { id: "x2", tenantId: "tenant-b" }
    ]);
    await expect(run("tenant-a", () => assertTenantEntitiesExist(delegate, ["x1", "x2"]))).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("assertTenantEntitiesExist no-ops on empty id list", async () => {
    const delegate = makeDelegate([]);
    await expect(run("tenant-a", () => assertTenantEntitiesExist(delegate, [null, undefined]))).resolves.toBeUndefined();
    expect(delegate.findMany).not.toHaveBeenCalled();
  });
});