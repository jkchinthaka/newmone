#!/usr/bin/env node
/**
 * Verify MaintainPro MongoDB contains zero application records.
 * Fails closed when any non-system collection still has documents.
 */
import path from "node:path";
import { MongoClient } from "mongodb";
import {
  listPrismaModelsFromSchema,
  loadMaintainProEnv,
  maintainproRoot,
  printRedactedIdentity,
  resolveDatabaseTarget
} from "./lib/database-identity.mjs";

const IGNORE = new Set(["_MaintainProResetLock"]);

function isSystemCollection(name) {
  return name.startsWith("system.");
}

async function main() {
  loadMaintainProEnv();
  const target = resolveDatabaseTarget();
  printRedactedIdentity(target);

  if (!target.urlPresent) {
    console.error("FAIL: database URL missing");
    process.exit(1);
  }
  if (!target.databaseName || target.databaseName === "unknown") {
    console.error("FAIL: database name unknown");
    process.exit(1);
  }

  const schemaPath = path.join(maintainproRoot, "prisma", "schema.prisma");
  const prismaModels = listPrismaModelsFromSchema(schemaPath);

  const client = new MongoClient(target.url, { maxPoolSize: 3 });
  await client.connect();
  try {
    const db = client.db(target.databaseName);
    const live = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((c) => c.name)
      .filter((n) => !isSystemCollection(n));

    const allNames = Array.from(new Set([...prismaModels, ...live])).sort();
    const remaining = [];
    let total = 0;

    for (const name of allNames) {
      if (IGNORE.has(name)) continue;
      let count = 0;
      try {
        count = await db.collection(name).countDocuments({});
      } catch (err) {
        remaining.push({ name, count: null, error: err.message });
        continue;
      }
      if (count > 0) {
        remaining.push({ name, count });
        total += count;
      }
    }

    console.log("=== Empty-database verification ===");
    console.log(`Prisma models inspected: ${prismaModels.length}`);
    console.log(`Live collections inspected: ${live.length}`);
    console.log(`Remaining documents: ${total}`);

    if (remaining.length) {
      console.error("FAIL: application or sample records remain:");
      for (const row of remaining) {
        console.error(`  ${row.name}: ${row.count}${row.error ? ` (${row.error})` : ""}`);
      }
      process.exit(1);
    }

    console.log("Application database records: 0");
    console.log("Sample records: 0");
    console.log("Demo records: 0");
    console.log("Test records: 0");
    console.log("Seed records: 0");
    console.log("Users: 0");
    console.log("Tenants: 0");
    console.log("PASS: database is empty of application records.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
});