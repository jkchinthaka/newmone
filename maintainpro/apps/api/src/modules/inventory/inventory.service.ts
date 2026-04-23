import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  parts() {
    return this.prisma.sparePart.findMany({
      where: {
        isActive: true
      },
      include: {
        supplier: true,
        stockMovements: {
          select: {
            createdAt: true,
            type: true,
            quantity: true,
            reference: true,
            notes: true
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async part(id: string) {
    const part = await this.prisma.sparePart.findUnique({
      where: { id },
      include: { supplier: true }
    });

    if (!part || !part.isActive) {
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

  async removePart(id: string) {
    await this.part(id);

    return this.prisma.sparePart.update({
      where: { id },
      data: {
        isActive: false
      }
    });
  }

  async bulkDeleteParts(ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException("At least one part id is required");
    }

    const result = await this.prisma.sparePart.updateMany({
      where: {
        id: {
          in: ids
        }
      },
      data: {
        isActive: false
      }
    });

    return { count: result.count };
  }

  async bulkUpdateCategory(ids: string[], category: string) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException("At least one part id is required");
    }

    if (!category?.trim()) {
      throw new BadRequestException("Category is required");
    }

    const result = await this.prisma.sparePart.updateMany({
      where: {
        id: {
          in: ids
        },
        isActive: true
      },
      data: {
        category: category.trim()
      }
    });

    return { count: result.count };
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

  async linkedWorkOrders(partId: string) {
    await this.part(partId);

    return this.prisma.workOrder.findMany({
      where: {
        parts: {
          some: {
            partId
          }
        }
      },
      include: {
        asset: true,
        vehicle: true,
        technician: true,
        parts: {
          where: {
            partId
          },
          include: {
            part: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async purchaseHistoryForPart(partId: string) {
    const part = await this.part(partId);

    if (!part.supplierId) {
      return [];
    }

    return this.prisma.purchaseOrder.findMany({
      where: {
        supplierId: part.supplierId
      },
      include: {
        supplier: true
      },
      orderBy: {
        orderDate: "desc"
      }
    });
  }

  async usageTrend(days = 30) {
    const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (safeDays - 1));

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        type: "OUT",
        createdAt: {
          gte: since
        },
        part: {
          isActive: true
        }
      },
      select: {
        quantity: true,
        createdAt: true
      }
    });

    const dateTotals = new Map<string, number>();

    for (let offset = 0; offset < safeDays; offset += 1) {
      const day = new Date(since);
      day.setDate(since.getDate() + offset);
      dateTotals.set(this.toDateKey(day), 0);
    }

    for (const movement of movements) {
      const key = this.toDateKey(movement.createdAt);
      dateTotals.set(key, (dateTotals.get(key) ?? 0) + movement.quantity);
    }

    return Array.from(dateTotals.entries()).map(([date, quantity]) => ({
      date,
      quantity
    }));
  }

  async topUsedParts(limit = 5, days = 30) {
    const safeLimit = Math.max(1, Math.min(25, Math.floor(limit)));
    const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (safeDays - 1));

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        type: "OUT",
        createdAt: {
          gte: since
        },
        part: {
          isActive: true
        }
      },
      select: {
        quantity: true,
        part: {
          select: {
            id: true,
            name: true,
            partNumber: true
          }
        }
      }
    });

    const totals = new Map<string, { partId: string; partName: string; partNumber: string; quantity: number }>();

    for (const movement of movements) {
      const existing = totals.get(movement.part.id);

      if (existing) {
        existing.quantity += movement.quantity;
      } else {
        totals.set(movement.part.id, {
          partId: movement.part.id,
          partName: movement.part.name,
          partNumber: movement.part.partNumber,
          quantity: movement.quantity
        });
      }
    }

    return Array.from(totals.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, safeLimit);
  }

  lowStock() {
    return this.prisma.sparePart.findMany({
      where: {
        isActive: true,
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
