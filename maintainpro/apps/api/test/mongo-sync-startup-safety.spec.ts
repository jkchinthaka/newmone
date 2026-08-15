import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

describe("MP-001: MongoSyncService must not run on normal API startup", () => {
  const apiSrcRoot = join(__dirname, "../src");
  const appModulePath = join(apiSrcRoot, "app.module.ts");
  const mainPath = join(apiSrcRoot, "main.ts");
  const mongoSyncPath = join(apiSrcRoot, "database/mongo-sync.service.ts");

  const originalEnv = {
    MONGO_SYNC_ON_STARTUP: process.env.MONGO_SYNC_ON_STARTUP,
    MONGODB_URI: process.env.MONGODB_URI
  };

  afterEach(() => {
    if (originalEnv.MONGO_SYNC_ON_STARTUP === undefined) {
      delete process.env.MONGO_SYNC_ON_STARTUP;
    } else {
      process.env.MONGO_SYNC_ON_STARTUP = originalEnv.MONGO_SYNC_ON_STARTUP;
    }
    if (originalEnv.MONGODB_URI === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalEnv.MONGODB_URI;
    }
    jest.restoreAllMocks();
  });

  function collectTsFiles(dir: string): string[] {
    const entries = readdirSync(dir);
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        files.push(...collectTsFiles(fullPath));
      } else if (entry.endsWith(".ts")) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it("does not import or register MongoSyncService in AppModule", () => {
    const appModuleSource = readFileSync(appModulePath, "utf8");
    expect(appModuleSource).not.toMatch(/MongoSyncService/);
    expect(appModuleSource).not.toMatch(/mongo-sync\.service/);
    expect(appModuleSource).not.toMatch(/runExplicitSync/);
  });

  it("removes the destructive Mongo sync service from the API codebase", () => {
    expect(existsSync(mongoSyncPath)).toBe(false);

    const startupSources = [appModulePath, mainPath].map((path) =>
      readFileSync(path, "utf8")
    );
    for (const source of startupSources) {
      expect(source).not.toMatch(/MongoSyncService/);
      expect(source).not.toMatch(/mongo-sync\.service/);
      expect(source).not.toMatch(/runExplicitSync/);
    }
  });

  it("no normal API startup path contains this destructive sync service", () => {
    const startupRelevantFiles = collectTsFiles(apiSrcRoot).filter((path) => {
      const relative = path.slice(apiSrcRoot.length).replace(/\\/g, "/");
      return (
        relative === "/app.module.ts" ||
        relative === "/main.ts" ||
        relative.startsWith("/database/") ||
        relative.startsWith("/bootstrap/") ||
        relative.startsWith("/config/")
      );
    });

    for (const filePath of startupRelevantFiles) {
      const source = readFileSync(filePath, "utf8");
      expect(source).not.toMatch(/MongoSyncService/);
      expect(source).not.toMatch(/mongo-sync\.service/);
      expect(source).not.toMatch(/runExplicitSync/);
      // Startup code must not couple the inert env flag to destructive sync.
      if (
        filePath.endsWith("app.module.ts") ||
        filePath.endsWith("main.ts") ||
        filePath.includes(`${join("database")}`)
      ) {
        expect(source).not.toMatch(/MONGO_SYNC_ON_STARTUP/);
      }
    }
  });

  it("MONGO_SYNC_ON_STARTUP=true cannot activate destructive Mongo sync through API startup", () => {
    process.env.MONGO_SYNC_ON_STARTUP = "true";

    // Deleted service must remain unresolvable regardless of the legacy flag.
    expect(existsSync(mongoSyncPath)).toBe(false);
    expect(() => require("../src/database/mongo-sync.service")).toThrow();

    const forbiddenSyncMarkers = [
      /MongoSyncService/,
      /mongo-sync\.service/,
      /runExplicitSync/
    ];

    const executableStartupFiles = collectTsFiles(apiSrcRoot).filter((path) => {
      const relative = path.slice(apiSrcRoot.length).replace(/\\/g, "/");
      return (
        relative === "/app.module.ts" ||
        relative === "/main.ts" ||
        relative.startsWith("/database/") ||
        relative.startsWith("/bootstrap/")
      );
    });

    for (const filePath of executableStartupFiles) {
      const source = readFileSync(filePath, "utf8");
      for (const marker of forbiddenSyncMarkers) {
        expect(source).not.toMatch(marker);
      }
      // Legacy flag must not be read by executable startup/database code.
      // (Inert Joi declaration in env.validation.ts is out of this scope.)
      expect(source).not.toMatch(/MONGO_SYNC_ON_STARTUP/);
      expect(source).not.toMatch(/process\.env\.MONGO_SYNC_ON_STARTUP/);
    }
  });
});
