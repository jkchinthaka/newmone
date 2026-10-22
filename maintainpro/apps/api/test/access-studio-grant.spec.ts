import { assertGrantDatabase } from "../src/database/grant-access-studio-keys";
import { applyAccessStudioStartup } from "../src/bootstrap/access-studio-startup";
import { accessStudioEnabled, setAccessStudioRuntimeAllowed } from "../src/common/auth/effective-permissions";

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
});
