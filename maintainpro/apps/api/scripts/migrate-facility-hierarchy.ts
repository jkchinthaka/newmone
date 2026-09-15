/**
 * CLI: migrate Property→Building→Floor→Room into Site + FunctionalLocation.
 *
 * Dry-run (default):
 *   npx tsx apps/api/scripts/migrate-facility-hierarchy.ts --tenant <tenantId>
 *
 * Apply:
 *   ALLOW_FACILITY_HIERARCHY_MIGRATE_APPLY=true npx tsx apps/api/scripts/migrate-facility-hierarchy.ts --tenant <tenantId> --apply
 */
import { PrismaClient } from "@prisma/client";

import { FacilityHierarchyMigrationService } from "../src/modules/organization/facility-hierarchy-migration.service";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const tenantId = argValue("--tenant");
  if (!tenantId) {
    console.error("Missing --tenant <tenantId>");
    process.exit(1);
  }

  const apply = process.argv.includes("--apply");
  if (apply && process.env.ALLOW_FACILITY_HIERARCHY_MIGRATE_APPLY !== "true") {
    console.error("Set ALLOW_FACILITY_HIERARCHY_MIGRATE_APPLY=true to apply.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const service = new FacilityHierarchyMigrationService(prisma as never);
  try {
    const report = await service.migrateTenant(tenantId, { dryRun: !apply });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
