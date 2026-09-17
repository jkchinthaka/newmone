import { Injectable } from "@nestjs/common";
import { MovementType } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "tenantId">;

export type DailyInventoryQuery = {
  from?: string;
  to?: string;
  preset?: "today" | "yesterday" | "last_7_days" | "this_month" | "custom";
  warehouseId?: string;
  partId?: string;
  category?: string;
};

type DailyBucket = {
  date: string;
  partId: string;
  warehouseId: string | null;
  opening: number;
  inbound: number;
  outbound: number;
  returned: number;
  adjustmentIn: number;
  adjustmentOut: number;
  transferIn: number;
  transferOut: number;
  /** Stock restored by reversing an outbound movement */
  reversalRestock: number;
  /** Stock removed by reversing an inbound movement */
  reversalDeduct: number;
  closing: number;
};

const INBOUND_TYPES = new Set<MovementType>([
  MovementType.IN,
  MovementType.RETURN,
  MovementType.TRANSFER_IN,
  MovementType.ADJUSTMENT_IN,
  MovementType.ADJUSTMENT
]);

const OUTBOUND_TYPES = new Set<MovementType>([
  MovementType.OUT,
  MovementType.TRANSFER_OUT,
  MovementType.ADJUSTMENT_OUT
]);

@Injectable()
export class InventoryDailyService {
  constructor(private readonly prisma: PrismaService) {}

  async report(query: DailyInventoryQuery, actor?: Actor) {
    const tenantId = requireTenantId(actor?.tenantId);
    const { from, to } = this.resolveRange(query);

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        tenantId,
        createdAt: { lt: to },
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.partId ? { partId: query.partId } : {}),
        ...(query.category ? { part: { category: query.category, tenantId } } : {})
      },
      include: {
        part: { select: { id: true, partNumber: true, name: true, category: true, unit: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        reversalOf: { select: { id: true, type: true, quantity: true } }
      },
      orderBy: { createdAt: "asc" }
    });

    const buckets = new Map<string, DailyBucket & { partNumber?: string; partName?: string; warehouseCode?: string }>();
    const running = new Map<string, number>();

    for (const movement of movements) {
      const dateKey = movement.createdAt.toISOString().slice(0, 10);
      const identity = `${movement.partId}:${movement.warehouseId ?? "none"}`;
      const prior = running.get(identity) ?? 0;
      const inRange = movement.createdAt >= from;
      const originalType =
        movement.type === MovementType.REVERSAL
          ? (movement.reversalOf?.type as MovementType | undefined) ?? null
          : null;
      const delta = this.signedDelta(movement.type, movement.quantity, originalType);

      if (inRange) {
        const bucketKey = `${dateKey}:${identity}`;
        const existing = buckets.get(bucketKey) ?? {
          date: dateKey,
          partId: movement.partId,
          warehouseId: movement.warehouseId ?? null,
          opening: prior,
          inbound: 0,
          outbound: 0,
          returned: 0,
          adjustmentIn: 0,
          adjustmentOut: 0,
          transferIn: 0,
          transferOut: 0,
          reversalRestock: 0,
          reversalDeduct: 0,
          closing: prior,
          partNumber: movement.part.partNumber,
          partName: movement.part.name,
          warehouseCode: movement.warehouse?.code
        };
        this.applyMovement(existing, movement.type, movement.quantity, originalType);
        existing.closing = existing.opening + this.net(existing);
        buckets.set(bucketKey, existing);
      }

      running.set(identity, prior + delta);
    }

    const rows = Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date) || a.partId.localeCompare(b.partId));
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      warehouseScoped: Boolean(query.warehouseId),
      rows,
      totals: rows.reduce(
        (acc, row) => {
          acc.inbound += row.inbound;
          acc.outbound += row.outbound;
          acc.returned += row.returned;
          acc.adjustmentIn += row.adjustmentIn;
          acc.adjustmentOut += row.adjustmentOut;
          acc.transferIn += row.transferIn;
          acc.transferOut += row.transferOut;
          acc.reversalRestock += row.reversalRestock;
          acc.reversalDeduct += row.reversalDeduct;
          return acc;
        },
        {
          inbound: 0,
          outbound: 0,
          returned: 0,
          adjustmentIn: 0,
          adjustmentOut: 0,
          transferIn: 0,
          transferOut: 0,
          reversalRestock: 0,
          reversalDeduct: 0
        }
      )
    };
  }

  private net(row: DailyBucket): number {
    return (
      row.inbound +
      row.returned +
      row.adjustmentIn +
      row.transferIn +
      row.reversalRestock -
      row.outbound -
      row.adjustmentOut -
      row.transferOut -
      row.reversalDeduct
    );
  }

  private applyMovement(
    row: DailyBucket,
    type: MovementType,
    quantity: number,
    originalType: MovementType | null
  ) {
    switch (type) {
      case MovementType.IN:
        row.inbound += quantity;
        break;
      case MovementType.OUT:
        row.outbound += quantity;
        break;
      case MovementType.RETURN:
        row.returned += quantity;
        break;
      case MovementType.TRANSFER_IN:
        row.transferIn += quantity;
        break;
      case MovementType.TRANSFER_OUT:
        row.transferOut += quantity;
        break;
      case MovementType.ADJUSTMENT_IN:
        row.adjustmentIn += quantity;
        break;
      case MovementType.ADJUSTMENT_OUT:
        row.adjustmentOut += quantity;
        break;
      case MovementType.ADJUSTMENT:
        row.adjustmentIn += quantity;
        break;
      case MovementType.REVERSAL: {
        const signed = this.signedDelta(type, quantity, originalType);
        if (signed > 0) {
          row.reversalRestock += quantity;
        } else if (signed < 0) {
          row.reversalDeduct += quantity;
        }
        break;
      }
      default:
        break;
    }
  }

  /**
   * REVERSAL applies the opposite signed impact of the original movement type.
   * reverse IN / RETURN / TRANSFER_IN / ADJUSTMENT_IN → decrease
   * reverse OUT / TRANSFER_OUT / ADJUSTMENT_OUT → increase
   */
  private signedDelta(type: MovementType, quantity: number, originalType: MovementType | null): number {
    if (type === MovementType.REVERSAL) {
      if (!originalType) {
        return 0;
      }
      if (INBOUND_TYPES.has(originalType)) {
        return -quantity;
      }
      if (OUTBOUND_TYPES.has(originalType)) {
        return quantity;
      }
      return 0;
    }
    if (INBOUND_TYPES.has(type)) {
      return quantity;
    }
    if (OUTBOUND_TYPES.has(type)) {
      return -quantity;
    }
    return 0;
  }

  private resolveRange(query: DailyInventoryQuery): { from: Date; to: Date } {
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(startToday);
    endToday.setDate(endToday.getDate() + 1);

    if (query.preset === "yesterday") {
      const from = new Date(startToday);
      from.setDate(from.getDate() - 1);
      return { from, to: startToday };
    }
    if (query.preset === "last_7_days") {
      const from = new Date(startToday);
      from.setDate(from.getDate() - 6);
      return { from, to: endToday };
    }
    if (query.preset === "this_month") {
      const from = new Date(startToday.getFullYear(), startToday.getMonth(), 1);
      return { from, to: endToday };
    }
    if (query.from || query.to || query.preset === "custom") {
      const from = query.from ? new Date(query.from) : startToday;
      const to = query.to ? new Date(query.to) : endToday;
      return { from, to };
    }
    return { from: startToday, to: endToday };
  }
}
