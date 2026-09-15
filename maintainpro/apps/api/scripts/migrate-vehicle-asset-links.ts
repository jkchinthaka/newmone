/**
 * Phase 10: Backfill Vehicle → Asset links.
 * Dry-run by default: reports vehicles without an assetId.
 * Idempotent: skips vehicles that already have an assetId or have a duplicate registrationNo
 * within the same tenant (ambiguous mapping — manual resolution required).
 *
 * Usage (from maintainpro/):
 *   npx ts-node apps/api/scripts/migrate-vehicle-asset-links.ts            # dry-run (default)
 *   npx ts-node apps/api/scripts/migrate-vehicle-asset-links.ts --apply    # create Asset + link
 *   npx ts-node apps/api/scripts/migrate-vehicle-asset-links.ts --tenant <tenantId>  # single tenant
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const tenantArg = (() => {
  const idx = process.argv.indexOf("--tenant");
  return idx >= 0 ? process.argv[idx + 1] : null;
})();

async function main() {
  const vehicles = await prisma.vehicle.findMany({
    where: {
      assetId: null,
      ...(tenantArg ? { tenantId: tenantArg } : {})
    },
    select: {
      id: true,
      tenantId: true,
      registrationNo: true,
      make: true,
      vehicleModel: true,
      year: true
    }
  });

  console.log(`Found ${vehicles.length} vehicle(s) without assetId${tenantArg ? ` (tenant: ${tenantArg})` : ""}`);
  if (vehicles.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  // Detect duplicate registrationNo per tenant (cannot safely auto-map)
  const regKey = (tenantId: string | null, reg: string) => `${tenantId ?? "null"}::${reg}`;
  const regCounts = new Map<string, number>();
  for (const v of vehicles) {
    const key = regKey(v.tenantId, v.registrationNo);
    regCounts.set(key, (regCounts.get(key) ?? 0) + 1);
  }

  let created = 0;
  let skipped = 0;
  let duplicates = 0;

  for (const v of vehicles) {
    if (!v.tenantId) {
      console.log(`  SKIP  ${v.registrationNo} — no tenantId (orphan record)`);
      skipped += 1;
      continue;
    }

    const isDuplicate = (regCounts.get(regKey(v.tenantId, v.registrationNo)) ?? 0) > 1;
    if (isDuplicate) {
      console.log(
        `  DUPE  ${v.registrationNo} (tenant ${v.tenantId}) — duplicate within tenant; manual resolution required`
      );
      duplicates += 1;
      continue;
    }

    const label = `${apply ? "CREATE" : "DRY-RUN"} asset for ${v.registrationNo} (${v.make} ${v.vehicleModel} ${v.year})`;
    console.log(`  ${label}`);

    if (apply) {
      const asset = await prisma.asset.create({
        data: {
          tenantId: v.tenantId,
          name: `${v.make} ${v.vehicleModel} (${v.registrationNo})`,
          category: "VEHICLE",
          status: "ACTIVE"
        } as any
      });

      await prisma.vehicle.update({
        where: { id: v.id },
        data: { assetId: asset.id }
      });

      created += 1;
    } else {
      created += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        candidatesWithoutAsset: vehicles.length,
        wouldCreateOrCreated: created,
        duplicateSkipped: duplicates,
        otherSkipped: skipped
      },
      null,
      2
    )
  );

  if (!apply && created > 0) {
    console.log("\nRun with --apply to create Asset records and link vehicles.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
