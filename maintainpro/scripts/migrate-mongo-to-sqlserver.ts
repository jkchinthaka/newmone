/**
 * Phase 15 — MongoDB → SQL Server data migration utility.
 *
 * DRY-RUN by default. Pass --apply to write to SQL Server.
 * Preserves Mongo string IDs. Does not delete source data.
 *
 * Usage (from maintainpro/):
 *   MONGO_URL=... SQLSERVER_URL=... npx ts-node --transpile-only scripts/migrate-mongo-to-sqlserver.ts
 *   ... --apply
 *   ... --tenant=<tenantId>
 */
import { PrismaClient as SqlPrisma } from "@prisma/client";

type Args = { apply: boolean; tenantId?: string; batchSize: number };

function parseArgs(argv: string[]): Args {
  return {
    apply: argv.includes("--apply"),
    tenantId: argv.find((a) => a.startsWith("--tenant="))?.slice("--tenant=".length),
    batchSize: Number(argv.find((a) => a.startsWith("--batch="))?.slice("--batch=".length) || 200)
  };
}

type CountRow = {
  model: string;
  mongo: number;
  sql: number;
  migrated: number;
  failed: number;
  skipped: number;
  orphans: number;
  notes?: string;
};

const DEPENDENCY_ORDER = [
  "Tenant",
  "Permission",
  "Role",
  "RolePermission",
  "User",
  "UserSkill",
  "Department",
  "Site",
  "FunctionalLocation",
  "AssetDomain",
  "AssetCategoryMaster",
  "AssetTypeMaster",
  "Asset",
  "Vehicle",
  "Driver",
  "Supplier",
  "SparePart",
  "Warehouse",
  "MaintenanceRequest",
  "WorkOrder",
  "ApprovalRule",
  "ApprovalRequest",
  "PmPlan",
  "AssetMeter",
  "Inspection",
  "CalibrationRecord",
  "ComplianceRequirement",
  "WorkOrderCostSnapshot",
  "VendorContract",
  "AuditLog"
] as const;

async function connectMongo(): Promise<{ db: any; client: any } | null> {
  const url = process.env.MONGO_URL || process.env.MONGODB_URI || process.env.PRIMARY_DATABASE_URL || "";
  if (!url.startsWith("mongodb")) {
    console.warn("[migrate] No Mongo source URL (MONGO_URL / MONGODB_URI / PRIMARY_DATABASE_URL). Dry inventory only.");
    return null;
  }
  try {
    // Lazy require so SQL-only environments still load this script
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MongoClient } = require("mongodb") as typeof import("mongodb");
    const client = new MongoClient(url);
    await client.connect();
    const dbName = process.env.MONGO_DB_NAME || undefined;
    const db = client.db(dbName);
    return { db, client };
  } catch (err) {
    console.error("[migrate] Mongo connect failed:", err);
    return null;
  }
}

function collectionName(model: string): string {
  // Prisma Mongo default: model name as collection
  return model.charAt(0).toLowerCase() + model.slice(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`[migrate] mode=${args.apply ? "APPLY" : "DRY-RUN"} batch=${args.batchSize}`);

  const sqlUrl = process.env.SQLSERVER_URL || process.env.DATABASE_URL || "";
  if (args.apply && !sqlUrl.includes("sqlserver://")) {
    throw new Error("APPLY requires SQLSERVER_URL or DATABASE_URL with sqlserver:// protocol");
  }

  const sql = new SqlPrisma({
    datasources: sqlUrl ? { db: { url: sqlUrl } } : undefined
  });

  const mongo = await connectMongo();
  const report: CountRow[] = [];

  for (const model of DEPENDENCY_ORDER) {
    const row: CountRow = {
      model,
      mongo: 0,
      sql: 0,
      migrated: 0,
      failed: 0,
      skipped: 0,
      orphans: 0
    };

    try {
      if (mongo) {
        row.mongo = await mongo.db.collection(collectionName(model)).countDocuments(
          args.tenantId && model !== "Permission" ? { tenantId: args.tenantId } : {}
        );
      }

      const delegate = (sql as any)[model.charAt(0).toLowerCase() + model.slice(1)];
      if (delegate?.count) {
        row.sql = await delegate.count({
          where: args.tenantId && model !== "Permission" && model !== "Tenant" ? { tenantId: args.tenantId } : undefined
        });
      }

      if (!args.apply) {
        row.notes = "dry-run — no writes";
        row.skipped = row.mongo;
      } else if (!mongo) {
        row.notes = "no mongo source — skipped";
        row.skipped = 1;
      } else {
        // Idempotent upsert by preserved id — model-specific transforms live in transform registry docs
        const cursor = mongo.db.collection(collectionName(model)).find(
          args.tenantId && model !== "Permission" ? { tenantId: args.tenantId } : {}
        );
        while (await cursor.hasNext()) {
          const doc = await cursor.next();
          if (!doc) break;
          const id = String(doc._id ?? doc.id);
          try {
            // Strip Mongo-only array dual-keys; callers must pre-transform Role.permissionIds etc.
            const { _id, permissionIds, roleIds, skills, requiredPartIds, assetIds, siteIds, sprayLogIds, ...rest } =
              doc as Record<string, unknown>;
            const data = { ...rest, id };
            await delegate.upsert({
              where: { id },
              create: data,
              update: data
            });
            row.migrated += 1;
          } catch (e) {
            row.failed += 1;
            console.error(`[migrate] ${model} id=${id} failed:`, (e as Error).message);
          }
        }
      }
    } catch (e) {
      row.failed += 1;
      row.notes = (e as Error).message;
    }

    report.push(row);
    console.log(
      `[migrate] ${model.padEnd(28)} mongo=${row.mongo} sql=${row.sql} migrated=${row.migrated} failed=${row.failed}`
    );
  }

  console.log("\n=== RECONCILIATION SUMMARY ===");
  console.table(report);

  const unresolved = report.filter((r) => r.failed > 0 || (args.apply && r.mongo !== r.sql + r.failed && r.migrated > 0));
  if (unresolved.length) {
    console.warn(`[migrate] unresolved rows: ${unresolved.length}`);
  } else {
    console.log("[migrate] no failed rows in this pass");
  }

  await sql.$disconnect();
  if (mongo) await mongo.client.close();

  if (args.apply && report.some((r) => r.failed > 0)) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
