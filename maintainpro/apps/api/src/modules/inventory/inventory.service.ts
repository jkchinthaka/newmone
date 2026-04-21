import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  parts() {
    return this.prisma.sparePart.findMany({ include: { supplier: true }, orderBy: { createdAt: "desc" } });
  }

  async part(id: string) {
    const part = await this.prisma.sparePart.findUnique({ where: { id }, include: { supplier: true } });

    if (!part) {
      throw new NotFoundException("Spare part not found");
    }

    return part;
  }

  async createPart(data: {
    partNumber: string;
    name: string;
    category: string;
    unitCost: number;
    unit?: string;
    minimumStock?: number;
    reorderPoint?: number;
    quantityInStock?: number;
    location?: string;
    supplierId?: string;
  }) {
    const existing = await this.prisma.sparePart.findUnique({ where: { partNumber: data.partNumber } });

    if (existing) {
      throw new BadRequestException("Part number must be unique");
    }

    if ((data.reorderPoint ?? 0) >= (data.minimumStock ?? 0) && (data.minimumStock ?? 0) > 0) {
      throw new BadRequestException("Reorder point must be less than minimum stock");
    }

    return this.prisma.sparePart.create({
      data: {
        partNumber: data.partNumber,
        name: data.name,
        category: data.category,
        unitCost: data.unitCost,
        unit: data.unit ?? "pcs",
        minimumStock: data.minimumStock ?? 0,
        reorderPoint: data.reorderPoint ?? 0,
        quantityInStock: data.quantityInStock ?? 0,
        location: data.location,
        supplierId: data.supplierId,
        images: []
      }
    });
  }

  async updatePart(
    id: string,
    data: Partial<{
      name: string;
      category: string;
      unitCost: number;
      minimumStock: number;
      reorderPoint: number;
      location: string;
    }>
  ) {
    const current = await this.part(id);
    const minimumStock = data.minimumStock ?? current.minimumStock;
    const reorderPoint = data.reorderPoint ?? current.reorderPoint;

    if (reorderPoint >= minimumStock && minimumStock > 0) {
      throw new BadRequestException("Reorder point must be less than minimum stock");
    }

    return this.prisma.sparePart.update({ where: { id }, data });
  }

  async stockIn(id: string, quantity: number, notes?: string) {
    await this.part(id);

    const part = await this.prisma.sparePart.update({
      where: { id },
      data: {
        quantityInStock: {
          increment: quantity
        }
      }
    });

    await this.prisma.stockMovement.create({
      data: {
        partId: id,
        type: "IN",
        quantity,
        notes
      }
    });

    return part;
  }

  async stockOut(id: string, quantity: number, notes?: string) {
    const part = await this.part(id);

    if (part.quantityInStock < quantity) {
      throw new BadRequestException("Stock quantity cannot go below 0");
    }

    const updated = await this.prisma.sparePart.update({
      where: { id },
      data: {
        quantityInStock: {
          decrement: quantity
        }
      }
    });

    await this.prisma.stockMovement.create({
      data: {
        partId: id,
        type: "OUT",
        quantity,
        notes
      }
    });

    return updated;
  }

  movements(id: string) {
    return this.prisma.stockMovement.findMany({
      where: { partId: id },
      orderBy: { createdAt: "desc" }
    });
  }

  lowStock() {
    return this.prisma.sparePart.findMany({
      where: {
        quantityInStock: {
          lte: this.prisma.sparePart.fields.reorderPoint
        }
      }
    });
  }

  purchaseOrders() {
    return this.prisma.purchaseOrder.findMany({ include: { supplier: true }, orderBy: { createdAt: "desc" } });
  }

  createPurchaseOrder(data: {
    poNumber: string;
    supplierId: string;
    orderDate: string;
    expectedDate?: string;
    totalAmount: number;
    notes?: string;
  }) {
    return this.prisma.purchaseOrder.create({
      data: {
        poNumber: data.poNumber,
        supplierId: data.supplierId,
        orderDate: new Date(data.orderDate),
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined,
        totalAmount: data.totalAmount,
        notes: data.notes
      }
    });
  }

  updatePurchaseOrder(id: string, data: Partial<{ status: "PENDING" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED"; receivedDate: string; notes: string }>) {
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: data.status,
        receivedDate: data.receivedDate ? new Date(data.receivedDate) : undefined,
        notes: data.notes
      }
    });
  }
}
