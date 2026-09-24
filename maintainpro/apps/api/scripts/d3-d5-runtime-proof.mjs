/**
 * D3/D4/D5 SQL persistence proof — creates one temporary WO per domain, then cancels.
 */
import pkg from "@prisma/client";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ select: { id: true } });
  if (!tenant) {
    console.log("No tenant — skip create proof");
    return;
  }

  const actor = await prisma.user.findFirst({
    where: { tenantId: tenant.id },
    select: { id: true }
  });
  const asset = await prisma.asset.findFirst({
    where: { tenantId: tenant.id },
    select: { id: true }
  });
  const stamp = Date.now();
  let location = await prisma.functionalLocation.findFirst({
    where: { tenantId: tenant.id },
    select: { id: true }
  });
  let createdLocationId = null;
  if (!location) {
    const site = await prisma.site.findFirst({
      where: { tenantId: tenant.id },
      select: { id: true }
    });
    if (site && actor) {
      location = await prisma.functionalLocation.create({
        data: {
          tenantId: tenant.id,
          siteId: site.id,
          code: `LOC-PROOF-${stamp}`,
          name: "D4 Proof Location",
          type: "AREA",
          isActive: true
        },
        select: { id: true }
      });
      createdLocationId = location.id;
      console.log("Created temporary FunctionalLocation for SERVICE proof:", location.id);
    }
  }
  const vehicle = await prisma.vehicle.findFirst({
    where: { tenantId: tenant.id },
    select: { id: true, currentMileage: true }
  });

  const created = [];

  if (actor && asset) {
    const wo = await prisma.workOrder.create({
      data: {
        tenantId: tenant.id,
        woNumber: `D3-PROOF-${stamp}`,
        title: "D3 machinery proof",
        description: "Automated D3 proof — cancel after",
        priority: "MEDIUM",
        type: "CORRECTIVE",
        status: "OPEN",
        createdById: actor.id,
        assetId: asset.id,
        jobDomain: "MACHINERY",
        functionalTestResult: "PASS",
        productionImpact: "NONE"
      },
      select: {
        id: true,
        woNumber: true,
        jobDomain: true,
        assetId: true,
        functionalTestResult: true,
        productionImpact: true
      }
    });
    created.push(wo);
    console.log("MACHINERY proof WO:", JSON.stringify(wo));
  } else {
    console.log("MACHINERY skip — missing actor/asset");
  }

  if (actor && location) {
    const wo = await prisma.workOrder.create({
      data: {
        tenantId: tenant.id,
        woNumber: `D4-PROOF-${stamp}`,
        title: "D4 service proof",
        description: "[ELECTRICAL] Automated D4 proof — cancel after",
        priority: "MEDIUM",
        type: "CORRECTIVE",
        status: "OPEN",
        createdById: actor.id,
        functionalLocationId: location.id,
        jobDomain: "SERVICE",
        functionalTestResult: "PASS"
      },
      select: {
        id: true,
        woNumber: true,
        jobDomain: true,
        functionalLocationId: true,
        functionalTestResult: true
      }
    });
    created.push(wo);
    console.log("SERVICE proof WO:", JSON.stringify(wo));
  } else {
    console.log("SERVICE skip — missing actor/location");
  }

  if (actor && vehicle) {
    const reading = Number(vehicle.currentMileage ?? 0) + 1;
    const wo = await prisma.workOrder.create({
      data: {
        tenantId: tenant.id,
        woNumber: `D5-PROOF-${stamp}`,
        title: "D5 vehicle proof",
        description: "Automated D5 proof — cancel after",
        priority: "MEDIUM",
        type: "CORRECTIVE",
        status: "OPEN",
        createdById: actor.id,
        vehicleId: vehicle.id,
        jobDomain: "VEHICLE",
        completionMeterReading: reading,
        roadTestResult: "PASS",
        functionalTestResult: "PASS"
      },
      select: {
        id: true,
        woNumber: true,
        jobDomain: true,
        vehicleId: true,
        completionMeterReading: true,
        roadTestResult: true
      }
    });
    created.push(wo);
    console.log("VEHICLE proof WO:", JSON.stringify(wo));
  } else {
    console.log("VEHICLE skip — missing actor/vehicle");
  }

  for (const wo of created) {
    const row = await prisma.workOrder.findFirst({
      where: { id: wo.id },
      select: {
        woNumber: true,
        jobDomain: true,
        assetId: true,
        vehicleId: true,
        functionalLocationId: true,
        functionalTestResult: true,
        roadTestResult: true,
        completionMeterReading: true,
        productionImpact: true,
        status: true
      }
    });
    console.log("READBACK:", JSON.stringify(row));
    await prisma.workOrder.update({
      where: { id: wo.id },
      data: {
        status: "CANCELLED",
        cancelledReason: "D3-D5 automated proof cleanup"
      }
    });
  }
  console.log(`Cancelled ${created.length} proof work orders`);
  if (createdLocationId) {
    await prisma.functionalLocation.update({
      where: { id: createdLocationId },
      data: { isActive: false, name: "D4 Proof Location (inactive)" }
    });
    console.log("Deactivated temporary FunctionalLocation:", createdLocationId);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
