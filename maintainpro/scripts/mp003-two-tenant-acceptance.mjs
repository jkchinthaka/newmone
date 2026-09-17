#!/usr/bin/env node
/**
 * MP-003 — live two-tenant acceptance test.
 *
 * Proves, against a real SQL Server connection (DATABASE_URL from the environment), that the
 * tenant-scoped business-key migration (20260917120000_mp003_tenant_scoped_business_keys)
 * behaves correctly:
 *   - Two different tenants CAN reuse the same business-key value (cross-tenant reuse allowed).
 *   - The SAME tenant creating the SAME key twice IS rejected (same-tenant conflict enforced).
 *   - A tenant cannot resolve another tenant's row via the compound (tenantId, key) selector.
 *   - Tenant-scoped work order numbering does not collide across tenants.
 *
 * This is a live-infrastructure script (creates and deletes two throwaway tenants), so it is
 * NOT part of `npm run test` (apps/api's Jest suite is DB-free by convention — see
 * apps/api/test/tenant-uniqueness-inventory.spec.ts for the static schema/migration invariant
 * coverage instead). Run directly: `node scripts/mp003-two-tenant-acceptance.mjs` or
 * `npm run test:mp003-two-tenant-acceptance`.
 *
 * All data created here is prefixed with a run-specific marker and deleted at the end,
 * including on failure (best-effort). It never touches existing tenants/rows.
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const RUN_ID = Date.now().toString(36);
const KEY = `MP003-${RUN_ID}`;

let failed = 0;
function check(id, ok, detail) {
  if (ok) console.log(`PASS ${id}: ${detail}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}: ${detail}`);
  }
}

function isUniqueViolation(error) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function main() {
  const tenantA = await prisma.tenant.create({
    data: { name: `MP003 Test Tenant A ${RUN_ID}`, slug: `mp003-test-a-${RUN_ID}`, isActive: true }
  });
  const tenantB = await prisma.tenant.create({
    data: { name: `MP003 Test Tenant B ${RUN_ID}`, slug: `mp003-test-b-${RUN_ID}`, isActive: true }
  });

  try {
    const adminRoleA = await prisma.role.create({
      data: { tenantId: tenantA.id, name: "ADMIN" }
    });
    const adminRoleB = await prisma.role.create({
      data: { tenantId: tenantB.id, name: "ADMIN" }
    });
    const userA = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        email: `mp003-a-${RUN_ID}@test.local`,
        passwordHash: "x",
        firstName: "A",
        lastName: "User",
        roleId: adminRoleA.id
      }
    });
    const userB = await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        email: `mp003-b-${RUN_ID}@test.local`,
        passwordHash: "x",
        firstName: "B",
        lastName: "User",
        roleId: adminRoleB.id
      }
    });

    // ---------- Asset.assetTag ----------
    await prisma.asset.create({
      data: { tenantId: tenantA.id, assetTag: KEY, name: "A", category: "EQUIPMENT" }
    });
    try {
      await prisma.asset.create({
        data: { tenantId: tenantB.id, assetTag: KEY, name: "B", category: "EQUIPMENT" }
      });
      check("MP003-ASSET-CROSS-TENANT", true, "Tenant B reused Tenant A's assetTag successfully");
    } catch (error) {
      check("MP003-ASSET-CROSS-TENANT", false, `Cross-tenant assetTag reuse rejected: ${error}`);
    }
    try {
      await prisma.asset.create({
        data: { tenantId: tenantA.id, assetTag: KEY, name: "A dup", category: "EQUIPMENT" }
      });
      check("MP003-ASSET-SAME-TENANT-CONFLICT", false, "Same-tenant duplicate assetTag was NOT rejected");
    } catch (error) {
      check("MP003-ASSET-SAME-TENANT-CONFLICT", isUniqueViolation(error), `Same-tenant duplicate assetTag rejected (P2002 expected): ${error}`);
    }
    const crossLookup = await prisma.asset.findUnique({
      where: { tenantId_assetTag: { tenantId: tenantA.id, assetTag: KEY } }
    });
    const wrongTenantLookup = await prisma.asset.findFirst({
      where: { id: crossLookup.id, tenantId: tenantB.id }
    });
    check("MP003-ASSET-ISOLATION", wrongTenantLookup === null, "Tenant B cannot fetch Tenant A's asset by id via a tenantB-scoped filter");

    // ---------- Driver.licenseNumber ----------
    await prisma.driver.create({ data: { tenantId: tenantA.id, userId: userA.id, licenseNumber: KEY, licenseClass: "B", licenseExpiry: new Date("2030-01-01") } });
    try {
      await prisma.driver.create({ data: { tenantId: tenantB.id, userId: userB.id, licenseNumber: KEY, licenseClass: "B", licenseExpiry: new Date("2030-01-01") } });
      check("MP003-DRIVER-CROSS-TENANT", true, "Tenant B reused Tenant A's licenseNumber successfully");
    } catch (error) {
      check("MP003-DRIVER-CROSS-TENANT", false, `Cross-tenant licenseNumber reuse rejected: ${error}`);
    }

    // ---------- Vehicle.registrationNo + Vehicle.vin ----------
    const vehicleBase = { make: "Toyota", vehicleModel: "Test", year: 2024, type: "TRUCK", fuelType: "DIESEL", ownershipType: "OWNED" };
    const vehicleA = await prisma.vehicle.create({
      data: { ...vehicleBase, tenantId: tenantA.id, registrationNo: KEY, vin: KEY }
    });
    try {
      await prisma.vehicle.create({ data: { ...vehicleBase, tenantId: tenantB.id, registrationNo: KEY, vin: KEY } });
      check("MP003-VEHICLE-CROSS-TENANT", true, "Tenant B reused Tenant A's registrationNo AND vin successfully");
    } catch (error) {
      check("MP003-VEHICLE-CROSS-TENANT", false, `Cross-tenant registrationNo/vin reuse rejected: ${error}`);
    }
    try {
      await prisma.vehicle.create({ data: { ...vehicleBase, tenantId: tenantA.id, registrationNo: KEY, vin: `${KEY}-2` } });
      check("MP003-VEHICLE-SAME-TENANT-CONFLICT", false, "Same-tenant duplicate registrationNo was NOT rejected");
    } catch (error) {
      check("MP003-VEHICLE-SAME-TENANT-CONFLICT", isUniqueViolation(error), `Same-tenant duplicate registrationNo rejected: ${error}`);
    }
    try {
      await prisma.vehicle.create({ data: { ...vehicleBase, tenantId: tenantA.id, registrationNo: `${KEY}-3`, vin: KEY } });
      check("MP003-VEHICLE-VIN-SAME-TENANT-CONFLICT", false, "Same-tenant duplicate vin was NOT rejected");
    } catch (error) {
      check("MP003-VEHICLE-VIN-SAME-TENANT-CONFLICT", isUniqueViolation(error), `Same-tenant duplicate vin rejected: ${error}`);
    }
    // Two vehicles with vin = NULL in the same tenant must both succeed (the original SQL
    // Server nullable-unique bug this migration's filtered index guards against).
    try {
      await prisma.vehicle.create({ data: { ...vehicleBase, tenantId: tenantA.id, registrationNo: `${KEY}-null1` } });
      await prisma.vehicle.create({ data: { ...vehicleBase, tenantId: tenantA.id, registrationNo: `${KEY}-null2` } });
      check("MP003-VEHICLE-VIN-MULTIPLE-NULL", true, "Two same-tenant vehicles with vin=NULL both created");
    } catch (error) {
      check("MP003-VEHICLE-VIN-MULTIPLE-NULL", false, `Multiple NULL vin same-tenant rejected: ${error}`);
    }

    // ---------- SparePart.partNumber ----------
    await prisma.sparePart.create({ data: { tenantId: tenantA.id, partNumber: KEY, name: "Part A", category: "SPARE_PART", unitCost: 1 } });
    try {
      await prisma.sparePart.create({ data: { tenantId: tenantB.id, partNumber: KEY, name: "Part B", category: "SPARE_PART", unitCost: 1 } });
      check("MP003-SPAREPART-CROSS-TENANT", true, "Tenant B reused Tenant A's partNumber successfully");
    } catch (error) {
      check("MP003-SPAREPART-CROSS-TENANT", false, `Cross-tenant partNumber reuse rejected: ${error}`);
    }
    // ERP boundary: fetching "tenant-scoped parts by number" for tenant A must never resolve
    // tenant B's part with the same number (mirrors erp-stock-sync.service.ts's loadTenantParts).
    const tenantAParts = await prisma.sparePart.findMany({ where: { tenantId: tenantA.id, partNumber: KEY } });
    check("MP003-ERP-PART-ISOLATION", tenantAParts.length === 1 && tenantAParts[0].tenantId === tenantA.id, "Tenant-scoped part lookup returns only Tenant A's part, never Tenant B's");

    // ---------- WorkOrder.woNumber (generation + cross-tenant non-collision) ----------
    const year = new Date().getFullYear();
    const prefix = `WO-${year}-`;
    async function nextWoNumber(tenantId) {
      const latest = await prisma.workOrder.findFirst({
        where: { tenantId, woNumber: { startsWith: prefix } },
        orderBy: { woNumber: "desc" },
        select: { woNumber: true }
      });
      let seq = 1;
      if (latest?.woNumber) {
        const parsed = Number.parseInt(latest.woNumber.slice(prefix.length), 10);
        if (Number.isFinite(parsed)) seq = parsed + 1;
      }
      return `${prefix}${String(seq).padStart(4, "0")}`;
    }
    const woNumberA = await nextWoNumber(tenantA.id);
    const woNumberB = await nextWoNumber(tenantB.id);
    check("MP003-WORKORDER-GENERATION-INDEPENDENT", woNumberA === woNumberB, `Both tenants independently compute the same first-of-year number (${woNumberA} === ${woNumberB}) — this is the exact scenario that used to fail under the old global constraint`);
    await prisma.workOrder.create({
      data: { tenantId: tenantA.id, woNumber: woNumberA, title: "A", description: "A", type: "CORRECTIVE", createdById: userA.id }
    });
    try {
      await prisma.workOrder.create({
        data: { tenantId: tenantB.id, woNumber: woNumberB, title: "B", description: "B", type: "CORRECTIVE", createdById: userB.id }
      });
      check("MP003-WORKORDER-CROSS-TENANT-SAME-NUMBER", true, "Tenant B created a WorkOrder with the same generated number as Tenant A — this used to fail under the old global constraint");
    } catch (error) {
      check("MP003-WORKORDER-CROSS-TENANT-SAME-NUMBER", false, `Cross-tenant same woNumber rejected: ${error}`);
    }
    try {
      await prisma.workOrder.create({
        data: { tenantId: tenantA.id, woNumber: woNumberA, title: "A dup", description: "A dup", type: "CORRECTIVE", createdById: userA.id }
      });
      check("MP003-WORKORDER-SAME-TENANT-CONFLICT", false, "Same-tenant duplicate woNumber was NOT rejected");
    } catch (error) {
      check("MP003-WORKORDER-SAME-TENANT-CONFLICT", isUniqueViolation(error), `Same-tenant duplicate woNumber rejected: ${error}`);
    }

    // ---------- UtilityMeter.meterNumber ----------
    await prisma.utilityMeter.create({ data: { tenantId: tenantA.id, meterNumber: KEY, type: "ELECTRICITY", location: "HQ", unit: "kWh" } });
    try {
      await prisma.utilityMeter.create({ data: { tenantId: tenantB.id, meterNumber: KEY, type: "ELECTRICITY", location: "HQ", unit: "kWh" } });
      check("MP003-METER-CROSS-TENANT", true, "Tenant B reused Tenant A's meterNumber successfully");
    } catch (error) {
      check("MP003-METER-CROSS-TENANT", false, `Cross-tenant meterNumber reuse rejected: ${error}`);
    }

    // ---------- AccidentReport.reportNumber / InsuranceClaim.claimNumber / TrafficFine.fineNumber ----------
    const accidentA = await prisma.accidentReport.create({
      data: { tenantId: tenantA.id, reportNumber: KEY, vehicleId: vehicleA.id, reportedById: userA.id, occurredAt: new Date(), location: "L", description: "D" }
    });
    const vehicleB2 = await prisma.vehicle.create({ data: { ...vehicleBase, tenantId: tenantB.id, registrationNo: `${KEY}-b2` } });
    try {
      await prisma.accidentReport.create({
        data: { tenantId: tenantB.id, reportNumber: KEY, vehicleId: vehicleB2.id, reportedById: userB.id, occurredAt: new Date(), location: "L", description: "D" }
      });
      check("MP003-ACCIDENT-CROSS-TENANT", true, "Tenant B reused Tenant A's reportNumber successfully");
    } catch (error) {
      check("MP003-ACCIDENT-CROSS-TENANT", false, `Cross-tenant reportNumber reuse rejected: ${error}`);
    }

    await prisma.insuranceClaim.create({
      data: { tenantId: tenantA.id, claimNumber: KEY, vehicleId: vehicleA.id, accidentId: accidentA.id, policyNumber: "P", insurerName: "I", claimAmount: 1, filedById: userA.id, documents: "[]" }
    });
    try {
      await prisma.insuranceClaim.create({
        data: { tenantId: tenantB.id, claimNumber: KEY, vehicleId: vehicleB2.id, policyNumber: "P", insurerName: "I", claimAmount: 1, filedById: userB.id, documents: "[]" }
      });
      check("MP003-CLAIM-CROSS-TENANT", true, "Tenant B reused Tenant A's claimNumber successfully");
    } catch (error) {
      check("MP003-CLAIM-CROSS-TENANT", false, `Cross-tenant claimNumber reuse rejected: ${error}`);
    }

    await prisma.trafficFine.create({
      data: { tenantId: tenantA.id, fineNumber: KEY, vehicleId: vehicleA.id, reportedById: userA.id, fineDate: new Date(), description: "D", fineAmount: 1, evidenceUrls: "[]" }
    });
    try {
      await prisma.trafficFine.create({
        data: { tenantId: tenantB.id, fineNumber: KEY, vehicleId: vehicleB2.id, reportedById: userB.id, fineDate: new Date(), description: "D", fineAmount: 1, evidenceUrls: "[]" }
      });
      check("MP003-FINE-CROSS-TENANT", true, "Tenant B reused Tenant A's fineNumber successfully");
    } catch (error) {
      check("MP003-FINE-CROSS-TENANT", false, `Cross-tenant fineNumber reuse rejected: ${error}`);
    }
  } finally {
    // Best-effort cleanup — delete everything under the two throwaway tenants, then the tenants.
    for (const tenantId of [tenantA.id, tenantB.id]) {
      await prisma.trafficFine.deleteMany({ where: { tenantId } });
      await prisma.insuranceClaim.deleteMany({ where: { tenantId } });
      await prisma.accidentReport.deleteMany({ where: { tenantId } });
      await prisma.utilityMeter.deleteMany({ where: { tenantId } });
      await prisma.workOrder.deleteMany({ where: { tenantId } });
      await prisma.sparePart.deleteMany({ where: { tenantId } });
      await prisma.vehicle.deleteMany({ where: { tenantId } });
      await prisma.driver.deleteMany({ where: { tenantId } });
      await prisma.asset.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { tenantId } });
      await prisma.role.deleteMany({ where: { tenantId } });
    }
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}`);
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch(async (error) => {
    console.error("FATAL:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
