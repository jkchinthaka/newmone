import { POStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FINANCE_APPROVAL_THRESHOLD = Number(process.env.PHASE3_FINANCE_THRESHOLD ?? 5000);

type LegacyPurchaseOrder = {
  id: string;
  status: POStatus;
  totalAmount: number;
  tenantId?: string | null;
  supplier: {
    tenantId?: string | null;
  };
};

function resolveWorkflowStatus(order: LegacyPurchaseOrder): "PENDING_OPERATIONAL" | "APPROVED" {
  if (order.status === POStatus.ORDERED || order.status === POStatus.PARTIALLY_RECEIVED || order.status === POStatus.RECEIVED) {
    return "APPROVED";
  }

  return "PENDING_OPERATIONAL";
}

async function backfillPurchaseOrderTenantIds() {
  const legacyOrders = await prisma.purchaseOrder.findMany({
    where: {
      tenantId: null
    },
    include: {
      supplier: {
        select: {
          tenantId: true
        }
      }
    }
  });

  let tenantBackfilled = 0;

  for (const order of legacyOrders) {
    const supplierTenantId = order.supplier?.tenantId ?? null;
    if (!supplierTenantId) {
      continue;
    }

    await prisma.purchaseOrder.update({
      where: { id: order.id },
      data: {
        tenantId: supplierTenantId
      }
    });

    tenantBackfilled += 1;
  }

  return { scanned: legacyOrders.length, tenantBackfilled };
}

async function initializePurchaseApprovalRows() {
  const orders = await prisma.purchaseOrder.findMany({
    include: {
      supplier: {
        select: {
          tenantId: true
        }
      },
      approvals: {
        select: {
          id: true
        }
      }
    }
  });

  let approvalsInitialized = 0;

  for (const order of orders) {
    if (order.approvals.length > 0) {
      continue;
    }

    const requiresFinanceApproval = order.totalAmount >= FINANCE_APPROVAL_THRESHOLD;
    const workflowStatus = resolveWorkflowStatus(order);

    await prisma.purchaseOrder.update({
      where: { id: order.id },
      data: {
        requiresFinanceApproval,
        workflowStatus
      }
    });

    if (workflowStatus === "APPROVED") {
      await prisma.purchaseOrderApproval.createMany({
        data: [
          {
            tenantId: order.tenantId ?? order.supplier?.tenantId ?? null,
            purchaseOrderId: order.id,
            stage: "OPERATIONAL",
            sequence: 1,
            status: "APPROVED",
            reason: "Initialized from existing approved purchase order"
          },
          {
            tenantId: order.tenantId ?? order.supplier?.tenantId ?? null,
            purchaseOrderId: order.id,
            stage: "FINANCE",
            sequence: 2,
            status: requiresFinanceApproval ? "APPROVED" : "SKIPPED",
            reason: requiresFinanceApproval
              ? "Initialized from existing approved purchase order"
              : "Finance approval not required for initialized order"
          }
        ]
      });
    } else {
      await prisma.purchaseOrderApproval.createMany({
        data: [
          {
            tenantId: order.tenantId ?? order.supplier?.tenantId ?? null,
            purchaseOrderId: order.id,
            stage: "OPERATIONAL",
            sequence: 1,
            status: "PENDING"
          },
          {
            tenantId: order.tenantId ?? order.supplier?.tenantId ?? null,
            purchaseOrderId: order.id,
            stage: "FINANCE",
            sequence: 2,
            status: requiresFinanceApproval ? "PENDING" : "SKIPPED",
            reason: requiresFinanceApproval ? undefined : "Finance approval not required"
          }
        ]
      });
    }

    approvalsInitialized += 1;
  }

  return { scanned: orders.length, approvalsInitialized };
}

async function main() {
  const tenantBackfill = await backfillPurchaseOrderTenantIds();
  const approvalInit = await initializePurchaseApprovalRows();

  console.log(
    JSON.stringify(
      {
        financeApprovalThreshold: FINANCE_APPROVAL_THRESHOLD,
        tenantBackfill,
        approvalInit
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
