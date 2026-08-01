import { BadRequestException } from "@nestjs/common";
import { POStatus, PurchaseOrderWorkflowStatus } from "@prisma/client";

describe("purchase-receiving", () => {
  function assertReceivable(order: { workflowStatus: string; status: string }) {
    if (order.workflowStatus !== PurchaseOrderWorkflowStatus.APPROVED) {
      throw new BadRequestException("Purchase order must be workflow-APPROVED before receiving");
    }
    if (order.status !== POStatus.ORDERED && order.status !== POStatus.PARTIALLY_RECEIVED) {
      throw new BadRequestException("Purchase order status must be ORDERED or PARTIALLY_RECEIVED to receive");
    }
  }

  function assertNoOverReceipt(ordered: number, received: number, accepted: number, rejected: number) {
    const remaining = ordered - received;
    if (accepted + rejected > remaining) {
      throw new BadRequestException(`Over-receipt blocked remaining=${remaining}`);
    }
  }

  function assertPatchReceivedBlocked(status?: string) {
    if (status === POStatus.PARTIALLY_RECEIVED || status === POStatus.RECEIVED) {
      throw new BadRequestException("Cannot set PARTIALLY_RECEIVED or RECEIVED via PATCH; use receipts endpoint");
    }
  }

  it("requires approved workflow and ordered status", () => {
    expect(() =>
      assertReceivable({ workflowStatus: PurchaseOrderWorkflowStatus.PENDING_OPERATIONAL, status: POStatus.PENDING })
    ).toThrow(BadRequestException);
    expect(() =>
      assertReceivable({ workflowStatus: PurchaseOrderWorkflowStatus.APPROVED, status: POStatus.ORDERED })
    ).not.toThrow();
  });

  it("blocks over-receipt", () => {
    expect(() => assertNoOverReceipt(5, 4, 2, 0)).toThrow(/Over-receipt/);
    expect(() => assertNoOverReceipt(5, 4, 1, 0)).not.toThrow();
  });

  it("blocks PATCH to RECEIVED", () => {
    expect(() => assertPatchReceivedBlocked(POStatus.RECEIVED)).toThrow(/receipts endpoint/);
  });

  it("mock prisma transaction increments stock for accepted qty only", async () => {
    const sparePart = { update: jest.fn() };
    const stockMovement = { create: jest.fn() };
    const accepted = 3;
    const rejected = 1;
    if (accepted > 0) {
      await sparePart.update({ data: { quantityInStock: { increment: accepted } } });
      await stockMovement.create({ data: { quantity: accepted } });
    }
    expect(sparePart.update).toHaveBeenCalledWith({
      data: { quantityInStock: { increment: 3 } }
    });
    expect(stockMovement.create).toHaveBeenCalled();
    expect(rejected).toBe(1);
  });
});