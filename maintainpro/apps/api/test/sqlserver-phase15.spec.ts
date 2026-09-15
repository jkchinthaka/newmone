/**
 * Phase 15 — SQL Server migration engineering invariants (no live DB required).
 */
import * as fs from "fs";
import * as path from "path";

import { parseJsonText, stringArrayToText, toJsonText, toStringArray } from "../src/common/utils/json-text";

const root = path.resolve(__dirname, "../../..");
const schemaPath = path.join(root, "prisma", "schema.prisma");
const migrationSqlPath = path.join(
  root,
  "prisma",
  "migrations",
  "20260915120000_phase15_sqlserver_init",
  "migration.sql"
);
const migrateScriptPath = path.join(root, "scripts", "migrate-mongo-to-sqlserver.ts");
const enumsPath = path.join(root, "apps", "api", "src", "database", "prisma-enums.ts");

describe("Phase 15 — SQL Server schema invariants", () => {
  const schema = fs.readFileSync(schemaPath, "utf8");

  it("1. datasource is sqlserver", () => {
    expect(schema).toMatch(/provider\s*=\s*"sqlserver"/);
    expect(schema).not.toMatch(/provider\s*=\s*"mongodb"/);
  });

  it("2. contains no Mongo ObjectId / _id / auto() annotations", () => {
    expect(schema).not.toMatch(/@db\.ObjectId/);
    expect(schema).not.toMatch(/@map\("_id"\)/);
    expect(schema).not.toMatch(/@default\(auto\(\)\)/);
  });

  it("3. string IDs use NVarChar(36) with cuid default", () => {
    expect(schema).toMatch(/@id @default\(cuid\(\)\) @db\.NVarChar\(36\)/);
  });

  it("4. RolePermission and UserSkill junctions exist", () => {
    expect(schema).toMatch(/model RolePermission/);
    expect(schema).toMatch(/model UserSkill/);
    expect(schema).not.toMatch(/permissionIds\s+String/);
    expect(schema).not.toMatch(/roleIds\s+String/);
  });

  it("5. no scalar String\\[\\] lists remain", () => {
    expect(schema).not.toMatch(/String\[\]/);
  });

  it("6. no Prisma Json type (unsupported on SQL Server Prisma 5)", () => {
    expect(schema).not.toMatch(/\sJson\??(\s|$)/);
  });

  it("7. cost snapshot uses Decimal(18,2)", () => {
    expect(schema).toMatch(/partsCost\s+Decimal/);
    expect(schema).toMatch(/@db\.Decimal\(18,\s*2\)/);
  });

  it("8. FK relations use NoAction (no Cascade)", () => {
    expect(schema).not.toMatch(/onDelete:\s*Cascade/);
    expect(schema).toMatch(/onDelete:\s*NoAction/);
  });

  it("9. initial migration SQL exists and was reviewed for junctions", () => {
    expect(fs.existsSync(migrationSqlPath)).toBe(true);
    const sql = fs.readFileSync(migrationSqlPath, "utf8");
    expect(sql).toMatch(/CREATE TABLE \[dbo\]\.\[RolePermission\]/);
    expect(sql).toMatch(/CREATE TABLE \[dbo\]\.\[UserSkill\]/);
    expect(sql).toMatch(/NVARCHAR\(36\)/);
    expect(sql).toMatch(/DECIMAL\(18,2\)/);
    expect(sql).toMatch(/ON DELETE NO ACTION/);
  });

  it("10. migration_lock is mssql (Prisma SQL Server)", () => {
    const lock = fs.readFileSync(path.join(root, "prisma", "migrations", "migration_lock.toml"), "utf8");
    // Prisma writes provider = "mssql" for SQL Server (not "sqlserver")
    expect(lock).toMatch(/provider\s*=\s*"mssql"/);
  });
});

describe("Phase 15 — JSON text helpers", () => {
  it("11. serializes and parses objects", () => {
    const text = toJsonText({ a: 1 });
    expect(text).toBe('{"a":1}');
    expect(parseJsonText(text, {})).toEqual({ a: 1 });
  });

  it("12. string arrays round-trip", () => {
    expect(stringArrayToText(["a", "b"])).toBe('["a","b"]');
    expect(toStringArray('["x"]')).toEqual(["x"]);
    expect(toStringArray(null)).toEqual([]);
  });

  it("13. corrupt JSON fails safe", () => {
    expect(parseJsonText("{not-json", { ok: false })).toEqual({ ok: false });
  });
});

describe("Phase 15 — enum shim + migration tooling", () => {
  it("14. prisma-enums.ts exports RoleName", () => {
    const enums = fs.readFileSync(enumsPath, "utf8");
    expect(enums).toMatch(/export enum RoleName/);
    expect(enums).toMatch(/SUPER_ADMIN/);
  });

  it("15. migrate-mongo-to-sqlserver script is dry-run by default", () => {
    const src = fs.readFileSync(migrateScriptPath, "utf8");
    expect(src).toMatch(/DRY-RUN|dry-run|apply:\s*argv\.includes\("--apply"\)/);
    expect(src).toMatch(/DEPENDENCY_ORDER/);
    expect(src).toMatch(/Preserves Mongo string IDs|preserves/i);
  });

  it("16. package.json exposes prisma migrate scripts", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    expect(pkg.scripts["db:migrate:deploy"]).toMatch(/prisma migrate deploy/);
    expect(pkg.scripts["db:migrate:dev"]).toMatch(/prisma migrate dev/);
    expect(pkg.scripts["db:generate"]).toMatch(/phase15-patch-prisma-enums/);
  });
});

describe("Phase 15 — documentation gate", () => {
  const docs = [
    "PHASE_15_SQLSERVER_MIGRATION_AUDIT.md",
    "PHASE_15_SQLSERVER_MIGRATION.md",
    "SQLSERVER_MIGRATION_RUNBOOK.md",
    "SQLSERVER_DATA_RECONCILIATION.md",
    "SQLSERVER_BACKUP_RESTORE_RUNBOOK.md",
    "SQLSERVER_CUTOVER_ROLLBACK.md"
  ];

  it.each(docs)("doc exists: %s", (name) => {
    expect(fs.existsSync(path.join(root, "docs", name))).toBe(true);
  });
});
