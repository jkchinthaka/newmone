import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import type { JwtPayload } from "../auth/auth.types";
import { InventoryTransactionEngine } from "./inventory-transaction.engine";

type Actor = Pick<JwtPayload, "sub" | "tenantId" | "role">;

const WRITE_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "ASSET_MANAGER",
  "INVENTORY_KEEPER",
  "MANAGER",
  "OPERATIONS_MANAGER"
]);

const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["COUNTING", "CANCELLED"],
  COUNTING: ["REVIEW", "CANCELLED"],
  REVIEW: ["APPROVED", "COUNTING", "CANCELLED"],
  APPROVED: ["POSTED", "CANCELLED"],
  POSTED: [],
  CANCELLED: []
};

@Injectable()
export class StockCountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: InventoryTransactionEngine
  ) {}

  private assertWrite(actor: Actor) {
    if (!actor.role || !WRITE_ROLES.has(actor.role)) {
      throw new ForbiddenException("You do not have permission to manage stock counts");
    }
  }

  async list(actor: Actor, query: { status?: string; warehouseId?: string; take?: number } = {}) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.stockCountSession.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {})
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        _count: { select: { lines: true } }
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(query.take ?? 50, 1), 200)
    });
  }

  async get(actor: Actor, id: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const session = await this.prisma.stockCountSession.findFirst({
      where: { id, tenantId },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        lines: {
          include: { part: { select: { id: true, partNumber: true, name: true, unit: true } } },
          orderBy: { createdAt: "asc" }
        }
      }
    });
    if (!session) throw new NotFoundException("Stock count session not found");
    return session;
  }

  async create(
    actor: Actor,
    input: {
      warehouseId: string;
      countType?: "CYCLE" | "ANNUAL" | "SPOT";
      blindCount?: boolean;
      notes?: string;
      seedFromBalances?: boolean;
    }
  ) {
    this.assertWrite(actor);
    const tenantId = requireTenantId(actor.tenantId);
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: input.warehouseId, tenantId, isActive: true }
    });
    if (!warehouse) throw new BadRequestException("Warehouse not found for this tenant");

    const session = await this.prisma.stockCountSession.create({
      data: {
        tenantId,
        warehouseId: warehouse.id,
        countType: input.countType ?? "CYCLE",
        blindCount: Boolean(input.blindCount),
        notes: input.notes?.trim() || null,
        createdById: actor.sub,
        status: "DRAFT"
      }
    });

    if (input.seedFromBalances !== false) {
      const balances = await this.prisma.warehouseItemBalance.findMany({
        where: { tenantId, warehouseId: warehouse.id },
        select: { partId: true, onHand: true }
      });
      if (balances.length) {
        await this.prisma.stockCountLine.createMany({
          data: balances.map((b) => ({
            tenantId,
            sessionId: session.id,
            partId: b.partId,
            expectedQuantity: b.onHand
          }))
        });
      }
    }

    return this.get(actor, session.id);
  }

  async transition(actor: Actor, id: string, toStatus: string, reason?: string) {
    this.assertWrite(actor);
    const tenantId = requireTenantId(actor.tenantId);
    const current = await this.prisma.stockCountSession.findFirst({ where: { id, tenantId } });
    if (!current) throw new NotFoundException("Stock count session not found");
    const allowed = TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(`Illegal stock count transition: ${current.status} → ${toStatus}`);
    }

    if (toStatus === "CANCELLED") {
      return this.prisma.stockCountSession.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: reason?.trim() || "Cancelled"
        }
      });
    }

    if (toStatus === "APPROVED") {
      return this.prisma.stockCountSession.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedById: actor.sub
        }
      });
    }

    if (toStatus === "POSTED") {
      return this.post(actor, id);
    }

    return this.prisma.stockCountSession.update({
      where: { id },
      data: { status: toStatus }
    });
  }

  async upsertLine(
    actor: Actor,
    sessionId: string,
    input: { partId: string; countedQuantity: number; notes?: string }
  ) {
    this.assertWrite(actor);
    const tenantId = requireTenantId(actor.tenantId);
    const session = await this.prisma.stockCountSession.findFirst({ where: { id: sessionId, tenantId } });
    if (!session) throw new NotFoundException("Stock count session not found");
    if (!["DRAFT", "OPEN", "COUNTING", "REVIEW"].includes(session.status)) {
      throw new BadRequestException("Counted quantities can only be edited before approval");
    }
    if (!Number.isFinite(input.countedQuantity) || input.countedQuantity < 0) {
      throw new BadRequestException("Counted quantity must be a non-negative number");
    }

    const balance = await this.prisma.warehouseItemBalance.findFirst({
      where: { tenantId, warehouseId: session.warehouseId, partId: input.partId }
    });
    const expected = balance?.onHand ?? 0;
    const variance = input.countedQuantity - expected;

    return this.prisma.stockCountLine.upsert({
      where: { sessionId_partId: { sessionId, partId: input.partId } },
      create: {
        tenantId,
        sessionId,
        partId: input.partId,
        expectedQuantity: expected,
        countedQuantity: input.countedQuantity,
        variance,
        notes: input.notes?.trim() || null
      },
      update: {
        expectedQuantity: expected,
        countedQuantity: input.countedQuantity,
        variance,
        notes: input.notes?.trim() || null
      }
    });
  }

  /**
   * Post variances through the Inventory Transaction Engine only.
   * Never directly UPDATE WarehouseItemBalance.onHand.
   */
  async post(actor: Actor, id: string) {
    this.assertWrite(actor);
    const tenantId = requireTenantId(actor.tenantId);
    const session = await this.prisma.stockCountSession.findFirst({
      where: { id, tenantId },
      include: { lines: true }
    });
    if (!session) throw new NotFoundException("Stock count session not found");
    if (session.status === "REVIEW") {
      throw new BadRequestException("Approve the stock count before posting");
    }
    if (session.status !== "APPROVED") {
      throw new BadRequestException(`Cannot post stock count in status ${session.status}`);
    }

    for (const line of session.lines) {
      if (line.countedQuantity == null) {
        throw new BadRequestException("All lines must have a counted quantity before posting");
      }
      const variance = line.countedQuantity - line.expectedQuantity;
      if (variance === 0 || line.adjustmentMovementId) continue;

      const result = await this.engine.adjust({
        actor: { sub: actor.sub, tenantId },
        partId: line.partId,
        warehouseId: session.warehouseId,
        quantity: Math.abs(variance),
        direction: variance > 0 ? "IN" : "OUT",
        reason: "STOCK_COUNT",
        notes: `Stock count ${session.id}`,
        sourceType: "STOCK_COUNT",
        sourceDocument: session.id,
        sourceLineKey: line.id,
        idempotencyKey: `stock-count:${session.id}:${line.id}`
      });

      await this.prisma.stockCountLine.update({
        where: { id: line.id },
        data: {
          variance,
          adjustmentMovementId: result.movement.id
        }
      });
    }

    return this.prisma.stockCountSession.update({
      where: { id },
      data: {
        status: "POSTED",
        postedAt: new Date(),
        postedById: actor.sub,
        approvedAt: session.approvedAt ?? new Date(),
        approvedById: session.approvedById ?? actor.sub
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        lines: {
          include: { part: { select: { id: true, partNumber: true, name: true, unit: true } } }
        }
      }
    });
  }
}
