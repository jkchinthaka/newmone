import { MovementType, Prisma } from "@prisma/client";

import type { PrismaService } from "../../database/prisma.service";
import { InventoryTransactionEngine, type StockMutationResult } from "./inventory-transaction.engine";
import { MAINTAINPRO_STOCK_SOURCE, type VerifiedIssueCheck } from "./verified-stock-availability";

type Actor = { sub: string; tenantId?: string | null; email?: string; role?: string };

/**
 * Stores whose stock is owned by MaintainPro (goods-in recorded here): an issue to a job lowers
 * on-hand straight away and a confirmed return puts it back. ERP stores are untouched: they keep
 * recording PENDING consumption for Bileeta to reconcile.
 */
export async function applyOwnedStockIssue(
  tx: Prisma.TransactionClient,
  prisma: PrismaService,
  check: VerifiedIssueCheck | null | undefined,
  input: {
    actor: Actor;
    partId: string;
    quantity: number;
    workOrderId?: string;
    sourceType: string;
    sourceDocument?: string;
    idempotencyKey: string;
    notes?: string;
  }
): Promise<StockMutationResult | null> {
  if (!check || check.source !== "MAINTAINPRO") return null;
  return new InventoryTransactionEngine(prisma).issue(
    {
      actor: input.actor as never,
      partId: input.partId,
      quantity: input.quantity,
      warehouseId: check.warehouseId,
      workOrderId: input.workOrderId,
      sourceType: input.sourceType,
      sourceDocument: input.sourceDocument,
      idempotencyKey: input.idempotencyKey,
      notes: input.notes,
      ownedStock: true
    },
    tx
  );
}

/** Puts confirmed returns back into the MaintainPro store the part was issued from (if any). */
export async function applyOwnedStockReturn(
  tx: Prisma.TransactionClient,
  prisma: PrismaService,
  input: {
    actor: Actor;
    tenantId: string;
    partId: string;
    quantity: number;
    workOrderId?: string;
    idempotencyKey: string;
    notes?: string;
  }
): Promise<StockMutationResult | null> {
  const movements = (tx as { stockMovement?: { findFirst?: unknown } }).stockMovement;
  if (typeof movements?.findFirst !== "function") return null;
  const issued = await tx.stockMovement.findFirst({
    where: {
      tenantId: input.tenantId,
      partId: input.partId,
      ...(input.workOrderId ? { workOrderId: input.workOrderId } : {}),
      type: MovementType.OUT,
      warehouse: { stockSource: MAINTAINPRO_STOCK_SOURCE }
    },
    orderBy: { createdAt: "desc" },
    select: { warehouseId: true }
  });
  if (!issued?.warehouseId) return null;
  return new InventoryTransactionEngine(prisma).returnStock(
    {
      actor: input.actor as never,
      partId: input.partId,
      quantity: input.quantity,
      warehouseId: issued.warehouseId,
      workOrderId: input.workOrderId,
      sourceType: "WORK_ORDER_RETURN",
      idempotencyKey: input.idempotencyKey,
      notes: input.notes
    },
    tx
  );
}
