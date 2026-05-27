import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

import { PrismaClient, ReplicationOutboxStatus } from "@prisma/client";

import { getDatabaseReplicationConfig } from "./replication.config";
import { getDelegate, sanitizeRecordForModel, VERIFICATION_MODEL_NAMES } from "./replication.utils";

type VerifyRow = {
  model: string;
  primaryCount: number;
  backupCount: number;
  countsMatch: boolean;
  checksumMatch: boolean | "skipped";
  durationMs: number;
};

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

async function checksum(client: PrismaClient, modelName: string): Promise<string> {
  const delegate = getDelegate(client, modelName);
  if (!delegate?.findMany) return "";

  const rows = await delegate.findMany({ orderBy: { id: "asc" } });
  const hash = createHash("sha256");

  for (const row of rows) {
    const sanitized = sanitizeRecordForModel(modelName, row);
    hash.update(JSON.stringify(sanitized ?? {}));
    hash.update("\n");
  }

  return hash.digest("hex");
}

async function verifyModel(modelName: string): Promise<VerifyRow> {
  const startedAt = performance.now();
  const primaryDelegate = getDelegate(primary, modelName);
  const backupDelegate = backup ? getDelegate(backup, modelName) : null;

  if (!primaryDelegate?.count || !backupDelegate?.count) {
    return {
      model: modelName,
      primaryCount: 0,
      backupCount: 0,
      countsMatch: false,
      checksumMatch: "skipped",
      durationMs: Math.round(performance.now() - startedAt)
    };
  }

  const [primaryCount, backupCount] = await Promise.all([
    primaryDelegate.count(),
    backupDelegate.count()
  ]);
  const countsMatch = primaryCount === backupCount;
  const checksumMatch = countsMatch
    ? (await checksum(primary, modelName)) === (await checksum(backup!, modelName))
    : false;

  return {
    model: modelName,
    primaryCount,
    backupCount,
    countsMatch,
    checksumMatch,
    durationMs: Math.round(performance.now() - startedAt)
  };
}

async function main(): Promise<void> {
  if (!backup) {
    throw new Error("BACKUP_DATABASE_URL is required for backup verification.");
  }

  await Promise.all([primary.$connect(), backup.$connect()]);

  const rows: VerifyRow[] = [];
  for (const modelName of VERIFICATION_MODEL_NAMES) {
    rows.push(await verifyModel(modelName));
  }

  const [lastSynced, pendingEvents, failedEvents, deadLetterEvents, oldestOpen] = await Promise.all([
    primary.replicationOutbox.findFirst({
      where: { status: ReplicationOutboxStatus.SYNCED, syncedAt: { not: null } },
      orderBy: { syncedAt: "desc" },
      select: { syncedAt: true }
    }),
    primary.replicationOutbox.count({ where: { status: ReplicationOutboxStatus.PENDING } }),
    primary.replicationOutbox.count({ where: { status: ReplicationOutboxStatus.FAILED } }),
    primary.replicationOutbox.count({ where: { status: ReplicationOutboxStatus.DEAD_LETTER } }),
    primary.replicationOutbox.findFirst({
      where: {
        status: {
          in: [
            ReplicationOutboxStatus.PENDING,
            ReplicationOutboxStatus.PROCESSING,
            ReplicationOutboxStatus.FAILED
          ]
        }
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true }
    })
  ]);

  const mismatches = rows.filter((row) => !row.countsMatch || row.checksumMatch === false);
  const replicationLagMs = oldestOpen ? Math.max(0, Date.now() - oldestOpen.createdAt.getTime()) : 0;

  console.log("Backup verification completed.");
  console.table(rows);
  console.table([
    {
      lastSyncTime: lastSynced?.syncedAt?.toISOString() ?? "never",
      pendingEvents,
      failedEvents,
      deadLetterEvents,
      replicationLagMs,
      mismatchedModels: mismatches.length
    }
  ]);

  if (mismatches.length > 0 || failedEvents > 0 || deadLetterEvents > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(`Backup verification failed: ${(error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([primary.$disconnect(), backup?.$disconnect()]);
  });