/**
 * Phase 15A — disposable SQL data-plane smoke (no HTTP auth dependency).
 * Uses Prisma against MaintainProDev. Does not mutate Mongo.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function pass(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function main() {
  let failures = 0;
  const tenant = await prisma.tenant.findFirst();
  if (!pass("1. Tenant present", !!tenant, tenant?.name ?? "")) failures++;

  const users = await prisma.user.findMany({
    include: { role: { include: { permissionLinks: { include: { permission: true } } } } }
  });
  if (!pass("2. Users loaded", users.length >= 2, `count=${users.length}`)) failures++;
  const withPerms = users.filter((u) => (u.role?.permissionLinks?.length ?? 0) > 0);
  if (!pass("3. RBAC RolePermission junction", withPerms.length >= 1, `usersWithPerms=${withPerms.length}`))
    failures++;

  const assetsCi = await prisma.asset.findMany({
    where: { OR: [{ assetTag: { contains: "ast" } }, { assetTag: { contains: "AST" } }] }
  });
  if (!pass("4. Asset list + CI search", assetsCi.length >= 1, assetsCi[0]?.assetTag)) failures++;

  const asset = await prisma.asset.findFirst({
    include: { site: true, functionalLocation: true, domain: true }
  });
  if (
    !pass(
      "5. Asset detail + taxonomy/site/FL",
      !!(asset && asset.siteId && asset.functionalLocationId),
      asset?.id
    )
  )
    failures++;

  const req = await prisma.maintenanceRequest.findFirst();
  const wo = await prisma.workOrder.findFirst({
    include: { asset: true, statusHistory: true }
  });
  if (!pass("6. Request present", !!req, req?.requestNumber ?? "")) failures++;
  if (!pass("7. Request→WO link", !!(req?.workOrderId && wo && req.workOrderId === wo.id))) failures++;
  if (!pass("8. WO asset FK", !!wo?.asset)) failures++;
  if (!pass("9. WO status history", (wo?.statusHistory?.length ?? 0) >= 1)) failures++;

  const pm = await prisma.pmPlan.findFirst();
  if (!pass("10. PM plan", !!pm, pm?.code ?? "")) failures++;

  const meter = await prisma.assetMeter.findFirst();
  if (!pass("11. Meter", !!meter, meter?.meterType ?? "")) failures++;

  const cost = await prisma.workOrderCostSnapshot.findFirst();
  const costOk = cost && Number(cost.totalCost) === 175.25 && Number(cost.partsCost) === 10.5;
  if (!pass("12. Cost snapshot precision", !!costOk, cost ? String(cost.totalCost) : "missing")) failures++;

  const vehicle = await prisma.vehicle.findFirst();
  if (!pass("13. Fleet vehicle→asset", !!(vehicle?.assetId), vehicle?.registrationNo ?? "")) failures++;

  const vendor = await prisma.vendorContract.findFirst();
  const vAssets = await prisma.vendorContractAsset.count();
  const vSites = await prisma.vendorContractSite.count();
  if (!pass("14. Vendor contract + junctions", !!(vendor && vAssets >= 1 && vSites >= 1))) failures++;

  const audit = await prisma.auditLog.findFirst({ where: { entity: { not: "Phase15A" } } });
  if (!pass("15. Audit entity reference", !!audit?.entityId, audit?.entity)) failures++;

  const emailCi = await prisma.user.count({ where: { email: { contains: "ADMIN" } } });
  if (!pass("16. Email CI search (collation)", emailCi >= 1, `hits=${emailCi}`)) failures++;

  const rp = await prisma.rolePermission.count();
  const skills = await prisma.userSkill.count();
  if (!pass("17. Junction counts stable", rp === 3 && skills === 3, `rp=${rp} skills=${skills}`)) failures++;

  console.log(`\n[smoke-sql] failures=${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
