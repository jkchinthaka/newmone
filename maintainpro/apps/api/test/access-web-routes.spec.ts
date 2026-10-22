import { AuthService } from "../src/modules/auth/auth.service";
import { effectiveWebRoutes } from "../src/common/auth/access-web-routes";
import { accessKeyForMethodPath } from "../src/common/auth/access-route-keys";
import { setAccessStudioRuntimeAllowed } from "../src/common/auth/effective-permissions";

describe("effective web routes from /auth/me", () => {
  const previous = process.env.ACCESS_STUDIO_ENABLED;
  afterEach(() => { if (previous === undefined) delete process.env.ACCESS_STUDIO_ENABLED; else process.env.ACCESS_STUDIO_ENABLED = previous; setAccessStudioRuntimeAllowed(true); });
  it("derives page access from effective route keys and DENYs rather than department role", () => {
    const key = accessKeyForMethodPath("GET", "/assets")!;
    expect(effectiveWebRoutes("CLEANER", [key], new Set())).toContain("GET /assets");
    expect(effectiveWebRoutes("ADMIN", [key], new Set([key]))).not.toContain("GET /assets");
    expect(effectiveWebRoutes("ADMIN", [], new Set())).not.toContain("GET /assets");
  });
  it("requires declared permissions as well as the route key", () => {
    const key = accessKeyForMethodPath("GET", "/ai/field-insights")!;
    expect(effectiveWebRoutes("CLEANER", [key], new Set())).not.toContain("GET /ai/field-insights");
    expect(effectiveWebRoutes("CLEANER", [key, "predictive_insights.view"], new Set())).toContain("GET /ai/field-insights");
  });
  function fixture() {
    const key = accessKeyForMethodPath("GET", "/assets")!;
    const prisma = {
      user: { findUnique: jest.fn(async () => ({ id: "user", email: "user@example.invalid", passwordHash: "fixture", tenantId: "tenant-a", role: { name: "CLEANER", permissionLinks: [] } })) },
      userPermissionOverride: { findMany: jest.fn(async () => [{ permissionKey: key, effect: "GRANT" }]) },
      tenant: { findUnique: jest.fn(async () => ({ accessConfigVersion: 7 })) }
    };
    const service = new AuthService(prisma as any, {} as any, {} as any, {} as any);
    return { prisma, service };
  }
  it("exposes effective routes and version while ON without minting auth tokens", async () => {
    process.env.ACCESS_STUDIO_ENABLED = "true"; setAccessStudioRuntimeAllowed(true);
    const { service } = fixture();
    const result = await service.me("user", "tenant-a");
    expect(result.data.accessRoutes).toContain("GET /assets");
    expect(result.data.accessConfigVersion).toBe(7);
    expect(result.data).not.toHaveProperty("passwordHash");
    expect(result.data).not.toHaveProperty("accessToken");
  });
  it("OFF omits the route list and reads neither overrides nor tenant version", async () => {
    process.env.ACCESS_STUDIO_ENABLED = "false";
    const { prisma, service } = fixture();
    const result = await service.me("user", "tenant-a");
    expect(result.data).not.toHaveProperty("accessRoutes");
    expect(result.data.permissions).toEqual([]);
    expect(prisma.userPermissionOverride.findMany).not.toHaveBeenCalled();
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });
});
