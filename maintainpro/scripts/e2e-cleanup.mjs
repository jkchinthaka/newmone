#!/usr/bin/env node
/**
 * Deletes only documents tagged for the explicit E2E_RUN_ID in the E2E database.
 * Refuses wildcard deletion and non-E2E databases.
 */

import { MongoClient } from "mongodb";
import {
  assertAllE2eGuards,
  loadE2eEnvOnly
} from "./lib/e2e-guards.mjs";

async function main() {
  loadE2eEnvOnly();
  const runId = (process.env.E2E_RUN_ID || "").trim();
  const identity = assertAllE2eGuards({ requireRunId: true });
  if ((process.env.CONFIRM_E2E_CLEANUP || "").trim() !== `DELETE_E2E_RUN_${runId}`) {
    throw new Error(
      `Refusing cleanup: set CONFIRM_E2E_CLEANUP=DELETE_E2E_RUN_${runId}`
    );
  }

  const url = (process.env.E2E_DATABASE_URL_HOST || "").trim() || identity.url;
  const client = new MongoClient(url, { maxPoolSize: 3 });
  await client.connect();
  const db = client.db(identity.databaseName);

  try {
    const tenantSlugs = [`e2e-a-${runId}`.toLowerCase(), `e2e-b-${runId}`.toLowerCase()];
    const tenants = await db
      .collection("Tenant")
      .find({ slug: { $in: tenantSlugs } })
      .project({ _id: 1, slug: 1 })
      .toArray();
    const tenantIds = tenants.map((t) => t._id);
    if (tenantIds.length === 0) {
      console.log("No E2E tenants found for run; nothing to delete.");
      return;
    }

    const collections = [
      "WorkOrder",
      "SparePart",
      "Supplier",
      "Vehicle",
      "Asset",
      "Department",
      "TenantMembership",
      "User",
      "Role",
      "AuditLog",
      "StockMovement",
      "Tenant"
    ];

    for (const name of collections) {
      const col = db.collection(name);
      let result;
      if (name === "Tenant") {
        result = await col.deleteMany({ _id: { $in: tenantIds } });
      } else if (name === "User") {
        result = await col.deleteMany({
          $or: [
            { tenantId: { $in: tenantIds } },
            { email: { $regex: `\\.${runId}@` } }
          ]
        });
      } else {
        result = await col.deleteMany({ tenantId: { $in: tenantIds } });
      }
      console.log(`cleanup ${name}: deleted=${result.deletedCount}`);
    }
    console.log(`E2E cleanup complete for runId=${runId}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(`E2E cleanup FAILED: ${err.message}`);
  process.exit(1);
});