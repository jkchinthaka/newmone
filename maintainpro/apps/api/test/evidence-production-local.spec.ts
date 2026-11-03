import fileSystem from "node:fs";
import { isPrivateAbsoluteStorageRoot } from "../src/config/local-storage-root";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { envValidationSchema } from "../src/config/env.validation";
import { EvidenceStorageProviderService } from "../src/modules/evidence/evidence-storage-provider.service";
import { publicEvidenceReadinessHasSensitiveFields } from "../src/modules/evidence/evidence-storage.mapper";

const root = mkdtempSync(path.join(tmpdir(), "mp-prod-storage-"));
const base = { NODE_ENV: "production", DATABASE_URL: "sqlserver://localhost:1433;database=maintainpro_e2e_cursor",
  JWT_SECRET: "test-only-secret", ERP_MODE: "disabled", BILLING_MODE: "disabled", REDIS_REQUIRED_IN_PRODUCTION: false, STORAGE_MODE: "local",
  STORAGE_UPLOADS_ENABLED: true, STORAGE_LOCAL_PRODUCTION: true, STORAGE_LOCAL_ROOT: root };
const provider = (values: Record<string, unknown>) => new EvidenceStorageProviderService({
  get: (key: string, fallback: unknown) => key in values ? values[key] : fallback
} as never);
afterAll(() => rmSync(root, { recursive: true, force: true }));
describe("production local evidence storage", () => {
  it.each([
    { STORAGE_LOCAL_PRODUCTION: false },
    { STORAGE_LOCAL_PRODUCTION: undefined },
    { STORAGE_LOCAL_ROOT: "relative/evidence" },
    { STORAGE_LOCAL_ROOT: process.cwd() },
    { STORAGE_LOCAL_ROOT: path.join(process.cwd(), "private") },
    { STORAGE_LOCAL_ROOT: path.resolve(__dirname, "../../../..", "private") }
  ])("rejects unsafe production settings %j", override => {
    const { error } = envValidationSchema.validate({ ...base, ...override });
    expect(error?.message).toContain("STORAGE_MODE=local");
  });
  it("protects installed app files without .git when NSSM launches elsewhere", () => {
    const exists = jest.spyOn(fileSystem, "existsSync").mockReturnValue(false);
    const cwd = jest.spyOn(process, "cwd").mockReturnValue(root);
    try {
      expect(isPrivateAbsoluteStorageRoot(path.resolve(__dirname, "../../../", "evidence"))).toBe(false);
    } finally { exists.mockRestore(); cwd.mockRestore(); }
  });
  it("accepts explicit production opt-in with an external absolute root", () => {
    expect(envValidationSchema.validate(base).error).toBeUndefined();
  });
  it("reports writable capacity without disclosing the root", () => {
    const result = provider(base).checkReadiness();
    expect(result).toMatchObject({ mode: "local", state: "configured", rootSet: true, writable: true });
    expect(result.freeSpaceBytes).toBeGreaterThanOrEqual(0);
    expect(typeof result.lowDiskSpace).toBe("boolean");
    expect(JSON.stringify(result)).not.toContain(root);
    expect(publicEvidenceReadinessHasSensitiveFields(result)).toBe(false);
  });
  it("warns when available disk space is below five GiB", () => {
    const capacity = jest.spyOn(fileSystem, "statfsSync").mockReturnValue({ bavail: 1024, bsize: 4096 } as never);
    try {
      expect(provider(base).checkReadiness()).toMatchObject({ state: "configured", writable: true, lowDiskSpace: true, freeSpaceBytes: 4194304 });
      expect(provider(base).checkReadiness().message).toContain("less than 5 GB");
    } finally { capacity.mockRestore(); }
  });
  it("fails readiness when write or delete is denied without leaking filesystem errors", () => {
    const write = jest.spyOn(fileSystem, "writeFileSync").mockImplementation(() => { throw new Error("secret-path"); });
    try {
      const result = provider(base).checkReadiness();
      expect(result).toMatchObject({ state: "misconfigured", writable: false });
      expect(JSON.stringify(result)).not.toContain("secret-path");
    } finally { write.mockRestore(); }
  });
  it("fails readiness for a missing directory", () => {
    expect(provider({ ...base, STORAGE_LOCAL_ROOT: path.join(root, "absent") }).checkReadiness())
      .toMatchObject({ state: "misconfigured", writable: false, rootSet: true });
  });
  it.each(["../escape.pdf", "tenant/../../escape.pdf", "tenant\\..\\..\\escape.pdf", "C:\\escape.pdf", "\\\\server\\share\\escape.pdf", "/escape.pdf", "tenant/file:stream", "tenant/.. /escape.pdf", "tenant/NUL.pdf"])("rejects traversal %s", async key => {
    await expect(provider(base).putObject(key, Buffer.from("test"))).rejects.toThrow(/path/);
  });
});
