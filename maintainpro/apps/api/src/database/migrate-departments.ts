import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildCanonicalDepartmentSeed,
  canonicalDepartmentName,
  createDepartmentCode,
  normalizeDepartmentName
} from "../modules/departments/department-master-list";

const prisma = new PrismaClient();

type TenantTarget = { id: string | null; label: string };
type TenantMigrationReport = {
  tenantId: string | null;
  tenant: string;
  created: number;
  reactivated: number;
  duplicatesDisabled: number;
  assetsMapped: number;
  unmatched: Array<{ name: string; count: number }>;
};

async function seedDepartments(tenantId: string | null) {
  const existingDepartments = await prisma.department.findMany({
    where: { tenantId },
    select: { id: true, name: true, code: true, createdAt: true }
  });
  const byName = new Map(existingDepartments.map((department) => [normalizeDepartmentName(department.name), department]));
  const usedCodes = new Set(existingDepartments.map((department) => department.code.toUpperCase()));
  let created = 0;
  let reactivated = 0;

  for (const department of buildCanonicalDepartmentSeed()) {
    const existing = byName.get(normalizeDepartmentName(department.name));
    if (existing) {
      await prisma.department.update({
        where: { id: existing.id },
        data: {
          name: department.name,
          code: existing.code || createDepartmentCode(department.name, usedCodes),
          isActive: true
        }
      });
      reactivated += 1;
      continue;
    }

    const code = createDepartmentCode(department.name, usedCodes);
    usedCodes.add(code);
    await prisma.department.create({
      data: {
        tenantId,
        name: department.name,
        code,
        isActive: true
      }
    });
    created += 1;
  }

  return { created, reactivated };
}

async function dedupeDepartments(tenantId: string | null) {
  const departments = await prisma.department.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, isActive: true }
  });
  const canonicalByName = new Map<string, string>();
  let deactivatedDuplicates = 0;

  for (const department of departments) {
    const normalized = normalizeDepartmentName(department.name);
    const canonicalId = canonicalByName.get(normalized);
    if (!canonicalId) {
      canonicalByName.set(normalized, department.id);
      continue;
    }

    await prisma.$transaction([
      prisma.asset.updateMany({ where: { tenantId, departmentId: department.id }, data: { departmentId: canonicalId } }),
      prisma.vehicle.updateMany({ where: { tenantId, departmentId: department.id }, data: { departmentId: canonicalId } }),
      prisma.user.updateMany({ where: { tenantId, departmentId: department.id }, data: { departmentId: canonicalId } }),
      prisma.driver.updateMany({ where: { tenantId, departmentId: department.id }, data: { departmentId: canonicalId } }),
      prisma.department.update({ where: { id: department.id }, data: { isActive: false } })
    ]);
    deactivatedDuplicates += 1;
  }

  return { deactivatedDuplicates };
}

async function mapLegacyAssetDepartments(tenantId: string | null) {
  const departments = await prisma.department.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true }
  });
  const departmentByName = new Map(departments.map((department) => [normalizeDepartmentName(department.name), department]));
  const assets = await prisma.asset.findMany({
    where: {
      tenantId,
      departmentId: null,
      department: { not: null }
    },
    select: { id: true, department: true }
  });
  const unmatched = new Map<string, number>();
  let mapped = 0;

  for (const asset of assets) {
    const legacyName = asset.department?.trim();
    if (!legacyName) continue;
    const canonicalName = canonicalDepartmentName(legacyName) ?? legacyName;
    const department = departmentByName.get(normalizeDepartmentName(canonicalName));

    if (!department) {
      unmatched.set(legacyName, (unmatched.get(legacyName) ?? 0) + 1);
      continue;
    }

    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        departmentId: department.id
      }
    });
    mapped += 1;
  }

  return { mapped, unmatched: Array.from(unmatched.entries()).map(([name, count]) => ({ name, count })) };
}

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true, name: true } });
  const targets: TenantTarget[] = tenants.map((tenant) => ({ id: tenant.id, label: tenant.slug || tenant.name || tenant.id }));
  const report: TenantMigrationReport[] = [];

  if (targets.length === 0) {
    targets.push({ id: null, label: "global" });
  }

  for (const target of targets) {
    const seeded = await seedDepartments(target.id);
    const deduped = await dedupeDepartments(target.id);
    const migrated = await mapLegacyAssetDepartments(target.id);

    console.log(
      `[departments] ${target.label}: created=${seeded.created}, reactivated=${seeded.reactivated}, duplicatesDisabled=${deduped.deactivatedDuplicates}, assetsMapped=${migrated.mapped}`
    );
    report.push({
      tenantId: target.id,
      tenant: target.label,
      created: seeded.created,
      reactivated: seeded.reactivated,
      duplicatesDisabled: deduped.deactivatedDuplicates,
      assetsMapped: migrated.mapped,
      unmatched: migrated.unmatched
    });

    if (migrated.unmatched.length > 0) {
      console.log(`[departments] ${target.label}: unmatched legacy asset departments:`);
      for (const item of migrated.unmatched) {
        console.log(`  - ${item.name}: ${item.count}`);
      }
    }
  }

  const reportPath = process.env.DEPARTMENT_MIGRATION_REPORT || path.resolve(process.cwd(), "scripts/data/department-migration-report.json");
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        tenants: report,
        unmatched: report.flatMap((tenant) => tenant.unmatched.map((item) => ({ tenant: tenant.tenant, tenantId: tenant.tenantId, ...item })))
      },
      null,
      2
    )
  );
  console.log(`[departments] migration report written to ${reportPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
