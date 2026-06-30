import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AuditAction,
  Prisma,
  RoleName,
  WorkOrderAssigneeStatus,
  WorkOrderStatus
} from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { WorkforcePlanningService } from "../workforce/workforce-planning.service";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

export type AddWorkOrderAssigneeInput = {
  employeeId: string;
  designation?: string;
  roleInTask?: string;
  isPrimary?: boolean;
  plannedStartAt?: string;
  plannedEndAt?: string;
  estimatedHours?: number;
  remarks?: string;
  leaveOverride?: boolean;
};

@Injectable()
export class WorkOrderAssigneesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workforcePlanning: WorkforcePlanningService
  ) {}

  private resolveTenantId(actor?: Actor) {
    return actor?.tenantId ?? undefined;
  }

  private async recordAudit(payload: {
    entity: string;
    entityId: string;
    action: AuditAction;
    actor?: Actor;
    reason?: string;
    metadata?: Prisma.InputJsonValue;
    beforeData?: Prisma.InputJsonValue;
    afterData?: Prisma.InputJsonValue;
  }) {
    const ctx = requestContext.get();
    await this.prisma.auditLog.create({
      data: {
        tenantId: payload.actor?.tenantId ?? ctx?.tenantId ?? null,
        actorId: payload.actor?.sub ?? ctx?.actorId ?? null,
        module: "maintenance",
        entity: payload.entity,
        entityId: payload.entityId,
        action: payload.action,
        reason: payload.reason,
        ipAddress: ctx?.ipAddress ?? undefined,
        userAgent: ctx?.userAgent ?? undefined,
        requestPath: ctx?.requestPath ?? undefined,
        metadata: payload.metadata,
        beforeData: payload.beforeData,
        afterData: payload.afterData
      }
    });
  }

  private async assertWorkOrder(id: string, actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    const workOrder = await this.prisma.workOrder.findFirst({
      where: {
        id,
        ...(tenantId !== undefined ? { tenantId } : {})
      }
    });

    if (!workOrder) {
      throw new NotFoundException("Work order not found");
    }

    if (
      workOrder.status === WorkOrderStatus.COMPLETED ||
      workOrder.status === WorkOrderStatus.CANCELLED
    ) {
      throw new BadRequestException("Cannot modify assignees on a closed work order");
    }

    return workOrder;
  }

  async listAssignees(workOrderId: string, actor?: Actor) {
    await this.assertWorkOrder(workOrderId, actor);
    const tenantId = this.resolveTenantId(actor);

    return this.prisma.workOrderAssignee.findMany({
      where: {
        workOrderId,
        assignmentStatus: { not: WorkOrderAssigneeStatus.REMOVED },
        ...(tenantId !== undefined ? { tenantId } : {})
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            designation: true,
            email: true,
            role: { select: { name: true } }
          }
        }
      },
      orderBy: [{ isPrimary: "desc" }, { assignedAt: "asc" }]
    });
  }

  async addAssignee(workOrderId: string, input: AddWorkOrderAssigneeInput, actor?: Actor) {
    const workOrder = await this.assertWorkOrder(workOrderId, actor);
    const tenantId = this.resolveTenantId(actor);

    const employee = await this.prisma.user.findFirst({
      where: {
        id: input.employeeId,
        isActive: true,
        ...(tenantId !== undefined ? { tenantId } : {})
      },
      include: { role: true }
    });

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    if (employee.role.name === RoleName.DRIVER || employee.role.name === RoleName.VIEWER) {
      throw new BadRequestException("Cannot assign work orders to VIEWER or DRIVER roles");
    }

    if (input.designation?.trim()) {
      const required = input.designation.trim().toLowerCase();
      const employeeDesignation = (employee.designation ?? "").trim().toLowerCase();
      if (employeeDesignation && employeeDesignation !== required) {
        throw new BadRequestException(
          `Employee designation "${employee.designation}" does not match required "${input.designation}"`
        );
      }
    }

    const existing = await this.prisma.workOrderAssignee.findUnique({
      where: {
        workOrderId_employeeId: {
          workOrderId,
          employeeId: input.employeeId
        }
      }
    });

    if (existing && existing.assignmentStatus !== WorkOrderAssigneeStatus.REMOVED) {
      throw new BadRequestException("Employee is already assigned to this work order");
    }

    const plannedStartAt = input.plannedStartAt ? new Date(input.plannedStartAt) : null;
    const plannedEndAt = input.plannedEndAt ? new Date(input.plannedEndAt) : null;

    await this.workforcePlanning.assertAssignmentAvailability({
      tenantId: workOrder.tenantId,
      employeeId: input.employeeId,
      plannedStartAt,
      plannedEndAt,
      estimatedHours: input.estimatedHours,
      leaveOverride: Boolean(input.leaveOverride),
      actorRole: actor?.role
    });

    if (input.isPrimary) {
      await this.prisma.workOrderAssignee.updateMany({
        where: {
          workOrderId,
          assignmentStatus: { not: WorkOrderAssigneeStatus.REMOVED }
        },
        data: { isPrimary: false }
      });
    }

    const assignee = await this.prisma.workOrderAssignee.upsert({
      where: {
        workOrderId_employeeId: {
          workOrderId,
          employeeId: input.employeeId
        }
      },
      create: {
        tenantId: workOrder.tenantId,
        workOrderId,
        employeeId: input.employeeId,
        designation: input.designation?.trim() || employee.designation,
        roleInTask: input.roleInTask?.trim(),
        isPrimary: Boolean(input.isPrimary),
        plannedStartAt,
        plannedEndAt,
        estimatedHours: input.estimatedHours,
        assignmentStatus: WorkOrderAssigneeStatus.ASSIGNED,
        assignedById: actor?.sub,
        remarks: input.remarks?.trim(),
        leaveOverride: Boolean(input.leaveOverride)
      },
      update: {
        designation: input.designation?.trim() || employee.designation,
        roleInTask: input.roleInTask?.trim(),
        isPrimary: Boolean(input.isPrimary),
        plannedStartAt,
        plannedEndAt,
        estimatedHours: input.estimatedHours,
        assignmentStatus: WorkOrderAssigneeStatus.ASSIGNED,
        assignedById: actor?.sub,
        assignedAt: new Date(),
        remarks: input.remarks?.trim(),
        leaveOverride: Boolean(input.leaveOverride)
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            designation: true,
            role: { select: { name: true } }
          }
        }
      }
    });

    if (input.isPrimary || !workOrder.technicianId) {
      await this.prisma.workOrder.update({
        where: { id: workOrderId },
        data: { technicianId: input.employeeId }
      });
    }

    await this.recordAudit({
      entity: "WorkOrderAssignee",
      entityId: assignee.id,
      action: AuditAction.CREATE,
      actor,
      reason: "Work order assignee added",
      metadata: {
        event: "work_order_assignee_added",
        workOrderId,
        employeeId: input.employeeId,
        isPrimary: Boolean(input.isPrimary),
        leaveOverride: Boolean(input.leaveOverride)
      },
      afterData: {
        designation: assignee.designation,
        plannedStartAt: assignee.plannedStartAt?.toISOString() ?? null,
        plannedEndAt: assignee.plannedEndAt?.toISOString() ?? null
      }
    });

    return assignee;
  }

  async removeAssignee(workOrderId: string, assigneeId: string, actor?: Actor) {
    await this.assertWorkOrder(workOrderId, actor);
    const tenantId = this.resolveTenantId(actor);

    const assignee = await this.prisma.workOrderAssignee.findFirst({
      where: {
        id: assigneeId,
        workOrderId,
        ...(tenantId !== undefined ? { tenantId } : {})
      }
    });

    if (!assignee || assignee.assignmentStatus === WorkOrderAssigneeStatus.REMOVED) {
      throw new NotFoundException("Assignee not found");
    }

    const updated = await this.prisma.workOrderAssignee.update({
      where: { id: assigneeId },
      data: { assignmentStatus: WorkOrderAssigneeStatus.REMOVED }
    });

    if (assignee.isPrimary) {
      const nextPrimary = await this.prisma.workOrderAssignee.findFirst({
        where: {
          workOrderId,
          assignmentStatus: { not: WorkOrderAssigneeStatus.REMOVED },
          id: { not: assigneeId }
        },
        orderBy: { assignedAt: "asc" }
      });

      await this.prisma.workOrder.update({
        where: { id: workOrderId },
        data: { technicianId: nextPrimary?.employeeId ?? null }
      });

      if (nextPrimary) {
        await this.prisma.workOrderAssignee.update({
          where: { id: nextPrimary.id },
          data: { isPrimary: true }
        });
      }
    }

    await this.recordAudit({
      entity: "WorkOrderAssignee",
      entityId: assigneeId,
      action: AuditAction.DELETE,
      actor,
      reason: "Work order assignee removed",
      metadata: {
        event: "work_order_assignee_removed",
        workOrderId,
        employeeId: assignee.employeeId
      }
    });

    return updated;
  }

  assertLeaveOverridePermission(actorRole?: string | null) {
    const allowed = new Set<string>([
      RoleName.SUPER_ADMIN,
      RoleName.ADMIN,
      RoleName.MANAGER,
      RoleName.OPERATIONS_MANAGER
    ]);

    if (!actorRole || !allowed.has(actorRole)) {
      throw new ForbiddenException("Leave override requires manager permission and is audited");
    }
  }
}
