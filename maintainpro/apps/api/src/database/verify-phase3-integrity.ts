import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [
    supplierCount,
    sparePartCount,
    workOrderCount,
    purchaseOrderCount,
    purchaseOrderWithTenant,
    purchaseOrderApprovalCount,
    purchaseOrderLineCount,
    erpSyncCount,
    partRequestCount,
    purchaseOrdersWithoutApprovals,
    pendingOperational,
    pendingFinance,
    approvedCount,
    rejectedCount
  ] = await Promise.all([
    prisma.supplier.count(),
    prisma.sparePart.count(),
    prisma.workOrder.count(),
    prisma.purchaseOrder.count(),
    prisma.purchaseOrder.count({ where: { tenantId: { not: null } } }),
    prisma.purchaseOrderApproval.count(),
    prisma.purchaseOrderLine.count(),
    prisma.purchaseOrderErpSync.count(),
    prisma.partRequest.count(),
    prisma.purchaseOrder.findMany({
      where: { approvals: { none: {} } },
      select: { id: true, poNumber: true, status: true, totalAmount: true, tenantId: true }
    }),
    prisma.purchaseOrder.count({ where: { workflowStatus: "PENDING_OPERATIONAL" } }),
    prisma.purchaseOrder.count({ where: { workflowStatus: "PENDING_FINANCE" } }),
    prisma.purchaseOrder.count({ where: { workflowStatus: "APPROVED" } }),
    prisma.purchaseOrder.count({ where: { workflowStatus: "REJECTED" } })
  ]);

  console.log(
    JSON.stringify(
      {
        counts: {
          suppliers: supplierCount,
          spareParts: sparePartCount,
          workOrders: workOrderCount,
          purchaseOrders: purchaseOrderCount,
          purchaseOrdersWithTenantId: purchaseOrderWithTenant,
          purchaseOrderApprovals: purchaseOrderApprovalCount,
          purchaseOrderLines: purchaseOrderLineCount,
          purchaseOrderErpSyncAttempts: erpSyncCount,
          partRequests: partRequestCount
        },
        workflowStatusBreakdown: {
          pendingOperational,
          pendingFinance,
          approved: approvedCount,
          rejected: rejectedCount
        },
        purchaseOrdersMissingApprovals: purchaseOrdersWithoutApprovals,
        integrityChecks: {
          allPurchaseOrdersHaveTenantContext:
            purchaseOrderCount === 0 || purchaseOrderWithTenant === purchaseOrderCount,
          allPurchaseOrdersHaveApprovalRows:
            purchaseOrderCount === 0 || purchaseOrdersWithoutApprovals.length === 0
        }
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
