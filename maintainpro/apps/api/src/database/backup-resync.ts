import { performance } from "node:perf_hooks";

import { PrismaClient } from "@prisma/client";

import { getDatabaseReplicationConfig } from "./replication.config";
import { getDelegate, sanitizeRecordForModel, SYNCABLE_MODEL_NAMES } from "./replication.utils";

type ResyncRow = {
  model: string;
  primaryCount: number;
  backupUpsertCount: number;
  failedCount: number;
  durationMs: number;
};

const dryRun = process.argv.includes("--dry-run");
const config = getDatabaseReplicationConfig();

if (config.primaryDatabaseUrl) {
  process.env.DATABASE_URL = config.primaryDatabaseUrl;
  process.env.PRIMARY_DATABASE_URL = config.primaryDatabaseUrl;
  process.env.MONGODB_URI = process.env.MONGODB_URI || config.primaryDatabaseUrl;
}

const primary = new PrismaClient();
const backup = config.backupDatabaseUrl
  ? new PrismaClient({ datasources: { db: { url: config.backupDatabaseUrl } } })
  : null;

async function resyncModel(modelName: string): Promise<ResyncRow> {
  const startedAt = performance.now();
  const primaryDelegate = getDelegate(primary, modelName);
  const backupDelegate = backup ? getDelegate(backup, modelName) : null;

  if (!primaryDelegate?.findMany || !primaryDelegate.count) {
    return { model: modelName, primaryCount: 0, backupUpsertCount: 0, failedCount: 1, durationMs: 0 };
  }

  const primaryCount = await primaryDelegate.count();
  let backupUpsertCount = 0;
  let failedCount = 0;
  const pageSize = Math.max(1, config.batchSize);

  for (let skip = 0; skip < primaryCount; skip += pageSize) {
    const rows = await primaryDelegate.findMany({
      skip,
      take: pageSize,
      orderBy: { id: "asc" }
    });

    for (const row of rows) {
      const payload = sanitizeRecordForModel(modelName, row);
      if (!payload?.id || typeof payload.id !== "string") {
        failedCount += 1;
        continue;
      }

      if (dryRun) {
        backupUpsertCount += 1;
        continue;
      }

      if (!backupDelegate?.upsert) {
        failedCount += 1;
        continue;
      }

      const updatePayload = { ...payload };
      delete updatePayload.id;

      try {
        await backupDelegate.upsert({
          where: { id: payload.id },
          create: payload,
          update: updatePayload
        });
        backupUpsertCount += 1;
      } catch {
        failedCount += 1;
      }
    }
  }

  return {
    model: modelName,
    primaryCount,
    backupUpsertCount,
    failedCount,
    durationMs: Math.round(performance.now() - startedAt)
  };
}

async function main(): Promise<void> {
  if (!dryRun && !backup) {
    throw new Error("BACKUP_DATABASE_URL is required unless --dry-run is used.");
  }

  await primary.$connect();
  if (backup) await backup.$connect();

  const rows: ResyncRow[] = [];
  for (const modelName of SYNCABLE_MODEL_NAMES) {
    rows.push(await resyncModel(modelName));
  }

  const totals = rows.reduce(
    (acc, row) => ({
      primaryCount: acc.primaryCount + row.primaryCount,
      backupUpsertCount: acc.backupUpsertCount + row.backupUpsertCount,
      failedCount: acc.failedCount + row.failedCount,
      durationMs: acc.durationMs + row.durationMs
    }),
    { primaryCount: 0, backupUpsertCount: 0, failedCount: 0, durationMs: 0 }
  );

  console.log(`Backup resync ${dryRun ? "dry-run" : "run"} completed.`);
  console.table(rows);
  console.table([{ model: "TOTAL", ...totals }]);
}

main()
  .catch((error) => {
    console.error(`Backup resync failed: ${(error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([primary.$disconnect(), backup?.$disconnect()]);
  });