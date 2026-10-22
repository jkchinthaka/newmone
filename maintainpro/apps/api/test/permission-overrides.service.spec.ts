import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PermissionOverridesController } from "../src/modules/admin/permission-overrides.controller";
import { PermissionOverridesService } from "../src/modules/admin/permission-overrides.service";

function uniqueError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test"
  });
}

describe("PermissionOverridesService", () => {
  const actor = {
    sub: "admin-1",
    email: "super@maintainpro.local",
    role: "SUPER_ADMIN",
    tenantId: "tenant-a"
  };
  const previous = process.env.ACCESS_STUDIO_ENABLED;

  beforeEach(() => {
    process.env.ACCESS_STUDIO_ENABLED = "true";
  });

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.ACCESS_STUDIO_ENABLED;
    } else {
      process.env.ACCESS_STUDIO_ENABLED = previous;
    }
  });

  const database = () => {
    const prisma = {
      user: { findFirst: jest.fn() },
      permission: { findUnique: jest.fn() },
      userPermissionOverride: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn()
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) },
      $transaction: jest.fn()
    };
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback(prisma)
    );
    return prisma;
  };

  it("does not read overrides for a user outside the actor tenant", async () => {
    const prisma = database();
    prisma.user.findFirst.mockResolvedValue(null);
    const service = new PermissionOverridesService(prisma as never);

    await expect(service.list(actor, "user-b")).rejects.toThrow("User not found");
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-b", tenantId: "tenant-a" } })
    );
    expect(prisma.userPermissionOverride.findMany).not.toHaveBeenCalled();
  });

  it("blocks a user from editing their own overrides", async () => {
    const prisma = database();
    const service = new PermissionOverridesService(prisma as never);

    await expect(
      service.create(
        { ...actor, sub: "user-1" },
        "user-1",
        { permissionKey: "assets.view", effect: "GRANT", reason: "cover shift" }
      )
    ).rejects.toThrow("own permission overrides");
    expect(prisma.permission.findUnique).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects a missing reason and an unknown permission", async () => {
    const prisma = database();
    const service = new PermissionOverridesService(prisma as never);

    await expect(
      service.create(actor, "user-2", { permissionKey: "assets.view", effect: "GRANT", reason: " " })
    ).rejects.toThrow("reason is required");

    prisma.permission.findUnique.mockResolvedValue(null);
    await expect(
      service.create(actor, "user-2", { permissionKey: "not.real", effect: "DENY", reason: "trial" })
    ).rejects.toThrow("Unknown permission");
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it("writes an audit row when an override is created and when it is removed", async () => {
    const prisma = database();
    prisma.permission.findUnique.mockResolvedValue({ key: "assets.view" });
    prisma.user.findFirst.mockResolvedValue({ id: "user-2", tenantId: "tenant-a" });
    prisma.userPermissionOverride.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "override-1",
      permissionKey: "assets.view",
      effect: "GRANT"
    });
    prisma.userPermissionOverride.create.mockResolvedValue({
      id: "override-1",
      permissionKey: "assets.view",
      effect: "GRANT"
    });
    prisma.userPermissionOverride.delete.mockResolvedValue({ id: "override-1" });
    const service = new PermissionOverridesService(prisma as never);

    await service.create(actor, "user-2", {
      permissionKey: "assets.view",
      effect: "GRANT",
      reason: "cover the night shift"
    });
    await service.remove(actor, "user-2", "assets.view", "shift ended");

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          entity: "UserPermissionOverride",
          action: "CREATE",
          tenantId: "tenant-a",
          reason: "cover the night shift"
        })
      })
    );
    expect(prisma.auditLog.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          action: "DELETE",
          reason: "shift ended"
        })
      })
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("returns a conflict when create hits a unique constraint", async () => {
    const prisma = database();
    prisma.permission.findUnique.mockResolvedValue({ key: "assets.view" });
    prisma.user.findFirst.mockResolvedValue({ id: "user-2", tenantId: "tenant-a" });
    prisma.userPermissionOverride.findUnique.mockResolvedValue(null);
    prisma.userPermissionOverride.create.mockRejectedValue(uniqueError());
    const service = new PermissionOverridesService(prisma as never);

    const error = await service
      .create(actor, "user-2", {
        permissionKey: "assets.view",
        effect: "GRANT",
        reason: "cover the night shift"
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getStatus()).toBe(409);
    expect((error as ConflictException).message).toBe("An override already exists for this permission");
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("does not read the override table when the flag is off", async () => {
    process.env.ACCESS_STUDIO_ENABLED = "false";
    const prisma = database();
    const service = new PermissionOverridesService(prisma as never);

    await expect(service.list(actor, "user-2")).rejects.toThrow();
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.userPermissionOverride.findMany).not.toHaveBeenCalled();
  });

  it("rejects an override for a super admin", async () => {
    const prisma = database();
    prisma.permission.findUnique.mockResolvedValue({ key: "assets.view" });
    prisma.user.findFirst.mockResolvedValue({ id: "user-2", tenantId: "tenant-a", role: { name: "SUPER_ADMIN" } });
    const service = new PermissionOverridesService(prisma as never);

    await expect(
      service.create(actor, "user-2", { permissionKey: "assets.view", effect: "DENY", reason: "limit access" })
    ).rejects.toThrow("Change the role instead");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a removal reason that repeats the create reason", async () => {
    const prisma = database();
    prisma.user.findFirst.mockResolvedValue({ id: "user-2", tenantId: "tenant-a", role: { name: "MANAGER" } });
    prisma.userPermissionOverride.findUnique.mockResolvedValue({
      id: "override-1",
      permissionKey: "assets.view",
      effect: "GRANT",
      reason: "cover the night shift"
    });
    const service = new PermissionOverridesService(prisma as never);

    await expect(service.remove(actor, "user-2", "assets.view", "cover the night shift")).rejects.toThrow(
      "Enter a new removal reason"
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("PermissionOverridesController", () => {
  it("reads permissionKey and reason from the JSON body on delete", async () => {
    const service = {
      remove: jest.fn().mockResolvedValue({ data: { id: "override-1" }, message: "Permission override removed" })
    };
    const controller = new PermissionOverridesController(service as never);
    const actor = { sub: "admin-1", email: "super@maintainpro.local", role: "SUPER_ADMIN", tenantId: "tenant-a" };

    await controller.remove({ user: actor }, "user-2", {
      permissionKey: "assets.view",
      reason: "shift ended"
    });

    expect(service.remove).toHaveBeenCalledWith(actor, "user-2", "assets.view", "shift ended");
  });
});
