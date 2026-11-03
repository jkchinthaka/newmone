import { hasCompatiblePermission as apiAllows } from "../src/common/guards/permissions.guard";
import { PERMISSION_CATALOG } from "../src/database/permission-catalog";
import path from "node:path";

// Loaded at runtime (ts-jest transforms it) so the API tsc rootDir stays apps/api.
type WebAliases = {
  COMPATIBLE_PERMISSION_ALIASES: Readonly<Record<string, readonly string[]>>;
  hasCompatiblePermission: (granted: ReadonlySet<string>, required: string, role?: string | null) => boolean;
};
const webModulePath = path.resolve(__dirname, "../../web/lib/permission-aliases.ts");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { COMPATIBLE_PERMISSION_ALIASES, hasCompatiblePermission: webAllows } = require(webModulePath) as WebAliases;

describe("web permission aliases match the API guard", () => {
  it("gives the same answer for every required key, single granted key and role variant", () => {
    const keys = [...new Set([...PERMISSION_CATALOG, ...Object.keys(COMPATIBLE_PERMISSION_ALIASES)])];
    const mismatches: string[] = [];
    for (const required of keys) {
      for (const granted of keys) {
        for (const role of ["MANAGER", "SUPERVISOR", null]) {
          const set = new Set([granted]);
          if (apiAllows(set, required, role) !== webAllows(set, required, role)) {
            mismatches.push(`${role ?? "-"} ${granted} -> ${required}`);
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});
