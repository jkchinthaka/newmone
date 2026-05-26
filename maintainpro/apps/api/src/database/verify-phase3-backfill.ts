import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";
import path from "node:path";

const prisma = new PrismaClient();
const TENANT_ID = "000000000000000000000000";
const SUPPLIER_NAME = "__phase3-fixture-supplier";
const PO_NUMBERS = ["__phase3-fixture-PO-LOW", "__phase3-fixture-PO-HIGH", "__phase3-fixture-PO-RECV"];

async function cleanup() {
  const suppliers = await prisma.supplier.findMany({ where: { name: SUPPLIER_NAME } });
  for (const supplier of suppliers) {
    const orders = await prisma.purchaseOrder.findMany({ where: { supplierId: supplier.id } });
    for (const o of orders) {
      await prisma.purchaseOrderApproval.deleteMany({ where: { purchaseOrderId: o.id } });
      await prisma.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: o.id } });
      await prisma.purchaseOrderErpSync.deleteMany({ where: { purchaseOrderId: o.id } });
    }
    await prisma.purchaseOrder.deleteMany({ where: { supplierId: supplier.id } });
    await prisma.supplier.delete({ where: { id: supplier.id } });
  }
  await prisma.purchaseOrder.deleteMany({ where: { poNumber: { in: PO_NUMBERS } } });
}

async function main() {
  await cleanup();

  const supplier = await prisma.supplier.create({
    data: { name: SUPPLIER_NAME, tenantId: TENANT_ID }
  });

  // Build legacy-style POs WITHOUT tenantId, approvals, workflowStatus override
  // (workflowStatus defaults to PENDING_OPERATIONAL via schema default in new fields).
  const low = await prisma.purchaseOrder.create({
    data: {
      poNumber: PO_NUMBERS[0],
      supplierId: supplier.id,
      orderDate: new Date(),
      totalAmount: 1000,
      status: "PENDING"
    }
  });
  const high = await prisma.purchaseOrder.create({
    data: {
      poNumber: PO_NUMBERS[1],
      supplierId: supplier.id,
      orderDate: new Date(),
      totalAmount: 7500,
      status: "PENDING"
    }
  });
  const received = await prisma.purchaseOrder.create({
    data: {
      poNumber: PO_NUMBERS[2],
      supplierId: supplier.id,
      orderDate: new Date(),
      totalAmount: 2000,
      status: "RECEIVED"
    }
  });

  // Force these fixtures to look legacy (no tenantId).
  await prisma.purchaseOrder.updateMany({
    where: { id: { in: [low.id, high.id, received.id] } },
    data: { tenantId: null }
  });

  console.log("[fixture] Created 3 legacy POs without tenantId. Running migration...\n");

  const migrationOutput = execSync("npx tsx src/database/migrate-phase3-procurement.ts", {
    cwd: path.resolve(__dirname, "../.."),
    encoding: "utf-8",
    stdio: "pipe"
  });
  console.log(migrationOutput);

  const verifyLow = await prisma.purchaseOrder.findUnique({
    where: { id: low.id },
    include: { approvals: { orderBy: { sequence: "asc" } } }
  });
  const verifyHigh = await prisma.purchaseOrder.findUnique({
    where: { id: high.id },
    include: { approvals: { orderBy: { sequence: "asc" } } }
  });
  const verifyReceived = await prisma.purchaseOrder.findUnique({
    where: { id: received.id },
    include: { approvals: { orderBy: { sequence: "asc" } } }
  });

  const report = {
    low: {
      tenantId: verifyLow?.tenantId,
      workflowStatus: verifyLow?.workflowStatus,
      requiresFinanceApproval: verifyLow?.requiresFinanceApproval,
      approvals: verifyLow?.approvals.map((a) => ({ stage: a.stage, status: a.status }))
    },
    high: {
      tenantId: verifyHigh?.tenantId,
      workflowStatus: verifyHigh?.workflowStatus,
      requiresFinanceApproval: verifyHigh?.requiresFinanceApproval,
      approvals: verifyHigh?.approvals.map((a) => ({ stage: a.stage, status: a.status }))
    },
    received: {
      tenantId: verifyReceived?.tenantId,
      workflowStatus: verifyReceived?.workflowStatus,
      requiresFinanceApproval: verifyReceived?.requiresFinanceApproval,
      approvals: verifyReceived?.approvals.map((a) => ({ stage: a.stage, status: a.status }))
    }
  };

  const assertions = {
    lowGotTenant: verifyLow?.tenantId === TENANT_ID,
    highGotTenant: verifyHigh?.tenantId === TENANT_ID,
    receivedGotTenant: verifyReceived?.tenantId === TENANT_ID,
    lowOperationalPending: verifyLow?.workflowStatus === "PENDING_OPERATIONAL",
    lowFinanceSkipped: verifyLow?.requiresFinanceApproval === false,
    highRequiresFinance: verifyHigh?.requiresFinanceApproval === true,
    receivedApproved: verifyReceived?.workflowStatus === "APPROVED",
    allHaveTwoApprovalRows:
      verifyLow?.approvals.length === 2 &&
      verifyHigh?.approvals.length === 2 &&
      verifyReceived?.approvals.length === 2
  };

  console.log("[verification report]");
  console.log(JSON.stringify(report, null, 2));
  console.log("\n[assertions]");
  console.log(JSON.stringify(assertions, null, 2));

  // Idempotency: run again, verify nothing changes
  console.log("\n[idempotency] Re-running migration...\n");
  const second = execSync("npx tsx src/database/migrate-phase3-procurement.ts", {
    cwd: path.resolve(__dirname, "../.."),
    encoding: "utf-8",
    stdio: "pipe"
  });
  console.log(second);

  const lowAfter = await prisma.purchaseOrder.findUnique({
    where: { id: low.id },
    include: { approvals: true }
  });
  const idempotent = lowAfter?.approvals.length === 2;
  console.log(`[idempotency] approvals still = 2: ${idempotent}`);

  await cleanup();
  console.log("\n[cleanup] Fixture POs and supplier deleted.");

  const allPassed = Object.values(assertions).every(Boolean) && idempotent;
  if (!allPassed) {
    process.exitCode = 1;
    console.error("\nFAILED one or more backfill assertions.");
  } else {
    console.log("\nAll Phase 3 backfill assertions PASSED.");
  }
}

main()
  .catch(async (error) => {
    console.error(error);
    await cleanup().catch(() => undefined);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
