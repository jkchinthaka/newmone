import { assertGrantDatabase } from "../src/database/grant-access-studio-keys";
import { applyAccessStudioStartup } from "../src/bootstrap/access-studio-startup";
import { isAccessStudioKey } from "../src/common/auth/access-route-keys";
import { accessStudioEnabled, setAccessStudioRuntimeAllowed } from "../src/common/auth/effective-permissions";
import { RoleName } from "../src/database/prisma-enums";
import { rolePermissions } from "../src/database/seed";

describe("access studio grant guard", () => {
  it("refuses nelna and writes to MaintainProDev", () => {
    expect(() => assertGrantDatabase("sqlserver://localhost;database=nelna;integratedSecurity=true", false)).toThrow(/nelna/);
    expect(() => assertGrantDatabase("sqlserver://localhost;database=MaintainProDev;integratedSecurity=true", true)).toThrow(/read only/);
    expect(assertGrantDatabase("sqlserver://localhost;database=maintainpro_e2e_wo_verify;integratedSecurity=true", true)).toBe(
      "maintainpro_e2e_wo_verify"
    );
  });

  it("keeps the studio off when the seed version is missing", async () => {
    const previous = process.env.ACCESS_STUDIO_ENABLED;
    process.env.ACCESS_STUDIO_ENABLED = "true";
    setAccessStudioRuntimeAllowed(true);
    await applyAccessStudioStartup({ appSetting: { findUnique: async () => null }, role: { findMany: async () => [] } });
    expect(accessStudioEnabled()).toBe(false);
    setAccessStudioRuntimeAllowed(true);
    if (previous === undefined) delete process.env.ACCESS_STUDIO_ENABLED;
    else process.env.ACCESS_STUDIO_ENABLED = previous;
  });

  it("refuses the flag when the seed version is current but the access grants are missing", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const previous = process.env.ACCESS_STUDIO_ENABLED;
    process.env.ACCESS_STUDIO_ENABLED = "true";
    setAccessStudioRuntimeAllowed(true);
    const roles = Object.values(RoleName).map((name) => ({
      name,
      tenantId: "tenant-1",
      permissionLinks: (rolePermissions[name] ?? [])
        .filter((key) => !isAccessStudioKey(key))
        .map((key) => ({ permission: { key } }))
    }));
    await applyAccessStudioStartup({
      appSetting: { findUnique: async () => ({ value: "2" }) },
      role: { findMany: async () => roles }
    });
    expect(accessStudioEnabled()).toBe(false);
    expect(String(error.mock.calls[0]?.[0] ?? "")).toMatch(/stayed off/);
    error.mockRestore();
    setAccessStudioRuntimeAllowed(true);
    if (previous === undefined) delete process.env.ACCESS_STUDIO_ENABLED;
    else process.env.ACCESS_STUDIO_ENABLED = previous;
  });
});
