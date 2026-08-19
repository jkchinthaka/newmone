import { randomUUID } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, MovementType, Prisma } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { PrismaService } from "../../database/prisma.service";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import type { JwtPayload } from "../auth/auth.types";
import { canPartReserve, canReverseMovement } from "../policies/inventory-policies";
import { assertPolicy, PolicyDeniedException } from "../policies/policy-decision";
import {
  applyAdjustOut,
  applyIssueFromAvailable,
  applyIssueFromReserved,
  applyReceive,
  applyRelease,
  applyReserve,
  applyReturn,
  assertPositiveQuantity,
  DEFAULT_WAREHOUSE_CODE,
  DEFAULT_WAREHOUSE_NAME,
  deriveAvailable,
  hashIdempotencyPayload,
  normalizeStockQuantities,
  type StockQuantities
} from "./inventory-invariants";

type Actor = Pick<JwtPayload, "sub" | "tenantId"> & Partial<Pick<JwtPayload, "email" | "role">>;
type DbClient = Prisma.TransactionClient | PrismaService;

export type StockMutationResult = {
  part: {
    id: string;
    quantityInStock: number;
    reservedQuantity: number;
    availableQuantity: number;
  };
  warehouseId: string;
  movement: { id: string; type: MovementType; quantity: number };
  pairedMovement?: { id: string; type: MovementType; quantity: number };
  replayed: boolean;
};

export type StockOpInput = {
  actor?: Actor;
  partId: string;
  quantity: number;
  warehouseId?: string;
  warehouseCode?: string;
  destWarehouseId?: string;
  destWarehouseCode?: string;
  workOrderId?: string;
  vehicleId?: string;
  notes?: string;
  reason?: string;
  idempotencyKey?: string;
  sourceType?: string;
  sourceDocument?: string;
  sourceLineKey?: string;
  importRunId?: string;
  consumeReservation?: boolean;
  reversalOfMovementId?: string;
};

@Injectable()
export class InventoryTransactionEngine {
  constructor(private readonly prisma: PrismaService) {}

  async receive(input: StockOpInput, existingTx?: Prisma.TransactionClient): Promise<StockMutationResult> {
    return this.runOp("receive", MovementType.IN, input, existingTx, (qty, amount) => applyReceive(qty, amount), {
      onHand: "increment",
      available: "increment"
    });
  }

  async reserve(input: StockOpInput, existingTx?: Prisma.TransactionClient): Promise<StockMutationResult> {
    return this.runOp("reserve", undefined, input, existingTx, (qty, amount) => applyReserve(qty, amount), {
      reserved: "increment",
      available: "decrement"
    });
  }

  async releaseReservation(input: StockOpInput, existingTx?: Prisma.TransactionClient): Promise<StockMutationResult> {
    return this.runOp("releaseReservation", undefined, input, existingTx, (qty, amount) => applyRelease(qty, amount), {
      reserved: "decrement",
      available: "increment"
    });
  }

  async issue(input: StockOpInput, existingTx?: Prisma.TransactionClient): Promise<StockMutationResult> {
    if (input.consumeReservation) {
      return this.runOp("issueReserved", MovementType.OUT, input, existingTx, (qty, amount) => applyIssueFromReserved(qty, amount), {
        onHand: "decrement",
        reserved: "decrement"
      });
    }
    return this.runOp("issue", MovementType.OUT, input, existingTx, (qty, amount) => applyIssueFromAvailable(qty, amount), {
      onHand: "decrement",
      available: "decrement"
    });
  }

  async returnStock(input: StockOpInput, existingTx?: Prisma.TransactionClient): Promise<StockMutationResult> {
    return this.runOp("returnStock", MovementType.RETURN, input, existingTx, (qty, amount) => applyReturn(qty, amount), {
      onHand: "increment",
      available: "increment"
    });
  }

  async adjust(input: StockOpInput & { direction: "IN" | "OUT" }, existingTx?: Prisma.TransactionClient): Promise<StockMutationResult> {
    if (input.direction === "IN") {
      return this.runOp("adjustIn", MovementType.ADJUSTMENT_IN, input, existingTx, (qty, amount) => applyReceive(qty, amount), {
        onHand: "increment",
        available: "increment"
      });
    }
    return this.runOp("adjustOut", MovementType.ADJUSTMENT_OUT, input, existingTx, (qty, amount) => applyAdjustOut(qty, amount), {
      onHand: "decrement",
      available: "decrement"
    });
  }

  async transfer(input: StockOpInput, existingTx?: Prisma.TransactionClient): Promise<StockMutationResult> {
    this.assertActor(input.actor);
    assertPositiveQuantity(input.quantity, "Transfer quantity");
    const tenantId = requireTenantId(input.actor?.tenantId);
    const work = async (tx: Prisma.TransactionClient) => {
      const replay = await this.beginIdempotency(tx, tenantId, "transfer", input);
      if (replay) {
        return replay;
      }

      const sourceWarehouse = await this.resolveWarehouse(tx, tenantId, input.warehouseId, input.warehouseCode);
      const destWarehouse = await this.resolveWarehouse(tx, tenantId, input.destWarehouseId, input.destWarehouseCode);
      if (sourceWarehouse.id === destWarehouse.id) {
        throw new BadRequestException("Transfer source and destination warehouses must differ");
      }

      const part = await this.loadActivePart(tx, tenantId, input.partId);
      await this.ensureBalances(tx, tenantId, part.id, [sourceWarehouse.id, destWarehouse.id], part);

      const sourceBefore = await this.loadBalance(tx, tenantId, sourceWarehouse.id, part.id);
      try {
        applyIssueFromAvailable(sourceBefore, input.quantity);
      } catch (error) {
        throw new PolicyDeniedException(
          canPartReserve({
            tenantId,
            itemActive: true,
            warehouseValid: true,
            quantity: input.quantity,
            available: sourceBefore.available,
            onHand: sourceBefore.onHand,
            reserved: sourceBefore.reserved
          })
        );
      }

      const sourceUpdated = await this.conditionalBalanceUpdate(tx, {
        tenantId,
        warehouseId: sourceWarehouse.id,
        partId: part.id,
        whereAvailableGte: input.quantity,
        whereOnHandGte: input.quantity,
        onHandDelta: -input.quantity,
        availableDelta: -input.quantity
      });
      if (!sourceUpdated) {
        throw new BadRequestException("Insufficient available stock at source warehouse");
      }

      const destUpdated = await this.conditionalBalanceUpdate(tx, {
        tenantId,
        warehouseId: destWarehouse.id,
        partId: part.id,
        onHandDelta: input.quantity,
        availableDelta: input.quantity
      });
      if (!destUpdated) {
        throw new BadRequestException("Transfer destination update failed");
      }

      await this.syncPartFromBalances(tx, tenantId, part.id);

      const transferGroupId = randomUUID();
      const outMovement = await this.createMovement(tx, {
        tenantId,
        partId: part.id,
        warehouseId: sourceWarehouse.id,
        type: MovementType.TRANSFER_OUT,
        quantity: input.quantity,
        actorUserId: input.actor?.sub,
        workOrderId: input.workOrderId,
        vehicleId: input.vehicleId,
        notes: input.notes ?? input.reason,
        sourceType: input.sourceType ?? "TRANSFER",
        sourceDocument: input.sourceDocument,
        sourceLineKey: input.sourceLineKey,
        importRunId: input.importRunId,
        transferGroupId,
        reference: `transfer:${transferGroupId}`
      });
      const inMovement = await this.createMovement(tx, {
        tenantId,
        partId: part.id,
        warehouseId: destWarehouse.id,
        type: MovementType.TRANSFER_IN,
        quantity: input.quantity,
        actorUserId: input.actor?.sub,
        workOrderId: input.workOrderId,
        vehicleId: input.vehicleId,
        notes: input.notes ?? input.reason,
        sourceType: input.sourceType ?? "TRANSFER",
        sourceDocument: input.sourceDocument,
        sourceLineKey: input.sourceLineKey ? `${input.sourceLineKey}:IN` : undefined,
        importRunId: input.importRunId,
        transferGroupId,
        reference: `transfer:${transferGroupId}`
      });

      const partAfter = await this.loadActivePart(tx, tenantId, part.id);
      const result: StockMutationResult = {
        part: {
          id: partAfter.id,
          quantityInStock: partAfter.quantityInStock,
          reservedQuantity: partAfter.reservedQuantity,
          availableQuantity: partAfter.availableQuantity
        },
        warehouseId: destWarehouse.id,
        movement: { id: outMovement.id, type: outMovement.type, quantity: outMovement.quantity },
        pairedMovement: { id: inMovement.id, type: inMovement.type, quantity: inMovement.quantity },
        replayed: false
      };

      await this.commitIdempotency(tx, tenantId, "transfer", input, result, outMovement.id, transferGroupId);
      await this.recordAudit(tx, {
        actor: input.actor,
        entityId: part.id,
        action: AuditAction.UPDATE,
        reason: input.reason ?? input.notes,
        metadata: {
          event: "inventory_transfer",
          quantity: input.quantity,
          sourceWarehouseId: sourceWarehouse.id,
          destWarehouseId: destWarehouse.id,
          transferGroupId,
          outMovementId: outMovement.id,
          inMovementId: inMovement.id
        }
      });
      return result;
    };

    if (existingTx) {
      return work(existingTx);
    }
    return this.prisma.$transaction((tx) => work(tx));
  }

  async reverse(input: StockOpInput, existingTx?: Prisma.TransactionClient): Promise<StockMutationResult> {
    this.assertActor(input.actor);
    if (!input.reversalOfMovementId?.trim()) {
      throw new BadRequestException("Original movement id is required for reversal");
    }
    if (!input.reason?.trim()) {
      throw new BadRequestException("Reversal reason is required");
    }
    const tenantId = requireTenantId(input.actor?.tenantId);

    const work = async (tx: Prisma.TransactionClient) => {
      const replay = await this.beginIdempotency(tx, tenantId, "reverse", input);
      if (replay) {
        return replay;
      }

      const original = await tx.stockMovement.findFirst({
        where: { id: input.reversalOfMovementId, tenantId }
      });
      if (!original) {
        throw new NotFoundException("Original stock movement not found");
      }
      assertPolicy(
        canReverseMovement({
          tenantId,
          originalMovementId: original.id,
          alreadyReversed: (original.quantityReversed ?? 0) >= original.quantity
        })
      );
      if (original.type === MovementType.REVERSAL) {
        throw new BadRequestException("Cannot reverse a reversal movement");
      }
      if (original.partId !== input.partId && input.partId) {
        throw new BadRequestException("Reversal item must match the original movement");
      }
      if (original.warehouseId && input.warehouseId && original.warehouseId !== input.warehouseId) {
        throw new BadRequestException("Reversal warehouse must match the original movement");
      }

      const remaining = original.quantity - (original.quantityReversed ?? 0);
      const reverseQty = input.quantity || remaining;
      assertPositiveQuantity(reverseQty, "Reversal quantity");
      if (reverseQty > remaining) {
        throw new BadRequestException("Reversal quantity cannot exceed remaining reversible amount");
      }

      const warehouse = await this.resolveWarehouse(tx, tenantId, original.warehouseId ?? input.warehouseId, input.warehouseCode);
      const part = await this.loadActivePart(tx, tenantId, original.partId);
      await this.ensureBalances(tx, tenantId, part.id, [warehouse.id], part);

      const inboundOriginal = this.isInbound(original.type);
      if (inboundOriginal) {
        const ok = await this.conditionalBalanceUpdate(tx, {
          tenantId,
          warehouseId: warehouse.id,
          partId: part.id,
          whereAvailableGte: reverseQty,
          whereOnHandGte: reverseQty,
          onHandDelta: -reverseQty,
          availableDelta: -reverseQty
        });
        if (!ok) {
          throw new BadRequestException("Cannot reverse inbound movement: insufficient available stock");
        }
      } else {
        const ok = await this.conditionalBalanceUpdate(tx, {
          tenantId,
          warehouseId: warehouse.id,
          partId: part.id,
          onHandDelta: reverseQty,
          availableDelta: reverseQty
        });
        if (!ok) {
          throw new BadRequestException("Reversal restock failed");
        }
      }

      const marked = await tx.stockMovement.updateMany({
        where: {
          id: original.id,
          tenantId,
          quantityReversed: original.quantityReversed ?? 0
        },
        data: {
          quantityReversed: { increment: reverseQty }
        }
      });
      if (marked.count !== 1) {
        throw new BadRequestException("Original movement was reversed concurrently");
      }

      await this.syncPartFromBalances(tx, tenantId, part.id);
      const reversal = await this.createMovement(tx, {
        tenantId,
        partId: part.id,
        warehouseId: warehouse.id,
        type: MovementType.REVERSAL,
        quantity: reverseQty,
        actorUserId: input.actor?.sub,
        workOrderId: original.workOrderId ?? input.workOrderId,
        vehicleId: original.vehicleId ?? input.vehicleId,
        notes: input.reason,
        sourceType: input.sourceType ?? "REVERSAL",
        sourceDocument: original.sourceDocument ?? original.reference,
        sourceLineKey: input.sourceLineKey ?? (original.sourceLineKey ? `${original.sourceLineKey}:REV` : undefined),
        importRunId: original.importRunId ?? input.importRunId,
        reversalOfMovementId: original.id,
        reference: `reversal:${original.id}`
      });

      const partAfter = await this.loadActivePart(tx, tenantId, part.id);
      const result: StockMutationResult = {
        part: {
          id: partAfter.id,
          quantityInStock: partAfter.quantityInStock,
          reservedQuantity: partAfter.reservedQuantity,
          availableQuantity: partAfter.availableQuantity
        },
        warehouseId: warehouse.id,
        movement: { id: reversal.id, type: reversal.type, quantity: reversal.quantity },
        replayed: false
      };
      await this.commitIdempotency(tx, tenantId, "reverse", input, result, reversal.id);
      await this.recordAudit(tx, {
        actor: input.actor,
        entityId: part.id,
        action: AuditAction.UPDATE,
        reason: input.reason,
        metadata: {
          event: "inventory_reversal",
          originalMovementId: original.id,
          reversalMovementId: reversal.id,
          quantity: reverseQty
        }
      });
      return result;
    };

    if (existingTx) {
      return work(existingTx);
    }
    return this.prisma.$transaction((tx) => work(tx));
  }

  private async runOp(
    operation: string,
    movementType: MovementType | undefined,
    input: StockOpInput,
    existingTx: Prisma.TransactionClient | undefined,
    preview: (qty: StockQuantities, amount: number) => StockQuantities,
    deltas: { onHand?: "increment" | "decrement"; reserved?: "increment" | "decrement"; available?: "increment" | "decrement" }
  ): Promise<StockMutationResult> {
    this.assertActor(input.actor);
    assertPositiveQuantity(input.quantity, "Quantity");
    const tenantId = requireTenantId(input.actor?.tenantId);

    const work = async (tx: Prisma.TransactionClient) => {
      const replay = await this.beginIdempotency(tx, tenantId, operation, input);
      if (replay) {
        return replay;
      }

      const warehouse = await this.resolveWarehouse(tx, tenantId, input.warehouseId, input.warehouseCode);
      const part = await this.loadActivePart(tx, tenantId, input.partId);
      await this.ensureBalances(tx, tenantId, part.id, [warehouse.id], part);
      const before = await this.loadBalance(tx, tenantId, warehouse.id, part.id);
      try {
        preview(before, input.quantity);
      } catch (error) {
        const decision = canPartReserve({
          tenantId,
          itemActive: true,
          warehouseValid: true,
          quantity: input.quantity,
          available: before.available,
          onHand: before.onHand,
          reserved: before.reserved
        });
        if (!decision.allowed) {
          throw new PolicyDeniedException(decision);
        }
        throw new BadRequestException(error instanceof Error ? error.message : "Inventory mutation rejected");
      }

      const onHandDelta = this.deltaValue(deltas.onHand, input.quantity);
      const reservedDelta = this.deltaValue(deltas.reserved, input.quantity);
      const availableDelta = this.deltaValue(deltas.available, input.quantity);

      const ok = await this.conditionalBalanceUpdate(tx, {
        tenantId,
        warehouseId: warehouse.id,
        partId: part.id,
        whereOnHandGte: onHandDelta < 0 ? Math.abs(onHandDelta) : undefined,
        whereReservedGte: reservedDelta < 0 ? Math.abs(reservedDelta) : undefined,
        whereAvailableGte: availableDelta < 0 ? Math.abs(availableDelta) : undefined,
        onHandDelta,
        reservedDelta,
        availableDelta
      });
      if (!ok) {
        throw new BadRequestException(
          availableDelta < 0 || onHandDelta < 0
            ? "Stock quantity cannot go below 0"
            : "Inventory quantity update failed"
        );
      }

      await this.syncPartFromBalances(tx, tenantId, part.id);

      let movement: { id: string; type: MovementType; quantity: number } | undefined;
      if (movementType) {
        const created = await this.createMovement(tx, {
          tenantId,
          partId: part.id,
          warehouseId: warehouse.id,
          type: movementType,
          quantity: input.quantity,
          actorUserId: input.actor?.sub,
          workOrderId: input.workOrderId,
          vehicleId: input.vehicleId,
          notes: input.notes ?? input.reason,
          sourceType: input.sourceType ?? operation.toUpperCase(),
          sourceDocument: input.sourceDocument,
          sourceLineKey: input.sourceLineKey,
          importRunId: input.importRunId,
          reference: input.sourceDocument ?? (input.workOrderId ? `work-order:${input.workOrderId}` : undefined)
        });
        movement = { id: created.id, type: created.type, quantity: created.quantity };
      }

      const partAfter = await this.loadActivePart(tx, tenantId, part.id);
      const result: StockMutationResult = {
        part: {
          id: partAfter.id,
          quantityInStock: partAfter.quantityInStock,
          reservedQuantity: partAfter.reservedQuantity,
          availableQuantity: partAfter.availableQuantity
        },
        warehouseId: warehouse.id,
        movement: movement ?? { id: "", type: MovementType.ADJUSTMENT, quantity: input.quantity },
        replayed: false
      };
      await this.commitIdempotency(tx, tenantId, operation, input, result, movement?.id);
      await this.recordAudit(tx, {
        actor: input.actor,
        entityId: part.id,
        action: AuditAction.UPDATE,
        reason: input.reason ?? input.notes,
        metadata: {
          event: `inventory_${operation}`,
          quantity: input.quantity,
          warehouseId: warehouse.id,
          workOrderId: input.workOrderId ?? null,
          movementId: movement?.id ?? null,
          sourceType: input.sourceType ?? operation.toUpperCase(),
          sourceLineKey: input.sourceLineKey ?? null
        }
      });
      return result;
    };

    if (existingTx) {
      return work(existingTx);
    }
    return this.prisma.$transaction((tx) => work(tx));
  }

  private deltaValue(kind: "increment" | "decrement" | undefined, quantity: number): number {
    if (!kind) {
      return 0;
    }
    return kind === "increment" ? quantity : -quantity;
  }

  private isInbound(type: MovementType): boolean {
    return (
      type === MovementType.IN ||
      type === MovementType.RETURN ||
      type === MovementType.TRANSFER_IN ||
      type === MovementType.ADJUSTMENT_IN
    );
  }

  private assertActor(actor?: Actor) {
    if (!actor?.sub) {
      throw new BadRequestException("Authenticated actor context is required");
    }
    return actor;
  }

  private payloadHash(operation: string, input: StockOpInput): string {
    return hashIdempotencyPayload({
      operation,
      partId: input.partId,
      quantity: input.quantity,
      warehouseId: input.warehouseId ?? null,
      warehouseCode: input.warehouseCode ?? null,
      destWarehouseId: input.destWarehouseId ?? null,
      destWarehouseCode: input.destWarehouseCode ?? null,
      workOrderId: input.workOrderId ?? null,
      consumeReservation: Boolean(input.consumeReservation),
      sourceLineKey: input.sourceLineKey ?? null,
      reversalOfMovementId: input.reversalOfMovementId ?? null
    });
  }

  private replayFromIdempotency(
    existing: {
      payloadHash: string;
      operation: string;
      warehouseId: string | null;
      movementId: string | null;
      quantity: number;
      resultJson: Prisma.JsonValue | null;
    },
    operation: string,
    expectedHash: string,
    part: { id: string; quantityInStock: number; reservedQuantity: number; availableQuantity: number }
  ): StockMutationResult {
    if (existing.payloadHash !== expectedHash || existing.operation !== operation) {
      throw new BadRequestException("Idempotency key was already used with a different stock payload for this tenant.");
    }
    const resultJson = existing.resultJson as StockMutationResult | null;
    if (resultJson?.part) {
      return { ...resultJson, replayed: true };
    }
    return {
      part: {
        id: part.id,
        quantityInStock: part.quantityInStock,
        reservedQuantity: part.reservedQuantity,
        availableQuantity: part.availableQuantity
      },
      warehouseId: existing.warehouseId ?? "",
      movement: { id: existing.movementId ?? "", type: MovementType.ADJUSTMENT, quantity: existing.quantity },
      replayed: true
    };
  }

  private async beginIdempotency(
    tx: Prisma.TransactionClient,
    tenantId: string,
    operation: string,
    input: StockOpInput
  ): Promise<StockMutationResult | null> {
    const key = input.idempotencyKey?.trim();
    if (!key) {
      return null;
    }
    const expected = this.payloadHash(operation, input);
    const existing = await tx.inventoryIdempotency.findUnique({
      where: { tenantId_key: { tenantId, key } }
    });
    if (existing) {
      const part = await this.loadActivePart(tx, tenantId, existing.partId ?? input.partId);
      return this.replayFromIdempotency(existing, operation, expected, part);
    }
    try {
      await tx.inventoryIdempotency.create({
        data: {
          tenantId,
          key,
          operation,
          payloadHash: expected,
          partId: input.partId,
          quantity: input.quantity
        }
      });
      return null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const raced = await tx.inventoryIdempotency.findUnique({
          where: { tenantId_key: { tenantId, key } }
        });
        if (!raced) {
          throw error;
        }
        const part = await this.loadActivePart(tx, tenantId, raced.partId ?? input.partId);
        return this.replayFromIdempotency(raced, operation, expected, part);
      }
      throw error;
    }
  }

  private async commitIdempotency(
    tx: Prisma.TransactionClient,
    tenantId: string,
    _operation: string,
    input: StockOpInput,
    result: StockMutationResult,
    movementId?: string,
    transferGroupId?: string
  ) {
    const key = input.idempotencyKey?.trim();
    if (!key) {
      return;
    }
    await tx.inventoryIdempotency.update({
      where: { tenantId_key: { tenantId, key } },
      data: {
        warehouseId: result.warehouseId || undefined,
        movementId: movementId || result.movement.id || undefined,
        transferGroupId,
        resultJson: result as unknown as Prisma.InputJsonValue
      }
    });
  }

  async resolveWarehouse(tx: DbClient, tenantId: string, warehouseId?: string, warehouseCode?: string) {
    if (warehouseId) {
      const warehouse = await tx.warehouse.findFirst({
        where: { id: warehouseId, tenantId, isActive: true }
      });
      if (!warehouse) {
        throw new BadRequestException("Warehouse not found");
      }
      return warehouse;
    }
    if (warehouseCode?.trim()) {
      const warehouse = await tx.warehouse.findFirst({
        where: { tenantId, code: warehouseCode.trim(), isActive: true }
      });
      if (!warehouse) {
        throw new BadRequestException("UNKNOWN_WAREHOUSE");
      }
      return warehouse;
    }
    const existingDefault = await tx.warehouse.findFirst({
      where: { tenantId, isDefault: true, isActive: true }
    });
    if (existingDefault) {
      return existingDefault;
    }
    try {
      return await tx.warehouse.create({
        data: {
          tenantId,
          code: DEFAULT_WAREHOUSE_CODE,
          name: DEFAULT_WAREHOUSE_NAME,
          isDefault: true,
          isActive: true
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const raced = await tx.warehouse.findFirst({
          where: { tenantId, code: DEFAULT_WAREHOUSE_CODE }
        });
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
  }

  private async loadActivePart(tx: DbClient, tenantId: string, partId: string) {
    const part = await tx.sparePart.findFirst({
      where: { id: partId, tenantId, isActive: true }
    });
    if (!part) {
      throw new NotFoundException("Spare part not found");
    }
    return part;
  }

  private async ensureBalances(
    tx: Prisma.TransactionClient,
    tenantId: string,
    partId: string,
    warehouseIds: string[],
    part: { quantityInStock: number; reservedQuantity: number; availableQuantity: number }
  ) {
    const defaultWarehouse = await tx.warehouse.findFirst({
      where: { tenantId, isDefault: true, isActive: true }
    });
    const normalized = normalizeStockQuantities(part);

    for (const warehouseId of warehouseIds) {
      const existing = await tx.warehouseItemBalance.findFirst({
        where: { tenantId, warehouseId, partId }
      });
      if (existing) {
        const aligned = normalizeStockQuantities(existing);
        if (
          existing.onHand !== aligned.onHand ||
          existing.reserved !== aligned.reserved ||
          existing.available !== aligned.available
        ) {
          await tx.warehouseItemBalance.update({
            where: { id: existing.id },
            data: aligned
          });
        }
        continue;
      }
      const seedFromPart = defaultWarehouse?.id === warehouseId;
      try {
        await tx.warehouseItemBalance.create({
          data: {
            tenantId,
            warehouseId,
            partId,
            onHand: seedFromPart ? normalized.onHand : 0,
            reserved: seedFromPart ? normalized.reserved : 0,
            available: seedFromPart ? normalized.available : 0
          }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
          throw error;
        }
      }
    }
  }

  private async loadBalance(tx: DbClient, tenantId: string, warehouseId: string, partId: string): Promise<StockQuantities> {
    const row = await tx.warehouseItemBalance.findFirst({
      where: { tenantId, warehouseId, partId }
    });
    if (!row) {
      return { onHand: 0, reserved: 0, available: 0 };
    }
    return normalizeStockQuantities(row);
  }

  private async conditionalBalanceUpdate(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      warehouseId: string;
      partId: string;
      whereOnHandGte?: number;
      whereReservedGte?: number;
      whereAvailableGte?: number;
      onHandDelta?: number;
      reservedDelta?: number;
      availableDelta?: number;
    }
  ): Promise<boolean> {
    const result = await tx.warehouseItemBalance.updateMany({
      where: {
        tenantId: args.tenantId,
        warehouseId: args.warehouseId,
        partId: args.partId,
        ...(args.whereOnHandGte != null ? { onHand: { gte: args.whereOnHandGte } } : {}),
        ...(args.whereReservedGte != null ? { reserved: { gte: args.whereReservedGte } } : {}),
        ...(args.whereAvailableGte != null ? { available: { gte: args.whereAvailableGte } } : {})
      },
      data: {
        ...(args.onHandDelta ? { onHand: { increment: args.onHandDelta } } : {}),
        ...(args.reservedDelta ? { reserved: { increment: args.reservedDelta } } : {}),
        ...(args.availableDelta ? { available: { increment: args.availableDelta } } : {}),
        lastMovementAt: new Date()
      }
    });
    return result.count === 1;
  }

  private async syncPartFromBalances(tx: Prisma.TransactionClient, tenantId: string, partId: string) {
    const balances = await tx.warehouseItemBalance.findMany({
      where: { tenantId, partId }
    });
    const onHand = balances.reduce((sum, row) => sum + row.onHand, 0);
    const reserved = balances.reduce((sum, row) => sum + row.reserved, 0);
    const available = deriveAvailable(onHand, reserved);
    await tx.sparePart.update({
      where: { id: partId },
      data: {
        quantityInStock: onHand,
        reservedQuantity: reserved,
        availableQuantity: available
      }
    });
  }

  private async createMovement(
    tx: Prisma.TransactionClient,
    data: Prisma.StockMovementCreateInput | Prisma.StockMovementUncheckedCreateInput
  ) {
    return tx.stockMovement.create({ data: data as Prisma.StockMovementUncheckedCreateInput });
  }

  private async recordAudit(
    tx: Prisma.TransactionClient,
    payload: {
      actor?: Actor;
      entityId: string;
      action: AuditAction;
      reason?: string;
      metadata?: Prisma.InputJsonValue;
    }
  ) {
    const ctx = requestContext.get();
    const actorId = payload.actor?.sub ?? ctx?.actorId ?? null;
    const actorEmail = payload.actor?.email ?? ctx?.actorEmail ?? null;
    const actorRole = payload.actor?.role ?? ctx?.actorRole ?? null;
    await tx.auditLog.create({
      data: {
        tenantId: payload.actor?.tenantId ?? ctx?.tenantId ?? null,
        actorId,
        module: "inventory",
        entity: "INVENTORY_STOCK",
        entityId: payload.entityId,
        action: payload.action,
        reason: payload.reason,
        ipAddress: ctx?.ipAddress ?? undefined,
        userAgent: ctx?.userAgent ?? undefined,
        requestPath: ctx?.requestPath ?? undefined,
        actorSnapshot:
          actorId || actorEmail || actorRole
            ? ({ id: actorId, email: actorEmail, role: actorRole } as Prisma.InputJsonValue)
            : undefined,
        metadata: payload.metadata
      }
    });
  }
}
