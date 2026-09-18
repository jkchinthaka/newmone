#!/usr/bin/env node
/**
 * Deletes only records tagged for the explicit E2E_RUN_ID in the E2E SQL Server database.
 * Refuses wildcard deletion and non-E2E databases.
 */

import { createRequire } from "node:module";
import {
  assertAllE2eGuards,
  loadE2eEnvOnly
} from "./lib/e2e-guards.mjs";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

async function main() {
  loadE2eEnvOnly();
  const runId = (process.env.E2E_RUN_ID || "").trim();
  const identity = assertAllE2eGuards({ requireRunId: true });
  if ((process.env.CONFIRM_E2E_CLEANUP || "").trim() !== `DELETE_E2E_RUN_${runId}`) {
    throw new Error(
      `Refusing cleanup: set CONFIRM_E2E_CLEANUP=DELETE_E2E_RUN_${runId}`
    );
  }
  if (identity.provider !== "sqlserver") {
    throw new Error("E2E cleanup requires SQL Server.");
  }

  const url = (process.env.E2E_DATABASE_URL_HOST || "").trim() || identity.url;
  process.env.DATABASE_URL = url;
  process.env.DATABASE_PROVIDER = "sqlserver";

  const prisma = new PrismaClient();
  try {
    const tenantSlugs = [`e2e-a-${runId}`.toLowerCase(), `e2e-b-${runId}`.toLowerCase()];
    const tenants = await prisma.tenant.findMany({
      where: { slug: { in: tenantSlugs } },
      select: { id: true, slug: true }
    });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length === 0) {
      console.log("No E2E tenants found for run; nothing to delete.");
      return;
    }

    // Child tables first (NoAction FKs)
    await prisma.workOrder.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.sparePart.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.supplier.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.vehicle.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.asset.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.department.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { tenantId: { in: tenantIds } },
          { email: { contains: `.${runId}@` } }
        ]
      }
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { tenantId: { in: tenantIds } } }
    });
    await prisma.role.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });

    console.log(`E2E cleanup complete for runId=${runId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`E2E cleanup FAILED: ${err.message}`);
  process.exit(1);
});
