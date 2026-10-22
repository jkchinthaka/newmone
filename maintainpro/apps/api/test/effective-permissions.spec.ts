import { requestContext } from "../src/common/context/request-context";
import {
  accessStudioEnabled,
  loadEffectivePermissionKeys,
  resolveEffectivePermissions
} from "../src/common/auth/effective-permissions";

describe("effective permissions", () => {
  const previous = process.env.ACCESS_STUDIO_ENABLED;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.ACCESS_STUDIO_ENABLED;
    } else {
      process.env.ACCESS_STUDIO_ENABLED = previous;
    }
  });

  it("adds grants and lets deny win", () => {
    expect(
      resolveEffectivePermissions(
        ["assets.view", "workorders.view"],
        [
          { permissionKey: "audit.view", effect: "GRANT" },
          { permissionKey: "assets.view", effect: "DENY" },
          { permissionKey: "audit.view", effect: "DENY" },
          { permissionKey: "audit.view", effect: "GRANT" }
        ]
      ).sort()
    ).toEqual(["workorders.view"]);
  });

  it("does not read overrides when the flag is off", async () => {
    delete process.env.ACCESS_STUDIO_ENABLED;
    expect(accessStudioEnabled()).toBe(false);
    const findMany = jest.fn();

    await expect(
      loadEffectivePermissionKeys(
        { userPermissionOverride: { findMany } },
        { id: "user-1", tenantId: "tenant-a" },
        ["assets.view"]
      )
    ).resolves.toEqual(["assets.view"]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("reads only the caller's tenant overrides when the flag is on", async () => {
    process.env.ACCESS_STUDIO_ENABLED = "true";
    const findMany = jest.fn().mockResolvedValue([{ permissionKey: "audit.view", effect: "GRANT" }]);

    await expect(
      loadEffectivePermissionKeys(
        { userPermissionOverride: { findMany } },
        { id: "user-1", tenantId: "tenant-a" },
        ["assets.view"]
      )
    ).resolves.toEqual(["assets.view", "audit.view"]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-a", userId: "user-1" }),
        select: { permissionKey: true, effect: true, expiresAt: true }
      })
    );
  });

  it("ignores an expired deny and caches the request", async () => {
    process.env.ACCESS_STUDIO_ENABLED = "true";
    const findMany = jest.fn().mockResolvedValue([
      { permissionKey: "assets.view", effect: "DENY", expiresAt: new Date("2000-01-01T00:00:00.000Z") }
    ]);
    const findUnique = jest.fn().mockResolvedValue({ accessConfigVersion: 4 });
    const prisma = { userPermissionOverride: { findMany }, tenant: { findUnique } };

    const keys = await requestContext.run(
      {
        actorId: null,
        actorEmail: null,
        actorRole: null,
        tenantId: "tenant-a",
        module: null,
        ipAddress: null,
        userAgent: null,
        requestPath: null
      },
      async () => {
        const first = await loadEffectivePermissionKeys(prisma, { id: "user-1", tenantId: "tenant-a" }, ["assets.view"]);
        const second = await loadEffectivePermissionKeys(prisma, { id: "user-1", tenantId: "tenant-a" }, ["assets.view"]);
        return [first, second];
      }
    );

    expect(keys[0]).toEqual(["assets.view"]);
    expect(keys[1]).toEqual(["assets.view"]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("does not read the tenant version when the flag is off", async () => {
    delete process.env.ACCESS_STUDIO_ENABLED;
    const findUnique = jest.fn();
    await loadEffectivePermissionKeys(
      { tenant: { findUnique }, userPermissionOverride: { findMany: jest.fn() } },
      { id: "user-1", tenantId: "tenant-a" },
      ["assets.view"]
    );
    expect(findUnique).not.toHaveBeenCalled();
  });
});
