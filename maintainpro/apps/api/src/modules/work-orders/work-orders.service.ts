import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  NotificationPriority,
  NotificationType,
  Priority,
  RoleName,
  WorkOrderStatus
} from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  private slaHours(priority: Priority): number {
    switch (priority) {
      case Priority.CRITICAL:
        return 4;
      case Priority.HIGH:
        return 24;
      case Priority.MEDIUM:
        return 72;
      case Priority.LOW:
      default:
        return 168;
    }
  }

  private async nextWoNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.workOrder.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01T00:00:00.000Z`),
          lte: new Date(`${year}-12-31T23:59:59.999Z`)
        }
      }
    });

    const sequence = String(count + 1).padStart(4, "0");
    return `WO-${year}-${sequence}`;
  }

  findAll() {
    return this.prisma.workOrder.findMany({
      include: {
        asset: true,
        vehicle: true,
        technician: true,
        createdBy: true,
        parts: {
          include: {
            part: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async findOne(id: string) {
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id },
      include: {
        parts: {
          include: {
            part: true
          }
        }
      }
    });

    if (!workOrder) {
      throw new NotFoundException("Work order not found");
    }

    return workOrder;
  }

  async create(data: {
    title: string;
    description: string;
    priority: Priority;
    type: "PREVENTIVE" | "CORRECTIVE" | "EMERGENCY" | "INSPECTION" | "INSTALLATION";
    assetId?: string;
    vehicleId?: string;
    scheduleId?: string;
    createdById: string;
    dueDate?: string;
  }) {
    const woNumber = await this.nextWoNumber();

    const created = await this.prisma.workOrder.create({
      data: {
        woNumber,
        title: data.title,
        description: data.description,
        priority: data.priority,
        type: data.type,
        assetId: data.assetId,
        vehicleId: data.vehicleId,
        scheduleId: data.scheduleId,
        createdById: data.createdById,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined
      }
    });

    return created;
  }

  async update(id: string, data: Partial<{ title: string; description: string; dueDate: string; estimatedCost: number; estimatedHours: number }>) {
    await this.findOne(id);

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined
      }
    });
  }

  async remove(id: string) {
    const existing = await this.findOne(id);

    if (existing.status !== WorkOrderStatus.OPEN) {
      throw new BadRequestException("Work order deletion only allowed when status is OPEN");
    }

    await this.prisma.workOrder.delete({ where: { id } });

    return { deleted: true };
  }

  async assign(id: string, technicianId: string) {
    const technician = await this.prisma.user.findUnique({
      where: { id: technicianId },
      include: { role: true }
    });

    if (!technician) {
      throw new NotFoundException("Technician user not found");
    }

    if (technician.role.name === RoleName.DRIVER || technician.role.name === RoleName.VIEWER) {
      throw new BadRequestException("Cannot assign a work order to a VIEWER or DRIVER role user");
    }

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        technicianId
      }
    });

    await this.notificationsService.createNotification({
      userId: technicianId,
      title: "Work order assigned",
      message: `Work order ${updated.woNumber} assigned to you${updated.dueDate ? ` - due ${updated.dueDate.toISOString()}` : ""}`,
      type: NotificationType.WORK_ORDER_ASSIGNED,
      priority: NotificationPriority.WARNING,
      channel: "IN_APP",
      referenceId: updated.id,
      referenceType: "WorkOrder",
      dueAt: updated.dueDate ?? null,
      metadata: {
        woNumber: updated.woNumber,
        status: updated.status,
        priority: updated.priority
      }
    });

    return updated;
  }

  async updateStatus(
    id: string,
    data: {
      status: WorkOrderStatus;
      actualCost?: number;
      actualHours?: number;
    }
  ) {
    const current = await this.findOne(id);

    if (data.status === WorkOrderStatus.COMPLETED && (!data.actualCost || !data.actualHours)) {
      throw new BadRequestException("Cannot complete a work order without entering actual cost and hours");
    }

    let slaDeadline = current.slaDeadline;
    let startDate = current.startDate;

    if (data.status === WorkOrderStatus.IN_PROGRESS && !current.startDate) {
      startDate = new Date();
      slaDeadline = new Date(startDate.getTime() + this.slaHours(current.priority) * 60 * 60 * 1000);
    }

    const completedDate = data.status === WorkOrderStatus.COMPLETED ? new Date() : current.completedDate;

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        status: data.status,
        startDate,
        slaDeadline,
        actualCost: data.actualCost,
        actualHours: data.actualHours,
        completedDate,
        slaBreached: Boolean(slaDeadline && completedDate && completedDate.getTime() > slaDeadline.getTime())
      }
    });

    return updated;
  }

  async addPart(id: string, data: { partId: string; quantity: number; unitCost: number }) {
    const part = await this.prisma.sparePart.findUnique({ where: { id: data.partId } });

    if (!part) {
      throw new NotFoundException("Spare part not found");
    }

    if (part.quantityInStock < data.quantity) {
      throw new BadRequestException("Parts used in a work order cannot exceed available stock");
    }

    const totalCost = data.quantity * data.unitCost;

    const createdPart = await this.prisma.workOrderPart.create({
      data: {
        workOrderId: id,
        partId: data.partId,
        quantity: data.quantity,
        unitCost: data.unitCost,
        totalCost
      }
    });

    await this.prisma.sparePart.update({
      where: { id: data.partId },
      data: {
        quantityInStock: {
          decrement: data.quantity
        }
      }
    });

    await this.prisma.stockMovement.create({
      data: {
        partId: data.partId,
        type: "OUT",
        quantity: data.quantity,
        reference: id,
        notes: "Deducted via work order"
      }
    });

    return createdPart;
  }

  parts(id: string) {
    return this.prisma.workOrderPart.findMany({
      where: { workOrderId: id },
      include: { part: true }
    });
  }

  async addNote(id: string, note: string) {
    const current = await this.findOne(id);
    const existing = current.notes ? `${current.notes}\n` : "";

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        notes: `${existing}[${new Date().toISOString()}] ${note}`
      }
    });
  }

  async addAttachment(id: string, attachmentUrl: string) {
    const current = await this.findOne(id);

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        attachments: [...current.attachments, attachmentUrl]
      }
    });
  }
}
