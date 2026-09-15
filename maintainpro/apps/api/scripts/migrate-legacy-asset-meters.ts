/**
 * Dry-run by default: backfill AssetMeter RUNNING_HOURS from legacy Asset.meterReading.
 * Idempotent: skips assets that already have an active RUNNING_HOURS meter.
 *
 * Usage (from maintainpro/):
 *   npx ts-node apps/api/scripts/migrate-legacy-asset-meters.ts --dry-run
 *   npx ts-node apps/api/scripts/migrate-legacy-asset-meters.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const assets = await prisma.asset.findMany({
    where: {
      meterReading: { not: null },
      isActive: true
    },
    select: {
      id: true,
      tenantId: true,
      assetTag: true,
      meterReading: true,
      name: true
    }
  });

  let created = 0;
  let skipped = 0;

  for (const asset of assets) {
    if (!asset.tenantId || asset.meterReading == null) {
      skipped += 1;
      continue;
    }

    const existing = await prisma.assetMeter.findFirst({
      where: {
        tenantId: asset.tenantId,
        assetId: asset.id,
        meterType: "RUNNING_HOURS",
        isActive: true
      }
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    console.log(
      `${apply ? "CREATE" : "DRY-RUN"} meter for ${asset.assetTag} value=${asset.meterReading}`
    );

    if (apply) {
      await prisma.assetMeter.create({
        data: {
          tenantId: asset.tenantId,
          assetId: asset.id,
          meterType: "RUNNING_HOURS",
          name: "Runtime Hours (legacy backfill)",
          unit: "hours",
          currentValue: asset.meterReading,
          lastReadingAt: new Date(),
          staleAfterDays: 30
        }
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
        candidates: assets.length,
        wouldCreateOrCreated: created,
        skipped
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
