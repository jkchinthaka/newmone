import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import {
  WORK_ORDER_PART_CONSUMPTION_EVENT,
  WORK_ORDER_PART_RETURN_EVENT
} from "../work-orders/work-order-erp-consumption";

export const MISSING_ERP_PROVENANCE_MESSAGE =
  "Verified ERP stock is unavailable. Missing ERP provenance: a warehouse needs erpWarehouseCode and lastErpValidatedAt before stock can be issued.";

export const MISSING_ERP_SNAPSHOT_MESSAGE =
  "Verified ERP stock is unavailable. Missing verified ERP stock snapshot for this part.";

export function insufficientVerifiedStockMessage(available: number, requested: number) {
  return `Insufficient verified stock. Available: ${available}, Requested: ${requested}.`;
}

/** SparePart quantities are whole units. Fractional issue quantities are rejected. */
export function assertWholePositiveIssueQuantity(quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new BadRequestException("Stock-out quantity must be greater than 0");
  }
  if (!Number.isInteger(quantity)) {
    throw new BadRequestException("Stock quantity must be a whole number.");
  }
}

/**
 * Verified available = ERP on-hand snapshot
 *   minus warehouse reservations not yet issued
 *   minus PENDING consumption recorded after that snapshot
 *   plus validated returns recorded after that snapshot.
 * Consumption dated at or before the snapshot is already inside on-hand and is not subtracted again.
 * PENDING outbox status is not ERP confirmation.
 */
export function verifiedAvailableQuantity(input: {
  verifiedOnHand: number;
  reserved: number;
  unreconciledIssued: number;
  unreconciledReturned: number;
}) {
  return input.verifiedOnHand - input.reserved - input.unreconciledIssued + input.unreconciledReturned;
}

export function sumUnreconciledQuantities(input: {
  events: Array<{ eventType: string; payload: string; createdAt: Date }>;
  partId: string;
  verifiedAt: Date;
}) {
  let issued = 0;
  let returned = 0;
  for (const event of input.events) {
    if (event.createdAt.getTime() <= input.verifiedAt.getTime()) {
      continue;
    }
    let payload: { partId?: string; quantity?: number } = {};
    try {
      payload = JSON.parse(event.payload) as { partId?: string; quantity?: number };
    } catch {
      continue;
    }
    if (payload.partId !== input.partId) {
      continue;
    }
    const qty = Number(payload.quantity ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      continue;
    }
    if (event.eventType === WORK_ORDER_PART_CONSUMPTION_EVENT) {
      issued += qty;
    }
    if (event.eventType === WORK_ORDER_PART_RETURN_EVENT) {
      returned += qty;
    }
  }
  return { issued, returned };
}

type WarehouseRow = {
  id: string;
  erpWarehouseCode?: string | null;
  lastErpValidatedAt?: Date | null;
  isDefault?: boolean;
};

type BalanceRow = { id: string; onHand: number; reserved: number; available: number };

/**
 * Locks the verified warehouse balance when the client supports SQL Server row locks.
 * The caller must create the consumption outbox in the same transaction.
 * This function does not change SparePart.quantityInStock.
 */
export async function assertVerifiedIssueAllowed(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; partId: string; quantity: number; warehouseId?: string | null }
) {
  assertWholePositiveIssueQuantity(input.quantity);
  const warehouse = await selectVerifiedWarehouse(tx, input);
  if (!warehouse?.erpWarehouseCode || !warehouse.lastErpValidatedAt) {
    throw new BadRequestException(MISSING_ERP_PROVENANCE_MESSAGE);
  }

  const balance = await lockBalance(tx, input.tenantId, warehouse.id, input.partId);
  if (!balance) {
    throw new BadRequestException(MISSING_ERP_SNAPSHOT_MESSAGE);
  }

  const events = await tx.domainEventOutbox.findMany({
    where: {
      tenantId: input.tenantId,
      createdAt: { gt: warehouse.lastErpValidatedAt },
      eventType: { in: [WORK_ORDER_PART_CONSUMPTION_EVENT, WORK_ORDER_PART_RETURN_EVENT] }
    },
    select: { eventType: true, payload: true, createdAt: true }
  });
  const sums = sumUnreconciledQuantities({
    events,
    partId: input.partId,
    verifiedAt: warehouse.lastErpValidatedAt
  });
  const available = verifiedAvailableQuantity({
    verifiedOnHand: balance.onHand,
    reserved: balance.reserved,
    unreconciledIssued: sums.issued,
    unreconciledReturned: sums.returned
  });
  if (input.quantity > available) {
    throw new BadRequestException(insufficientVerifiedStockMessage(available, input.quantity));
  }
  return { available, warehouseId: warehouse.id, verifiedAt: warehouse.lastErpValidatedAt };
}

/** A part request is rejected only when a verified balance exists and the quantity is above it. */
export async function assertRequestWithinVerifiedStock(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; partId: string; quantity: number; warehouseId?: string | null }
) {
  try {
    return await assertVerifiedIssueAllowed(tx, input);
  } catch (error) {
    if (error instanceof BadRequestException) {
      const message = String(error.message);
      if (message === MISSING_ERP_PROVENANCE_MESSAGE || message === MISSING_ERP_SNAPSHOT_MESSAGE) {
        return null;
      }
    }
    throw error;
  }
}

async function selectVerifiedWarehouse(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; warehouseId?: string | null }
): Promise<WarehouseRow | null> {
  if (input.warehouseId) {
    return tx.warehouse.findFirst({
      where: { id: input.warehouseId, tenantId: input.tenantId, isActive: true }
    });
  }
  const rows = await tx.warehouse.findMany({
    where: {
      tenantId: input.tenantId,
      isActive: true,
      erpWarehouseCode: { not: null },
      lastErpValidatedAt: { not: null }
    },
    orderBy: [{ isDefault: "desc" }, { lastErpValidatedAt: "desc" }]
  });
  return rows[0] ?? null;
}

async function lockBalance(
  tx: Prisma.TransactionClient,
  tenantId: string,
  warehouseId: string,
  partId: string
): Promise<BalanceRow | null> {
  if (typeof tx.$queryRaw === "function") {
    try {
      const rows = await tx.$queryRaw<BalanceRow[]>`
        SELECT id, onHand, reserved, available
        FROM WarehouseItemBalance WITH (UPDLOCK, ROWLOCK)
        WHERE tenantId = ${tenantId} AND warehouseId = ${warehouseId} AND partId = ${partId}
      `;
      return rows[0] ?? null;
    } catch {
      // Unit mocks do not implement SQL Server table hints.
    }
  }
  return tx.warehouseItemBalance.findFirst({
    where: { tenantId, warehouseId, partId }
  });
}
