#!/usr/bin/env node
/**
 * Guarded full-data reset for MaintainPro (MongoDB).
 *
 * Required:
 *   ALLOW_DATABASE_RESET=true
 *   CONFIRM_DATABASE_RESET=DELETE_ALL_MAINTAINPRO_DATA
 *   APP_ENVIRONMENT=local|test|staging|development  (never production)
 *   PRIMARY_DATABASE_URL or DATABASE_URL
 *
 * Optional:
 *   SKIP_DATABASE_RESET_BACKUP=true  (local/test only — never production)
 *   MAINTAINPRO_BACKUP_DIR=<absolute path outside repo>
 *   DATABASE_RESET_YES=I_UNDERSTAND  (non-interactive final confirm)
 *
 * Does NOT run seed or bootstrap-admin.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { MongoClient } from "mongodb";
import {
  assertIdentifiable,
  assertNotProduction,
  assertResetConfirmations,
  backupDirFor,
  listPrismaModelsFromSchema,
  loadMaintainProEnv,
  maintainproRoot,
  printRedactedIdentity,
  resolveDatabaseTarget
} from "./lib/database-identity.mjs";

const SYSTEM_COLLECTIONS = new Set(["system.buckets", "system.profile", "system.js", "system.views"]);
const LOCK_COLLECTION = "_MaintainProResetLock";
const LOCK_ID = "global-reset-lock";
const LOCK_TTL_MS = 60 * 60 * 1000;

function isSystemCollection(name) {
  return name.startsWith("system.") || SYSTEM_COLLECTIONS.has(name);
}

async function askYes(promptText) {
  if (!process.stdin.isTTY) {
    const token = (process.env.DATABASE_RESET_YES || "").trim();
    if (token === "I_UNDERSTAND") return true;
    throw new Error(
      "Non-interactive shell requires DATABASE_RESET_YES=I_UNDERSTAND for final confirmation."
    );
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(promptText, resolve));
  rl.close();
  return ["y", "yes"].includes(String(answer || "").trim().toLowerCase());
}

function runMongodump({ url, outDir, databaseName }) {
  return new Promise((resolve, reject) => {
    const args = [`--uri=${url}`, `--db=${databaseName}`, `--out=${outDir}`];
    const child = spawn("mongodump", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      reject(
        new Error(
          `mongodump failed to start (${err.message}). Install MongoDB Database Tools or set SKIP_DATABASE_RESET_BACKUP=true for disposable local/test only.`
        )
      );
    });
    child.on("close", (code) => {
      if (code === 0) resolve({ stderr });
      else reject(new Error(`mongodump exited ${code}: ${stderr.slice(0, 2000)}`));
    });
  });
}


async function verifyBackupNonEmpty(outDir, databaseName) {
  const { readdirSync } = await import("node:fs");
  const walk = (p, depth = 0) => {
    if (depth > 8) return 0;
    let bytes = 0;
    let files = 0;
    for (const name of readdirSync(p, { withFileTypes: true })) {
      const full = path.join(p, name.name);
      if (name.isDirectory()) {
        const nested = walk(full, depth + 1);
        bytes += nested.bytes;
        files += nested.files;
      } else if (name.isFile()) {
        files += 1;
        bytes += statSync(full).size;
      }
    }
    return { bytes, files };
  };
  const dbDump = path.join(outDir, databaseName);
  const target = existsSync(dbDump) ? dbDump : outDir;
  const stats = walk(target);
  if (stats.files === 0 || stats.bytes === 0) {
    throw new Error(`Backup verification failed: empty dump at ${target}`);
  }
  return stats;
}

async function acquireLock(db) {
  const locks = db.collection(LOCK_COLLECTION);
  const now = Date.now();
  const existing = await locks.findOne({ _id: LOCK_ID });
  if (existing && existing.expiresAt && new Date(existing.expiresAt).getTime() > now) {
    throw new Error(
      `Refusing reset: a reset lock is already held (owner=${existing.owner || "unknown"}, expires=${existing.expiresAt}).`
    );
  }
  await locks.replaceOne(
    { _id: LOCK_ID },
    {
      _id: LOCK_ID,
      owner: process.env.USERNAME || process.env.USER || "unknown",
      startedAt: new Date().toISOString(),
      expiresAt: new Date(now + LOCK_TTL_MS).toISOString(),
      pid: process.pid
    },
    { upsert: true }
  );
}

async function releaseLock(db) {
  try {
    await db.collection(LOCK_COLLECTION).deleteOne({ _id: LOCK_ID });
  } catch (err) {
    console.warn(`Warning: failed to release reset lock: ${err.message}`);
  }
}

async function countCollections(db, names) {
  const counts = {};
  let total = 0;
  for (const name of names) {
    try {
      const n = await db.collection(name).countDocuments({});
      counts[name] = n;
      total += n;
    } catch {
      counts[name] = null;
    }
  }
  return { counts, total };
}

async function deleteAllApplicationData(db, collectionNames) {
  const deleted = {};
  for (const name of collectionNames) {
    if (name === LOCK_COLLECTION) continue;
    try {
      const result = await db.collection(name).deleteMany({});
      deleted[name] = result.deletedCount || 0;
    } catch (err) {
      deleted[name] = `error:${err.message}`;
    }
  }
  return deleted;
}

async function clearScopedRedis(report) {
  const redisUrl = (process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING || "").trim();
  if (!redisUrl) {
    report.redis = { skipped: true, reason: "REDIS_URL unset" };
    return;
  }
  let Redis;
  try {
    ({ default: Redis } = await import("ioredis"));
  } catch {
    report.redis = { skipped: true, reason: "ioredis not available" };
    return;
  }

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true
  });
  try {
    await redis.connect();
    const prefixes = [
      "bull:",
      "maintainpro:",
      "MaintainPro:",
      "mp:",
      "tenant:",
      "permissions:",
      "reports:",
      "idempotency:",
      "session:"
    ];
    const dedicated =
      (process.env.REDIS_DEDICATED_DISPOSABLE || "").trim() === "true" &&
      ["local", "test"].includes(report.classification);

    let removed = 0;
    const samples = [];

    if (dedicated) {
      // Still avoid FLUSHALL — scan and delete known prefixes only.
      console.log("Redis marked dedicated/disposable — deleting MaintainPro-prefixed keys only (no FLUSHALL).");
    }

    for (const prefix of prefixes) {
      let cursor = "0";
      do {
        const [next, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 200);
        cursor = next;
        if (keys.length) {
          removed += await redis.del(...keys);
          for (const k of keys.slice(0, 5)) samples.push(k);
        }
      } while (cursor !== "0");
    }

    report.redis = { skipped: false, keysRemoved: removed, sampleKeys: samples.slice(0, 20) };
  } catch (err) {
    report.redis = { skipped: true, reason: err.message };
  } finally {
    try {
      await redis.quit();
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const loadedEnvFiles = loadMaintainProEnv();
  const report = {
    startedAt: new Date().toISOString(),
    loadedEnvFiles,
    backup: null,
    before: null,
    after: null,
    deleted: null,
    redis: null,
    storage: { skipped: true, reason: "run npm run storage:clear:test-data separately" },
    bootstrapAdminCreated: false,
    commitSha: null,
    success: false,
    error: null
  };

  try {
    try {
      const { execSync } = await import("node:child_process");
      report.commitSha = execSync("git rev-parse HEAD", {
        cwd: maintainproRoot,
        encoding: "utf8"
      }).trim();
    } catch {
      report.commitSha = process.env.APP_COMMIT_SHA || process.env.GIT_COMMIT || "unknown";
    }

    console.log("NODE_ENV=", process.env.NODE_ENV || "(unset)");
    console.log("APP_ENVIRONMENT=", process.env.APP_ENVIRONMENT || "(unset)");

    assertResetConfirmations();
    const target = resolveDatabaseTarget();
    report.classification = target.classification;
    report.databaseName = target.databaseName;
    report.host = target.host;
    report.identityFingerprint = target.identityFingerprint;
    printRedactedIdentity(target);

    assertIdentifiable(target);
    assertNotProduction(target);

    const expectedEnvName = (process.env.EXPECTED_DATABASE_NAME || "").trim();
    if (expectedEnvName && expectedEnvName !== target.databaseName) {
      throw new Error(
        `Refusing reset: database name '${target.databaseName}' does not match EXPECTED_DATABASE_NAME='${expectedEnvName}'.`
      );
    }

    const skipBackup = (process.env.SKIP_DATABASE_RESET_BACKUP || "").trim() === "true";
    if (skipBackup) {
      if (!["local", "test"].includes(target.classification)) {
        throw new Error(
          "SKIP_DATABASE_RESET_BACKUP is only permitted for local or test classifications."
        );
      }
      report.backup = { skipped: true, reason: "SKIP_DATABASE_RESET_BACKUP=true" };
      console.log("Backup skipped (disposable local/test).");
    } else {
      const outDir = backupDirFor(target);
      // Ensure backup lives outside the application repository
      const repoRoot = path.resolve(maintainproRoot);
      if (outDir.startsWith(repoRoot + path.sep) || outDir === repoRoot) {
        throw new Error(
          `Refusing backup path inside repository: ${outDir}. Set MAINTAINPRO_BACKUP_DIR outside the repo.`
        );
      }
      mkdirSync(outDir, { recursive: true });
      console.log(`Creating mongodump backup at ${outDir} ...`);
      await runMongodump({ url: target.url, outDir, databaseName: target.databaseName });
      const stats = await verifyBackupNonEmpty(outDir, target.databaseName);
      const restoreCmd = `mongorestore --uri="<REDACTED_URL>" --db=${target.databaseName} --drop "${path.join(outDir, target.databaseName)}"`;
      report.backup = {
        skipped: false,
        path: outDir,
        databaseName: target.databaseName,
        timestamp: new Date().toISOString(),
        files: stats.files,
        bytes: stats.bytes,
        restoreCommand: restoreCmd
      };
      writeFileSync(
        path.join(outDir, "RESTORE.md"),
        `# Restore\n\nDatabase: ${target.databaseName}\nTimestamp: ${report.backup.timestamp}\n\n\`\`\`bash\n${restoreCmd}\n\`\`\`\n`,
        "utf8"
      );
      console.log(`Backup OK: ${stats.files} files, ${stats.bytes} bytes`);
      console.log(`Restore: ${restoreCmd}`);
    }

    const schemaPath = path.join(maintainproRoot, "prisma", "schema.prisma");
    const prismaModels = listPrismaModelsFromSchema(schemaPath);

    const client = new MongoClient(target.url, { maxPoolSize: 5 });
    await client.connect();
    const db = client.db(target.databaseName);

    try {
      await acquireLock(db);

      const existing = await db.listCollections({}, { nameOnly: true }).toArray();
      const liveNames = existing.map((c) => c.name).filter((n) => !isSystemCollection(n));
      const allNames = Array.from(new Set([...prismaModels, ...liveNames])).sort();

      report.before = await countCollections(db, allNames);
      console.log("=== Collection counts BEFORE deletion ===");
      for (const [name, count] of Object.entries(report.before.counts)) {
        if (count) console.log(`  ${name}: ${count}`);
      }
      console.log(`TOTAL documents: ${report.before.total}`);

      const ok = await askYes(
        `\nThis will DELETE ALL MaintainPro data in '${target.databaseName}' (${target.classification}). Type yes to continue: `
      );
      if (!ok) {
        throw new Error("Aborted by operator (final confirmation declined).");
      }

      console.log("Deleting application records...");
      report.deleted = await deleteAllApplicationData(db, allNames);
      // Also drop lock collection contents after we're done — releaseLock handles it

      report.after = await countCollections(db, allNames);
      const remainingApp = Object.entries(report.after.counts)
        .filter(([name, n]) => name !== LOCK_COLLECTION && n > 0)
        .map(([name, n]) => ({ name, count: n }));

      if (remainingApp.length || report.after.total > 0) {
        // lock may still exist
        const nonLockRemaining = remainingApp.filter((r) => r.name !== LOCK_COLLECTION);
        const lockOnly =
          report.after.total > 0 &&
          nonLockRemaining.length === 0 &&
          (report.after.counts[LOCK_COLLECTION] || 0) >= 0;
        if (nonLockRemaining.length > 0) {
          throw new Error(
            `Verification failed: remaining records: ${JSON.stringify(nonLockRemaining)}`
          );
        }
        if (!lockOnly && report.after.total > 0) {
          // ignore lock for emptiness check after release
        }
      }

      await clearScopedRedis(report);

      report.success = true;
      report.finishedAt = new Date().toISOString();

      console.log("\n=== Deletion report ===");
      console.log(`Application database records remaining (excl. lock): ${
        Object.entries(report.after.counts)
          .filter(([n]) => n !== LOCK_COLLECTION)
          .reduce((s, [, c]) => s + (c || 0), 0)
      }`);
      console.log("Sample records: 0 (all collections cleared)");
      console.log("Demo records: 0");
      console.log("Test records: 0");
      console.log("Seed records: 0");
      console.log(`Users: ${report.after.counts.User || 0}`);
      console.log(`Tenants: ${report.after.counts.Tenant || 0}`);
      console.log(`Redis keys removed: ${report.redis?.keysRemoved ?? "n/a"}`);
      console.log("Bootstrap admin created: false (not run)");
      console.log("\nNext steps (manual):");
      console.log("  npm run db:generate");
      console.log("  npm run db:verify-empty");
      console.log("  npm run db:bootstrap-admin   # only if explicitly instructed");
    } finally {
      await releaseLock(db);
      await client.close();
    }

    const reportPath = path.join(
      maintainproRoot,
      "docs",
      "audits",
      "database-reset-report.md"
    );
    mkdirSync(path.dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, renderMarkdownReport(report, target), "utf8");
    console.log(`Wrote ${path.relative(maintainproRoot, reportPath)}`);
  } catch (err) {
    report.success = false;
    report.error = err.message;
    report.finishedAt = new Date().toISOString();
    console.error(`\nRESET FAILED: ${err.message}`);
    const reportPath = path.join(
      maintainproRoot,
      "docs",
      "audits",
      "database-reset-report.md"
    );
    try {
      mkdirSync(path.dirname(reportPath), { recursive: true });
      writeFileSync(reportPath, renderMarkdownReport(report, resolveDatabaseTarget()), "utf8");
    } catch {
      /* ignore */
    }
    process.exitCode = 1;
  }
}

function renderMarkdownReport(report, target) {
  const lines = [
    "# Database reset report",
    "",
    `Generated: ${report.finishedAt || report.startedAt}`,
    `Commit SHA: ${report.commitSha || "unknown"}`,
    "",
    "## Environment",
    "",
    `- NODE_ENV: ${target?.nodeEnv ?? process.env.NODE_ENV ?? "(unset)"}`,
    `- APP_ENVIRONMENT: ${target?.appEnvironment ?? process.env.APP_ENVIRONMENT ?? "(unset)"}`,
    `- Classification: ${report.classification || target?.classification || "unknown"}`,
    `- Provider: mongodb`,
    `- Database name: ${report.databaseName || target?.databaseName || "unknown"}`,
    `- Host: ${report.host || target?.host || "unknown"}`,
    `- Identity fingerprint: ${report.identityFingerprint || target?.identityFingerprint || "n/a"}`,
    `- Loaded env files: ${(report.loadedEnvFiles || []).join(", ") || "(none)"}`,
    "",
    "## Safety outcome",
    "",
    `- Success: ${report.success}`,
    `- Error: ${report.error || "(none)"}`,
    `- Bootstrap admin created: ${report.bootstrapAdminCreated}`,
    "",
    "## Backup",
    "",
    "```json",
    JSON.stringify(report.backup, null, 2),
    "```",
    "",
    "## Counts before",
    "",
    "```json",
    JSON.stringify(report.before, null, 2),
    "```",
    "",
    "## Counts after",
    "",
    "```json",
    JSON.stringify(report.after, null, 2),
    "```",
    "",
    "## Redis / queues",
    "",
    "```json",
    JSON.stringify(report.redis, null, 2),
    "```",
    "",
    "## Object storage",
    "",
    "```json",
    JSON.stringify(report.storage, null, 2),
    "```",
    "",
    "## Production verdict",
    "",
    report.success
      ? "NO-GO until bootstrap-admin (if required), configuration, and verification are complete. Do not auto-seed."
      : "NO-GO — reset did not complete successfully. Source data may still be intact.",
    ""
  ];
  return lines.join("\n");
}

main();