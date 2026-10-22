import { PermissionOverridesService } from "../src/modules/admin/permission-overrides.service";
import { setAccessStudioRuntimeAllowed } from "../src/common/auth/effective-permissions";

describe("bulk access saves", () => {
  const previous = process.env.ACCESS_STUDIO_ENABLED;
  const actor = { sub: "admin", email: "admin@example.invalid", role: "SUPER_ADMIN", tenantId: "tenant-a" };
  const input = { userIds: ["u1", "u2"], permissionKey: "assets.view", effect: "DENY", reason: "temporary coverage", expiresAt: "2099-01-01" };
  beforeEach(() => { process.env.ACCESS_STUDIO_ENABLED = "true"; setAccessStudioRuntimeAllowed(true); });
  afterAll(() => { if (previous === undefined) delete process.env.ACCESS_STUDIO_ENABLED; else process.env.ACCESS_STUDIO_ENABLED = previous; });
  function fixture() {
    const prisma: any = {
      user: { findFirst: jest.fn(async ({ where }) => ({ id: where.id, tenantId: where.tenantId, role: { name: "TECHNICIAN" } })) },
      permission: { findUnique: jest.fn(async () => ({ key: "assets.view" })) },
      userPermissionOverride: { findUnique: jest.fn(async () => null), create: jest.fn(async ({ data }) => ({ id: `override-${data.userId}`, ...data })) },
      auditLog: { create: jest.fn(async () => ({})) },
      tenant: { update: jest.fn(async () => ({})) }
    };
    prisma.$transaction = async (fn: any) => fn(prisma);
    return { prisma, service: new PermissionOverridesService(prisma) };
  }
  it("applies effect, expiry and reason to several users with audits and version bumps", async () => {
    const { prisma, service } = fixture();
    const result = await service.bulk(actor, input);
    expect(result.data.every((r) => r.saved)).toBe(true);
    expect(prisma.userPermissionOverride.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    expect(prisma.tenant.update).toHaveBeenCalledTimes(2);
    expect(prisma.userPermissionOverride.create).toHaveBeenCalledWith({ data: expect.objectContaining({ effect: "DENY", reason: input.reason, expiresAt: new Date("2099-01-01T23:59:59.999Z"), tenantId: "tenant-a" }) });
  });
  it("rejects cross-tenant, self and SUPER_ADMIN targets before writing any user", async () => {
    for (const invalid of ["cross", "admin", "super"]) {
      const { prisma, service } = fixture();
      prisma.user.findFirst.mockImplementation(async ({ where }: any) => where.id === "cross" ? null : ({ id: where.id, tenantId: "tenant-a", role: { name: where.id === "super" ? "SUPER_ADMIN" : "TECHNICIAN" } }));
      await expect(service.bulk(actor, { ...input, userIds: ["u1", invalid] })).rejects.toThrow();
      expect(prisma.userPermissionOverride.create).not.toHaveBeenCalled();
    }
  });
  it("reports existing overrides per user instead of replacing them", async () => {
    const { prisma, service } = fixture();
    prisma.userPermissionOverride.findUnique.mockImplementation(async ({ where }: any) => where.tenantId_userId_permissionKey.userId === "u1" ? { id: "existing" } : null);
    const result = await service.bulk(actor, input);
    expect(result.data.map((r) => r.saved)).toEqual([false, true]);
    expect(prisma.userPermissionOverride.create).toHaveBeenCalledTimes(1);
  });
  it("rejects disabled flag, non-super-admin, oversized lists and invalid reason", async () => {
    const { prisma, service } = fixture();
    await expect(service.bulk({ ...actor, role: "ADMIN" }, input)).rejects.toThrow();
    await expect(service.bulk(actor, { ...input, userIds: Array(51).fill("u1") })).rejects.toThrow();
    expect((await service.bulk(actor, { ...input, reason: "" })).data.every((r) => !r.saved)).toBe(true);
    process.env.ACCESS_STUDIO_ENABLED = "false";
    await expect(service.bulk(actor, input)).rejects.toThrow();
    expect(prisma.userPermissionOverride.create).not.toHaveBeenCalled();
  });
});
