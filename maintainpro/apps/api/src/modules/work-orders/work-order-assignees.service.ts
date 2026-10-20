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
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import type { JwtPayload } from "../auth/auth.types";
import { WorkforceEmployeesService } from "../workforce/workforce-employees.service";
import { WorkforcePlanningService } from "../workforce/workforce-planning.service";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

type AssignmentDb = Prisma.TransactionClient;

export type AddAssigneeOptions = {
  /** Legacy assign() writes technicianId itself, in the same transaction. */
  deferTechnicianLink?: boolean;
  tx?: AssignmentDb;
};

export type PreparedAssignee = {
  workOrder: { id: string; tenantId: string | null; technicianId: string | null };
  employee: { id: string; designation: string | null; linkedUserId: string | null };
  input: AddWorkOrderAssigneeInput;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
};

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
    return requireTenantId(actor?.tenantId);
  }

  private assignmentDb(db?: AssignmentDb): AssignmentDb | PrismaService {
    return db ?? this.prisma;
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
  }, db?: AssignmentDb) {
    const ctx = requestContext.get();
    await this.assignmentDb(db).auditLog.create({
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
        tenantId
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
        tenantId
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

  /**
   * Reads and eligibility checks only. Callers use this before opening the assignment transaction.
   */
  async prepareAssignee(
    workOrderId: string,
    input: AddWorkOrderAssigneeInput,
    actor?: Actor
  ): Promise<PreparedAssignee> {
    const workOrder = await this.assertWorkOrder(workOrderId, actor);
    if (workOrder.approvalStatus === "REJECTED") {
      throw new BadRequestException("Work order was rejected and cannot be executed");
    }
    if (workOrder.approvalStatus === "PENDING") {
      throw new BadRequestException("Work order requires manager approval before execution");
    }
    const tenantId = this.resolveTenantId(actor);

    const employee = await this.workforceEmployees.assertEligibleForAssignment(
      input.employeeId,
      tenantId,
      input.designation
    );

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

    const existing = await this.prisma.workOrderAssignee.findUnique({
      where: {
        workOrderId_employeeId: {
          workOrderId,
          employeeId: employee.id
        }
      }
    });

    if (existing && existing.assignmentStatus !== WorkOrderAssigneeStatus.REMOVED) {
      throw new BadRequestException("Employee is already assigned to this work order");
    }

    await this.workforcePlanning.assertAssignmentAvailability({
      tenantId: workOrder.tenantId,
      employeeId: employee.id,
      plannedStartAt,
      plannedEndAt,
      estimatedHours: input.estimatedHours,
      leaveOverride: Boolean(input.leaveOverride),
      actorRole: actor?.role,
      availabilityStatus: employee.availabilityStatus
    });

    return {
      workOrder: {
        id: workOrder.id,
        tenantId: workOrder.tenantId,
        technicianId: workOrder.technicianId
      },
      employee: {
        id: employee.id,
        designation: employee.designation,
        linkedUserId: employee.linkedUserId
      },
      input,
      plannedStartAt,
      plannedEndAt
    };
  }

  /**
   * Assignee insert, previous primary flags, optional technician link, and assignee audit.
   * Every statement uses the transaction client passed by the caller.
   */
  async persistAssignee(
    db: AssignmentDb,
    prepared: PreparedAssignee,
    actor?: Actor,
    options?: Pick<AddAssigneeOptions, "deferTechnicianLink">
  ) {
    const { workOrder, employee, input, plannedStartAt, plannedEndAt } = prepared;
    await db.$queryRaw`
      SELECT [id] FROM [WorkOrder] WITH (UPDLOCK, ROWLOCK)
      WHERE [id] = ${workOrder.id} AND [tenantId] = ${workOrder.tenantId}
    `;
    const existing = await db.workOrderAssignee.findUnique({
      where: {
        workOrderId_employeeId: {
          workOrderId: workOrder.id,
          employeeId: employee.id
        }
      }
    });

    if (existing && existing.assignmentStatus !== WorkOrderAssigneeStatus.REMOVED) {
      throw new BadRequestException("Employee is already assigned to this work order");
    }

    if (input.isPrimary) {
      await db.workOrderAssignee.updateMany({
        where: {
          workOrderId: workOrder.id,
          assignmentStatus: { not: WorkOrderAssigneeStatus.REMOVED }
        },
        data: { isPrimary: false }
      });
    }

    const assignee = await db.workOrderAssignee.upsert({
      where: {
        workOrderId_employeeId: {
          workOrderId: workOrder.id,
          employeeId: employee.id
        }
      },
      create: {
        tenantId: workOrder.tenantId,
        workOrderId: workOrder.id,
        employeeId: employee.id,
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

    if (!options?.deferTechnicianLink && (input.isPrimary || !workOrder.technicianId)) {
      await db.workOrder.update({
        where: { id: workOrder.id },
        data: { technicianId: employee.linkedUserId ?? null }
      });
    }

    await this.recordAudit(
      {
        entity: "WorkOrderAssignee",
        entityId: assignee.id,
        action: AuditAction.CREATE,
        actor,
        reason: "Work order assignee added",
        metadata: {
          event: "work_order_assignee_added",
          workOrderId: workOrder.id,
          employeeId: employee.id,
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
      },
      db
    );

    return assignee;
  }

  async addAssignee(
    workOrderId: string,
    input: AddWorkOrderAssigneeInput,
    actor?: Actor,
    options?: AddAssigneeOptions
  ) {
    const prepared = await this.prepareAssignee(workOrderId, input, actor);
    if (options?.tx) {
      return this.persistAssignee(options.tx, prepared, actor, options);
    }
    return this.prisma.$transaction((tx) => this.persistAssignee(tx, prepared, actor, options), {
      maxWait: 5_000,
      timeout: 15_000
    });
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
        tenantId
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
