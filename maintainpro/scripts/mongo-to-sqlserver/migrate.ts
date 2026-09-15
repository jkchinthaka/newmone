/**
 * Phase 15A — MongoDB → SQL Server migration runner.
 *
 * DRY-RUN default (validates transforms + refs). --apply writes.
 *
 * Usage (maintainpro/):
 *   SQLSERVER_URL=... MONGO_URL=... npx tsx scripts/mongo-to-sqlserver/migrate.ts
 *   ... --apply
 */
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { MongoClient, type Db } from "mongodb";

import { buildRegistry, DEPENDENCY_ORDER, JUNCTION_EXTRACTORS, type ModelEntry } from "./registry";
import { objectIdToString, transformDocument } from "./transforms";

type Args = { apply: boolean; tenantId?: string; batchSize: number };

type ModelReport = {
  model: string;
  classification: string;
  collectionExpected: string;
  collectionFound: boolean;
  source: number;
  sql: number;
  migrated: number;
  failed: number;
  skipped: number;
  orphans: number;
  transformOk: number;
  transformFail: number;
  missingParents: number;
  notes: string[];
  result: "PASS" | "FAIL" | "SKIP" | "DRY";
};

function parseArgs(argv: string[]): Args {
  return {
    apply: argv.includes("--apply"),
    tenantId: argv.find((a) => a.startsWith("--tenant="))?.slice("--tenant=".length),
    batchSize: Number(argv.find((a) => a.startsWith("--batch="))?.slice("--batch=".length) || 200)
  };
}

function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function stableId(...parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

function newCuidLike(): string {
  return `c${randomBytes(12).toString("hex")}`;
}

async function listCollections(db: Db): Promise<Set<string>> {
  const cols = await db.listCollections().toArray();
  return new Set(cols.map((c) => c.name));
}

function stripMongoOnly(doc: Record<string, unknown>, arrays: string[] = []): Record<string, unknown> {
  const out = { ...doc };
  for (const a of arrays) delete out[a];
  delete out.permissionIds;
  delete out.roleIds;
  delete out.skills;
  delete out.requiredPartIds;
  delete out.assetIds;
  delete out.siteIds;
  delete out.sprayLogIds;
  return out;
}

function pickScalarFields(
  model: string,
  doc: Record<string, unknown>,
  dmmfModels: Map<string, Set<string>>
): Record<string, unknown> {
  const allowed = dmmfModels.get(model);
  if (!allowed) return doc;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

function loadDmmfScalars(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Prisma } = require("@prisma/client") as typeof import("@prisma/client");
    for (const m of Prisma.dmmf.datamodel.models) {
      const scalars = new Set(
        m.fields.filter((f) => f.kind === "scalar" || f.kind === "enum").map((f) => f.name)
      );
      map.set(m.name, scalars);
    }
  } catch {
    /* empty */
  }
  return map;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sqlUrl = process.env.SQLSERVER_URL || process.env.DATABASE_URL || "";
  const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI || process.env.PRIMARY_DATABASE_URL || "";

  console.log(`[migrate] mode=${args.apply ? "APPLY" : "DRY-RUN"} batch=${args.batchSize}`);

  if (args.apply && !String(sqlUrl).includes("sqlserver://")) {
    throw new Error("APPLY requires SQLSERVER_URL/DATABASE_URL with sqlserver://");
  }

  const sql = new PrismaClient({
    datasources: sqlUrl ? { db: { url: sqlUrl } } : undefined
  });

  let mongoClient: MongoClient | null = null;
  let db: Db | null = null;
  let collectionNames = new Set<string>();

  if (mongoUrl.startsWith("mongodb")) {
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db(process.env.MONGO_DB_NAME || undefined);
    collectionNames = await listCollections(db);
    console.log(`[migrate] mongo db=${db.databaseName} collections=${collectionNames.size}`);
  } else {
    console.warn("[migrate] No Mongo URL — dry inventory limited");
  }

  const dmmfModels = (PrismaClient as unknown as { dmmf?: { datamodel: { models: { name: string }[] } } }).dmmf
    ?.datamodel.models.map((m) => m.name) ?? DEPENDENCY_ORDER;

  // Prefer Prisma runtime model list
  let modelNames = DEPENDENCY_ORDER;
  try {
    const { Prisma } = await import("@prisma/client");
    modelNames = Prisma.dmmf.datamodel.models.map((m) => m.name);
  } catch {
    modelNames = [...DEPENDENCY_ORDER];
  }

  const dmmfScalars = loadDmmfScalars();
  const registry = buildRegistry(modelNames);
  const migrateEntries = registry.filter((e) => e.classification === "MIGRATE");
  const reports: ModelReport[] = [];
  let criticalFailures = 0;

  // Junction buffer filled while processing parents
  const junctionQueue: Array<{ model: string; row: Record<string, unknown> }> = [];

  for (const entry of migrateEntries) {
    const report = await processModel(entry, {
      args,
      sql,
      db,
      collectionNames,
      junctionQueue,
      dmmfScalars
    });
    reports.push(report);
    if (report.result === "FAIL") criticalFailures += 1;
    console.log(
      `[migrate] ${entry.model.padEnd(28)} found=${report.collectionFound} src=${report.source} sql=${report.sql} mig=${report.migrated} fail=${report.failed} txFail=${report.transformFail} missParent=${report.missingParents} => ${report.result}`
    );
  }

  // Process deferred junctions that are themselves MIGRATE models (RolePermission etc. may also appear as empty collections)
  for (const j of ["RolePermission", "UserSkill", "JobCodeRequiredPart", "PmPlanRequiredPart", "VendorContractAsset", "VendorContractSite", "TraceabilitySprayLink"]) {
    const queued = junctionQueue.filter((q) => q.model === j);
    if (!queued.length) continue;
    const del = (sql as any)[delegateName(j)];
    let migrated = 0;
    let failed = 0;
    for (const item of queued) {
      try {
        if (args.apply) {
          const data = { ...item.row, id: item.row.id || stableId(j, JSON.stringify(item.row)) };
          if (j === "RolePermission") {
            await del.upsert({
              where: { roleId_permissionId: { roleId: data.roleId, permissionId: data.permissionId } },
              create: data,
              update: {}
            });
          } else if (j === "UserSkill") {
            await del.upsert({
              where: { userId_skill: { userId: data.userId, skill: data.skill } },
              create: data,
              update: {}
            });
          } else if (j === "JobCodeRequiredPart") {
            await del.upsert({
              where: { jobCodeId_sparePartId: { jobCodeId: data.jobCodeId, sparePartId: data.sparePartId } },
              create: data,
              update: {}
            });
          } else if (j === "PmPlanRequiredPart") {
            await del.upsert({
              where: { pmPlanId_sparePartId: { pmPlanId: data.pmPlanId, sparePartId: data.sparePartId } },
              create: data,
              update: {}
            });
          } else if (j === "VendorContractAsset") {
            await del.upsert({
              where: {
                vendorContractId_assetId: { vendorContractId: data.vendorContractId, assetId: data.assetId }
              },
              create: data,
              update: {}
            });
          } else if (j === "VendorContractSite") {
            await del.upsert({
              where: { vendorContractId_siteId: { vendorContractId: data.vendorContractId, siteId: data.siteId } },
              create: data,
              update: {}
            });
          } else if (j === "TraceabilitySprayLink") {
            await del.upsert({
              where: {
                traceabilityRecordId_sprayLogId: {
                  traceabilityRecordId: data.traceabilityRecordId,
                  sprayLogId: data.sprayLogId
                }
              },
              create: data,
              update: {}
            });
          } else {
            await del.upsert({ where: { id: data.id }, create: data, update: data });
          }
        }
        migrated += 1;
      } catch (e) {
        failed += 1;
        criticalFailures += 1;
        console.error(`[migrate] junction ${j} fail:`, (e as Error).message);
      }
    }
    reports.push({
      model: `${j} (from parent arrays)`,
      classification: "MIGRATE",
      collectionExpected: "(derived)",
      collectionFound: true,
      source: queued.length,
      sql: args.apply && del?.count ? await del.count() : 0,
      migrated,
      failed,
      skipped: args.apply ? 0 : queued.length,
      orphans: 0,
      transformOk: queued.length,
      transformFail: 0,
      missingParents: 0,
      notes: ["Derived from parent scalar lists"],
      result: failed ? "FAIL" : args.apply ? "PASS" : "DRY"
    });
  }

  // Skipped registry entries summary
  for (const entry of registry.filter((e) => e.classification !== "MIGRATE")) {
    reports.push({
      model: entry.model,
      classification: entry.classification,
      collectionExpected: entry.collection,
      collectionFound: collectionNames.has(entry.collection),
      source: 0,
      sql: 0,
      migrated: 0,
      failed: 0,
      skipped: 0,
      orphans: 0,
      transformOk: 0,
      transformFail: 0,
      missingParents: 0,
      notes: [entry.reason || ""],
      result: "SKIP"
    });
  }

  console.log("\n=== RECONCILIATION ===");
  console.table(
    reports
      .filter((r) => r.classification === "MIGRATE" || r.model.includes("from parent"))
      .map((r) => ({
        Model: r.model,
        Source: r.source,
        SQL: r.sql,
        Migrated: r.migrated,
        Failed: r.failed,
        Skipped: r.skipped,
        Orphans: r.orphans,
        Result: r.result
      }))
  );

  console.log(`[migrate] criticalFailures=${criticalFailures}`);

  await sql.$disconnect();
  if (mongoClient) await mongoClient.close();

  if (criticalFailures > 0 || (!args.apply && reports.some((r) => r.transformFail > 0 || (r.classification === "MIGRATE" && !r.collectionFound && r.notes.includes("REQUIRED_COLLECTION_MISSING"))))) {
    process.exitCode = 2;
  }
}

async function processModel(
  entry: ModelEntry,
  ctx: {
    args: Args;
    sql: PrismaClient;
    db: Db | null;
    collectionNames: Set<string>;
    junctionQueue: Array<{ model: string; row: Record<string, unknown> }>;
    dmmfScalars: Map<string, Set<string>>;
  }
): Promise<ModelReport> {
  const report: ModelReport = {
    model: entry.model,
    classification: entry.classification,
    collectionExpected: entry.collection,
    collectionFound: ctx.collectionNames.has(entry.collection),
    source: 0,
    sql: 0,
    migrated: 0,
    failed: 0,
    skipped: 0,
    orphans: 0,
    transformOk: 0,
    transformFail: 0,
    missingParents: 0,
    notes: [],
    result: "DRY"
  };

  // Derived-only models (junctions without source collection) — ok if missing
  const derivedOnly = ["RolePermission", "UserSkill", "JobCodeRequiredPart", "PmPlanRequiredPart", "VendorContractAsset", "VendorContractSite", "TraceabilitySprayLink"];
  if (!report.collectionFound) {
    if (derivedOnly.includes(entry.model)) {
      report.notes.push("Derived junction — source collection optional");
      report.result = ctx.args.apply ? "PASS" : "DRY";
      return report;
    }
    report.notes.push("REQUIRED_COLLECTION_MISSING_IN_SOURCE");
    report.result = "SKIP";
    // Not a critical failure for partial fixture snapshots unless STRICT_COLLECTIONS=1
    if (process.env.STRICT_COLLECTIONS === "1") {
      report.result = "FAIL";
    }
    return report;
  }

  if (!ctx.db) {
    report.notes.push("No mongo connection");
    report.result = "FAIL";
    return report;
  }

  const filter =
    ctx.args.tenantId && entry.model !== "Permission" && entry.model !== "Tenant"
      ? { tenantId: ctx.args.tenantId }
      : {};

  report.source = await ctx.db.collection(entry.collection).countDocuments(filter);
  const del = (ctx.sql as any)[delegateName(entry.model)];
  if (del?.count) {
    try {
      report.sql = await del.count(
        ctx.args.tenantId && entry.model !== "Permission" && entry.model !== "Tenant"
          ? { where: { tenantId: ctx.args.tenantId } }
          : undefined
      );
    } catch {
      report.sql = 0;
    }
  }

  const cursor = ctx.db.collection(entry.collection).find(filter).batchSize(ctx.args.batchSize);
  const extractors = JUNCTION_EXTRACTORS[entry.model] || [];

  while (await cursor.hasNext()) {
    const raw = (await cursor.next()) as Record<string, unknown>;
    try {
      const transformed = transformDocument(raw);
      const id = String(transformed.id || "");
      if (!id) throw new Error("missing id");

      // Extract junctions before strip
      for (const ex of extractors) {
        const arr = raw[ex.arrayField] ?? transformed[ex.arrayField];
        if (!Array.isArray(arr)) continue;
        for (const v of arr) {
          const childId = objectIdToString(v);
          if (!childId) continue;
          const row = ex.mapRow(id, String(childId), transformed);
          row.id = row.id || stableId(ex.junctionModel, id, String(childId));
          ctx.junctionQueue.push({ model: ex.junctionModel, row });
        }
      }

      const data = pickScalarFields(
        entry.model,
        stripMongoOnly(transformed, entry.junctionArrays),
        ctx.dmmfScalars
      );

      // Dry-run validation only
      if (!ctx.args.apply) {
        report.transformOk += 1;
        report.skipped += 1;
        continue;
      }

      await del.upsert({
        where: { id },
        create: data,
        update: data
      });
      report.migrated += 1;
      report.transformOk += 1;
    } catch (e) {
      report.failed += 1;
      report.transformFail += 1;
      report.notes.push((e as Error).message.slice(0, 120));
    }
  }

  if (ctx.args.apply && del?.count) {
    report.sql = await del.count(
      ctx.args.tenantId && entry.model !== "Permission" && entry.model !== "Tenant"
        ? { where: { tenantId: ctx.args.tenantId } }
        : undefined
    );
  }

  report.result = report.failed > 0 || report.transformFail > 0 ? "FAIL" : ctx.args.apply ? "PASS" : "DRY";
  return report;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
