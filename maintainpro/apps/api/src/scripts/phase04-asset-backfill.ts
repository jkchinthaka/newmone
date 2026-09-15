/**
 * Idempotent dry-run-capable backfill for Phase 4 universal assets.
 *
 * Usage (from maintainpro/):
 *   npx ts-node --transpile-only apps/api/src/scripts/phase04-asset-backfill.ts --dry-run
 *   npx ts-node --transpile-only apps/api/src/scripts/phase04-asset-backfill.ts --apply
 */

import { PrismaClient } from "@prisma/client";

import {
  DEFAULT_ASSET_DOMAINS,
  DEFAULT_CATEGORY_EXAMPLES
} from "../modules/asset-taxonomy/domain-defaults";
import { mapLegacyAssetCategory } from "../modules/asset-taxonomy/legacy-category-map";

const prisma = new PrismaClient();

async function seedTaxonomyForTenant(tenantId: string) {
  let domainsCreated = 0;
  let categoriesCreated = 0;
  let typesCreated = 0;

  for (const domain of DEFAULT_ASSET_DOMAINS) {
    const existing = await prisma.assetDomain.findUnique({
      where: { tenantId_code: { tenantId, code: domain.code } }
    });
    if (existing) continue;
    await prisma.assetDomain.create({
      data: {
        tenantId,
        code: domain.code,
        name: domain.name,
        sortOrder: domain.sortOrder
      }
    });
    domainsCreated += 1;
  }

  for (const example of DEFAULT_CATEGORY_EXAMPLES) {
    const domain = await prisma.assetDomain.findUnique({
      where: { tenantId_code: { tenantId, code: example.domainCode } }
    });
    if (!domain) continue;
    let category = await prisma.assetCategoryMaster.findFirst({
      where: { tenantId, domainId: domain.id, code: example.code }
    });
    if (!category) {
      category = await prisma.assetCategoryMaster.create({
        data: {
          tenantId,
          domainId: domain.id,
          code: example.code,
          name: example.name,
          legacyEnum: (example.legacyEnum as never) ?? null
        }
      });
      categoriesCreated += 1;
    }
    for (const type of example.types ?? []) {
      const existingType = await prisma.assetTypeMaster.findFirst({
        where: { tenantId, categoryId: category.id, code: type.code }
      });
      if (existingType) continue;
      await prisma.assetTypeMaster.create({
        data: {
          tenantId,
          categoryId: category.id,
          code: type.code,
          name: type.name
        }
      });
      typesCreated += 1;
    }
  }

  return { domainsCreated, categoriesCreated, typesCreated };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  const tenantIdArg = process.argv.find((arg) => arg.startsWith("--tenant="))?.split("=")[1];

  const tenants = tenantIdArg
    ? await prisma.tenant.findMany({ where: { id: tenantIdArg } })
    : await prisma.tenant.findMany({ where: { isActive: true } });

  const summary: Array<Record<string, unknown>> = [];

  for (const tenant of tenants) {
    const seeded = await seedTaxonomyForTenant(tenant.id);
    const assets = await prisma.asset.findMany({
      where: {
        tenantId: tenant.id,
        OR: [{ domainId: null }, { categoryMasterId: null }]
      },
      select: {
        id: true,
        assetTag: true,
        category: true,
        location: true,
        siteId: true,
        functionalLocationId: true,
        domainId: true,
        categoryMasterId: true
      }
    });

    let mapped = 0;
    let ambiguous = 0;
    let failed = 0;
    let unresolvedLocation = 0;

    for (const asset of assets) {
      const mapping = mapLegacyAssetCategory(asset.category);
      const domain = await prisma.assetDomain.findUnique({
        where: { tenantId_code: { tenantId: tenant.id, code: mapping.domainCode } }
      });
      const category = domain
        ? await prisma.assetCategoryMaster.findFirst({
            where: { tenantId: tenant.id, domainId: domain.id, code: mapping.categoryCode }
          })
        : null;

      if (!domain || !category) {
        failed += 1;
        continue;
      }
      if (mapping.ambiguous) ambiguous += 1;

      if (!dryRun) {
        await prisma.asset.update({
          where: { id: asset.id },
          data: {
            domainId: asset.domainId ?? domain.id,
            categoryMasterId: asset.categoryMasterId ?? category.id
          }
        });
      }
      mapped += 1;

      if (asset.location?.trim() && (!asset.siteId || !asset.functionalLocationId)) {
        unresolvedLocation += 1;
      }
    }

    const vehiclesWithoutAsset = await prisma.vehicle.count({
      where: { tenantId: tenant.id, assetId: null }
    });

    summary.push({
      tenantId: tenant.id,
      tenantName: tenant.name,
      dryRun,
      seeded,
      mapped,
      ambiguous,
      failed,
      unresolvedLocation,
      vehiclesWithoutAsset
    });
  }

  console.log(JSON.stringify({ dryRun, tenants: summary }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
