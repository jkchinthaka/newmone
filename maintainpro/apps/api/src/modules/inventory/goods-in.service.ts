import { BadRequestException, Injectable } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import type { JwtPayload } from "../auth/auth.types";
import { InventoryService } from "./inventory.service";
import { InventoryTransactionEngine } from "./inventory-transaction.engine";
import { MAINTAINPRO_STOCK_SOURCE } from "./verified-stock-availability";

type Actor = Pick<JwtPayload, "sub" | "tenantId"> & Partial<Pick<JwtPayload, "email" | "role">>;

export const GOODS_IN_MAX_LINES = 500;
export const GOODS_IN_MAX_QUANTITY = 1_000_000;
const OWNED_STORE_CODE = "MAINT-STORE";
const OWNED_STORE_NAME = "Maintenance store";

/** One received line, from the form (one line) or an Excel row. */
export type GoodsInLineInput = {
  partId?: string | null;
  partNumber?: string | null;
  name?: string | null;
  category?: string | null;
  unit?: string | null;
  quantity: number | string;
  unitCost?: number | string | null;
  supplierName?: string | null;
  referenceNo?: string | null;
};

export type GoodsInLineCheck = {
  row: number;
  status: "OK" | "NEW" | "ERROR";
  message?: string;
  partId?: string;
  partNumber: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  unitCost: number | null;
  supplierName: string | null;
  referenceNo: string | null;
  currentOnHand?: number;
};

const text = (value: unknown, max = 200): string => String(value ?? "").trim().slice(0, max);

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).replace(/,/g, "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/** Field rules shared by preview and save (no database). */
export function normalizeGoodsInLine(line: GoodsInLineInput, index: number): GoodsInLineCheck {
  const quantity = toNumber(line.quantity);
  const unitCost = toNumber(line.unitCost);
  const base: GoodsInLineCheck = {
    row: index + 1,
    status: "OK",
    partId: text(line.partId, 36) || undefined,
    partNumber: text(line.partNumber, 64).toUpperCase(),
    name: text(line.name),
    category: text(line.category, 100) || "General",
    unit: text(line.unit, 20) || "pcs",
    quantity: quantity ?? 0,
    unitCost: unitCost === null || Number.isNaN(unitCost) ? null : Math.round(unitCost * 100) / 100,
    supplierName: text(line.supplierName, 120) || null,
    referenceNo: text(line.referenceNo, 64) || null
  };
  const problems: string[] = [];
  if (!base.partId && !base.partNumber) problems.push("Part code is missing");
  if (quantity === null) problems.push("Quantity is missing");
  else if (Number.isNaN(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    problems.push("Quantity must be a whole number above 0");
  } else if (quantity > GOODS_IN_MAX_QUANTITY) problems.push("Quantity is too large");
  if (unitCost !== null && (Number.isNaN(unitCost) || unitCost < 0)) problems.push("Unit cost must be 0 or more");
  if (problems.length) return { ...base, status: "ERROR", message: problems.join(". ") };
  return base;
}

/**
 * Goods in (GRN) for a MaintainPro-owned store: stock received here is the stock truth, so it
 * raises on-hand straight away and job issues lower it. Lines come from a single-item form or an
 * Excel file (parsed in the browser); every save is re-checked here. Unknown part codes become
 * new parts when a name is given.
 */
@Injectable()
export class GoodsInService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: InventoryTransactionEngine,
    private readonly inventory: InventoryService
  ) {}

  async preview(actor: Actor | undefined, lines: GoodsInLineInput[]) {
    const tenantId = requireTenantId(actor?.tenantId);
    const checked = await this.check(tenantId, lines);
    return this.summarize(checked);
  }

  async receive(
    actor: Actor | undefined,
    input: {
      lines: GoodsInLineInput[];
      referenceNo?: string | null;
      supplierName?: string | null;
      receivedDate?: string | null;
      notes?: string | null;
      warehouseId?: string | null;
      idempotencyKey?: string | null;
    }
  ) {
    if (!actor?.sub) throw new BadRequestException("Authenticated actor context is required");
    const tenantId = requireTenantId(actor.tenantId);
    const batchKey = text(input.idempotencyKey, 80);
    if (!batchKey) throw new BadRequestException("idempotencyKey is required");
    const checked = await this.check(tenantId, input.lines);
    const errors = checked.filter((line) => line.status === "ERROR");
    if (errors.length > 0) {
      throw new BadRequestException({
        code: "GOODS_IN_INVALID_LINES",
        message: `${errors.length} line(s) need fixing before saving.`,
        lines: errors.map((line) => ({ row: line.row, message: line.message }))
      });
    }

    const store = await this.ownedStore(tenantId, actor, input.warehouseId);
    const referenceNo = text(input.referenceNo, 64) || null;
    const supplierName = text(input.supplierName, 120) || null;
    const receivedDate = text(input.receivedDate, 10) || new Date().toISOString().slice(0, 10);
    const notes = text(input.notes, 500) || null;
    const createdParts = new Map<string, string>();
    let newParts = 0;
    let totalQuantity = 0;
    let totalValue = 0;

    for (const line of checked) {
      let partId = line.partId;
      if (!partId) {
        const known = createdParts.get(line.partNumber);
        if (known) {
          partId = known;
        } else {
          const existing = await this.findPart(tenantId, line.partNumber);
          if (existing) {
            partId = existing.id;
          } else {
            const created = await this.inventory.createPart(
              { partNumber: line.partNumber, name: line.name, category: line.category, unit: line.unit, unitCost: line.unitCost ?? 0 },
              actor as never
            );
            partId = (created as { id: string }).id;
            newParts += 1;
          }
          createdParts.set(line.partNumber, partId);
        }
      }

      const lineRef = line.referenceNo ?? referenceNo;
      const lineSupplier = line.supplierName ?? supplierName;
      await this.engine.receive({
        actor: actor as never,
        partId,
        quantity: line.quantity,
        warehouseId: store.id,
        sourceType: "GOODS_IN",
        sourceDocument: lineRef ?? undefined,
        sourceLineKey: `${batchKey}:${line.row}`,
        idempotencyKey: `goods-in:${batchKey}:${line.row}`,
        notes: [lineSupplier ? `Supplier: ${lineSupplier}` : null, `Received ${receivedDate}`, notes].filter(Boolean).join(" · ")
      });
      if (line.unitCost !== null) {
        // Latest purchase price becomes the part's cost for new job lines.
        await this.prisma.sparePart.update({ where: { id: partId }, data: { unitCost: line.unitCost } });
      }
      totalQuantity += line.quantity;
      totalValue += line.quantity * (line.unitCost ?? 0);
    }

    await this.prisma.auditLog
      .create({
        data: {
          tenantId,
          actorId: actor.sub,
          module: "inventory",
          entity: "GOODS_IN",
          entityId: batchKey,
          action: AuditAction.CREATE,
          reason: notes ?? "Goods received",
          metadata: JSON.stringify({
            event: "goods_in_received",
            warehouseId: store.id,
            referenceNo,
            supplierName,
            receivedDate,
            lines: checked.length,
            newParts,
            totalQuantity,
            totalValue: Math.round(totalValue * 100) / 100
          })
        }
      })
      .catch(() => undefined);

    return {
      store: { id: store.id, name: store.name },
      lines: checked.length,
      newParts,
      totalQuantity,
      totalValue: Math.round(totalValue * 100) / 100,
      referenceNo
    };
  }

  private summarize(lines: GoodsInLineCheck[]) {
    return {
      lines,
      counts: {
        total: lines.length,
        ok: lines.filter((line) => line.status === "OK").length,
        newParts: lines.filter((line) => line.status === "NEW").length,
        errors: lines.filter((line) => line.status === "ERROR").length
      },
      totalQuantity: lines.filter((line) => line.status !== "ERROR").reduce((sum, line) => sum + line.quantity, 0)
    };
  }

  private async check(tenantId: string, rawLines: GoodsInLineInput[]): Promise<GoodsInLineCheck[]> {
    if (!Array.isArray(rawLines) || rawLines.length === 0) throw new BadRequestException("Add at least one line.");
    if (rawLines.length > GOODS_IN_MAX_LINES) {
      throw new BadRequestException(`Too many lines. Up to ${GOODS_IN_MAX_LINES} per goods-in.`);
    }
    const lines = rawLines.map((line, index) => normalizeGoodsInLine(line, index));
    const ids = [...new Set(lines.map((line) => line.partId).filter((id): id is string => Boolean(id)))];
    const codes = [...new Set(lines.filter((line) => !line.partId && line.partNumber).map((line) => line.partNumber))];
    const parts = await this.prisma.sparePart.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          ...(ids.length ? [{ id: { in: ids } }] : []),
          ...(codes.length ? [{ partNumber: { in: codes } }, { erpCode: { in: codes } }] : [])
        ]
      },
      select: { id: true, partNumber: true, erpCode: true, name: true, category: true, unit: true, quantityInStock: true }
    });
    const byId = new Map(parts.map((part) => [part.id, part]));
    const byCode = new Map<string, (typeof parts)[number]>();
    for (const part of parts) {
      byCode.set(part.partNumber.toUpperCase(), part);
      if (part.erpCode) byCode.set(part.erpCode.toUpperCase(), part);
    }

    return lines.map((line) => {
      if (line.status === "ERROR") return line;
      const part = line.partId ? byId.get(line.partId) : byCode.get(line.partNumber);
      if (line.partId && !part) return { ...line, status: "ERROR", message: "Part not found" };
      if (part) {
        return {
          ...line,
          status: "OK",
          partId: part.id,
          partNumber: part.partNumber,
          name: part.name,
          category: part.category,
          unit: part.unit,
          currentOnHand: part.quantityInStock
        };
      }
      if (!line.name) {
        return { ...line, status: "ERROR", message: "New part code: add the part name so it can be created" };
      }
      return { ...line, status: "NEW", message: "New part — will be added to Spare Parts" };
    });
  }

  private async findPart(tenantId: string, code: string) {
    return this.prisma.sparePart.findFirst({
      where: { tenantId, OR: [{ partNumber: code }, { erpCode: code }] },
      select: { id: true }
    });
  }

  /**
   * The store goods are received into. Uses a MaintainPro store when one exists; otherwise the
   * default store without an ERP code becomes the MaintainPro store, or one is created.
   */
  async ownedStore(tenantId: string, actor: Actor, warehouseId?: string | null) {
    if (warehouseId) {
      const chosen = await this.prisma.warehouse.findFirst({
        where: { id: warehouseId, tenantId, isActive: true, stockSource: MAINTAINPRO_STOCK_SOURCE }
      });
      if (!chosen) throw new BadRequestException("Choose a MaintainPro store for goods in.");
      return chosen;
    }
    const owned = await this.prisma.warehouse.findFirst({
      where: { tenantId, isActive: true, stockSource: MAINTAINPRO_STOCK_SOURCE },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
    });
    if (owned) return owned;

    const unmappedDefault = await this.prisma.warehouse.findFirst({
      where: { tenantId, isActive: true, isDefault: true, erpWarehouseCode: null }
    });
    const store = unmappedDefault
      ? await this.prisma.warehouse.update({
          where: { id: unmappedDefault.id },
          data: { stockSource: MAINTAINPRO_STOCK_SOURCE }
        })
      : await this.createOwnedStore(tenantId);
    await this.prisma.auditLog
      .create({
        data: {
          tenantId,
          actorId: actor.sub,
          module: "inventory",
          entity: "Warehouse",
          entityId: store.id,
          action: AuditAction.UPDATE,
          reason: "First goods in: stock for this store is now kept in MaintainPro",
          metadata: JSON.stringify({ event: "warehouse_stock_source_maintainpro", code: store.code })
        }
      })
      .catch(() => undefined);
    return store;
  }

  private async createOwnedStore(tenantId: string) {
    const hasDefault = await this.prisma.warehouse.findFirst({ where: { tenantId, isDefault: true, isActive: true } });
    try {
      return await this.prisma.warehouse.create({
        data: {
          tenantId,
          code: OWNED_STORE_CODE,
          name: OWNED_STORE_NAME,
          isDefault: !hasDefault,
          isActive: true,
          stockSource: MAINTAINPRO_STOCK_SOURCE
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.warehouse.findFirst({ where: { tenantId, code: OWNED_STORE_CODE } });
        if (existing) {
          return this.prisma.warehouse.update({ where: { id: existing.id }, data: { stockSource: MAINTAINPRO_STOCK_SOURCE, isActive: true } });
        }
      }
      throw error;
    }
  }
}
