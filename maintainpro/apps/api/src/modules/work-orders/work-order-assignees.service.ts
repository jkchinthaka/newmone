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
import { matchesWorkforceDesignation } from "../../common/utils/workforce-designation";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { WorkforceEmployeesService } from "../workforce/workforce-employees.service";
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
  leaveOverrideReason?: string;
};

@Injectable()
export class WorkOrderAssigneesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workforcePlanning: WorkforcePlanningService,
    private readonly workforceEmployees: WorkforceEmployeesService
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

  private async assertWorkOrder(id: string, actor?: Actor, options?: { allowClosed?: boolean }) {
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
      !options?.allowClosed &&
      (workOrder.status === WorkOrderStatus.COMPLETED ||
        workOrder.status === WorkOrderStatus.CANCELLED)
    ) {
      throw new BadRequestException("Cannot modify assignees on a closed work order");
    }

    return workOrder;
  }

  async listAssignees(workOrderId: string, actor?: Actor) {
    await this.assertWorkOrder(workOrderId, actor, { allowClosed: true });
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
            fullName: true,
            designation: true,
            email: true,
            branchName: true,
            department: { select: { id: true, name: true, code: true } },
            linkedUserId: true
          }
        }
      },
      orderBy: [{ isPrimary: "desc" }, { assignedAt: "asc" }]
    });
  }

  async addAssignee(workOrderId: string, input: AddWorkOrderAssigneeInput, actor?: Actor) {
    const workOrder = await this.assertWorkOrder(workOrderId, actor);
    const tenantId = this.resolveTenantId(actor);

    const employee = await this.workforceEmployees.resolveAssignableEmployee(input.employeeId, tenantId);

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    if (input.designation?.trim()) {
      const matches = matchesWorkforceDesignation({ designation: employee.designation }, input.designation);
      if (!matches) {
        throw new BadRequestException(
          `Employee designation "${employee.designation}" does not match required "${input.designation}"`
        );
      }
    }

    const plannedStartAt = input.plannedStartAt ? new Date(input.plannedStartAt) : null;
    const plannedEndAt = input.plannedEndAt ? new Date(input.plannedEndAt) : null;

    if (plannedStartAt && plannedEndAt && plannedEndAt.getTime() <= plannedStartAt.getTime()) {
      throw new BadRequestException("Planned end must be after planned start");
    }

    if (input.estimatedHours !== undefined && input.estimatedHours <= 0) {
      throw new BadRequestException("Estimated hours must be greater than 0");
    }

    if (input.leaveOverride) {
      this.assertLeaveOverridePermission(actor?.role);
      if (!input.leaveOverrideReason?.trim()) {
        throw new BadRequestException("Leave override reason is required when overriding approved leave");
      }
    }

    const workforceEmployeeId = employee.id;

    const existing = await this.prisma.workOrderAssignee.findUnique({
      where: {
        workOrderId_employeeId: {
          workOrderId,
          employeeId: workforceEmployeeId
        }
      }
    });

    if (existing && existing.assignmentStatus !== WorkOrderAssigneeStatus.REMOVED) {
      throw new BadRequestException("Employee is already assigned to this work order");
    }

    await this.workforcePlanning.assertAssignmentAvailability({
      tenantId: workOrder.tenantId,
      employeeId: workforceEmployeeId,
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
          employeeId: workforceEmployeeId
        }
      },
      create: {
        tenantId: workOrder.tenantId,
        workOrderId,
        employeeId: workforceEmployeeId,
        designation: input.designation?.trim() || employee.designation,
        roleInTask: input.roleInTask?.trim(),
        isPrimary: Boolean(input.isPrimary),
        plannedStartAt,
        plannedEndAt,
        estimatedHours: input.estimatedHours,
        assignmentStatus: WorkOrderAssigneeStatus.ASSIGNED,
        assignedById: actor?.sub,
        remarks: input.leaveOverride
          ? [input.leaveOverrideReason?.trim(), input.remarks?.trim()].filter(Boolean).join(" | ")
          : input.remarks?.trim(),
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
        remarks: input.leaveOverride
          ? [input.leaveOverrideReason?.trim(), input.remarks?.trim()].filter(Boolean).join(" | ")
          : input.remarks?.trim(),
        leaveOverride: Boolean(input.leaveOverride)
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            designation: true,
            branchName: true,
            department: { select: { id: true, name: true, code: true } }
          }
        }
      }
    });

    if (input.isPrimary || !workOrder.technicianId) {
      await this.prisma.workOrder.update({
        where: { id: workOrderId },
        data: { technicianId: employee.linkedUserId ?? null }
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
        employeeId: workforceEmployeeId,
        isPrimary: Boolean(input.isPrimary),
        leaveOverride: Boolean(input.leaveOverride),
        leaveOverrideReason: input.leaveOverrideReason?.trim() ?? null
      },
      afterData: {
        designation: assignee.designation,
        plannedStartAt: assignee.plannedStartAt?.toISOString() ?? null,
        plannedEndAt: assignee.plannedEndAt?.toISOString() ?? null,
        leaveOverrideReason: input.leaveOverrideReason?.trim() ?? null
      }
    });

    return assignee;
  }

  async removeAssignee(workOrderId: string, assigneeId: string, actor?: Actor, reason?: string) {
    await this.assertWorkOrder(workOrderId, actor, { allowClosed: true });
    const trimmedReason = reason?.trim();
    if (!trimmedReason || trimmedReason.length < 3) {
      throw new BadRequestException("Reason is required when removing an assignee (minimum 3 characters).");
    }
    const tenantId = this.resolveTenantId(actor);

    const assignee = await this.prisma.workOrderAssignee.findFirst({
      where: {
        id: assigneeId,
        workOrderId,
        ...(tenantId !== undefined ? { tenantId } : {})
      },
      include: {
        employee: { select: { linkedUserId: true } }
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
        orderBy: { assignedAt: "asc" },
        include: { employee: { select: { linkedUserId: true } } }
      });

      await this.prisma.workOrder.update({
        where: { id: workOrderId },
        data: { technicianId: nextPrimary?.employee.linkedUserId ?? null }
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
      reason: trimmedReason,
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
