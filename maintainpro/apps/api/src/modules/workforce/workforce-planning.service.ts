import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import {
  EmployeeAvailabilityStatus,
  LeaveRequestStatus,
  Prisma,
  RoleName,
  WorkOrderAssigneeStatus,
  WorkOrderStatus
} from "@prisma/client";

import { calculateSlaRisk } from "../../common/utils/work-order-validation";
import { matchesWorkforceDesignation } from "../../common/utils/workforce-designation";
import { PrismaService } from "../../database/prisma.service";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

@Injectable()
export class WorkforcePlanningService {
  constructor(private readonly prisma: PrismaService) {}

  async hasApprovedLeave(input: {
    tenantId?: string | null;
    employeeId: string;
    from: Date;
    to: Date;
  }): Promise<boolean> {
    const leave = await this.prisma.employeeLeaveRequest.findFirst({
      where: {
        employeeId: input.employeeId,
        status: LeaveRequestStatus.APPROVED,
        ...(input.tenantId !== undefined && input.tenantId !== null ? { tenantId: input.tenantId } : {}),
        startDate: { lte: input.to },
        endDate: { gte: input.from }
      }
    });

    return Boolean(leave);
  }

  async getAllocatedHoursForDay(input: {
    tenantId?: string | null;
    employeeId: string;
    day: Date;
    excludeAssigneeId?: string;
  }): Promise<number> {
    const dayStart = startOfDayUtc(input.day);
    const dayEnd = endOfDayUtc(input.day);

    const rows = await this.prisma.workOrderAssignee.findMany({
      where: {
        employeeId: input.employeeId,
        assignmentStatus: { in: [WorkOrderAssigneeStatus.ASSIGNED, WorkOrderAssigneeStatus.IN_PROGRESS] },
        ...(input.tenantId !== undefined && input.tenantId !== null ? { tenantId: input.tenantId } : {}),
        ...(input.excludeAssigneeId ? { id: { not: input.excludeAssigneeId } } : {}),
        OR: [
          {
            plannedStartAt: { lte: dayEnd },
            plannedEndAt: { gte: dayStart }
          },
          {
            plannedStartAt: null,
            plannedEndAt: null,
            estimatedHours: { not: null }
          }
        ]
      },
      select: { estimatedHours: true, plannedStartAt: true, plannedEndAt: true }
    });

    return rows.reduce((sum, row) => sum + (row.estimatedHours ?? 0), 0);
  }

  async assertAssignmentAvailability(input: {
    tenantId?: string | null;
    employeeId: string;
    plannedStartAt?: Date | null;
    plannedEndAt?: Date | null;
    estimatedHours?: number;
    leaveOverride?: boolean;
    actorRole?: string | null;
  }) {
    const rangeStart = input.plannedStartAt ?? new Date();
    const rangeEnd = input.plannedEndAt ?? input.plannedStartAt ?? new Date();

    const onLeave = await this.hasApprovedLeave({
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      from: startOfDayUtc(rangeStart),
      to: endOfDayUtc(rangeEnd)
    });

    if (onLeave) {
      if (!input.leaveOverride) {
        throw new BadRequestException(
          "Employee has approved leave during the planned assignment window. Use leave override with manager permission to proceed."
        );
      }

      const allowed = new Set<string>([
        RoleName.SUPER_ADMIN,
        RoleName.ADMIN,
        RoleName.MANAGER,
        RoleName.OPERATIONS_MANAGER
      ]);

      if (!input.actorRole || !allowed.has(input.actorRole)) {
        throw new ForbiddenException("Leave override requires manager permission");
      }
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: input.employeeId },
      select: { dailyCapacityHours: true, active: true }
    });

    if (!employee?.active) {
      throw new BadRequestException("Inactive employees cannot be assigned");
    }

    const capacity = employee?.dailyCapacityHours ?? 8;
    const checkDay = input.plannedStartAt ?? new Date();
    const allocated = await this.getAllocatedHoursForDay({
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      day: checkDay
    });
    const incoming = input.estimatedHours ?? 0;

    if (allocated + incoming > capacity) {
      throw new BadRequestException(
        `Assignment exceeds daily capacity (${allocated + incoming}h / ${capacity}h). Reduce hours or choose another employee.`
      );
    }
  }

  async listEmployeesByDesignation(tenantId: string | null | undefined, designation?: string) {
    const rows = await this.prisma.employee.findMany({
      where: {
        active: true,
        canReceiveWorkOrders: true,
        availabilityStatus: EmployeeAvailabilityStatus.AVAILABLE,
        ...(tenantId !== undefined && tenantId !== null ? { tenantId } : {})
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        designation: true,
        skills: true,
        dailyCapacityHours: true,
        departmentId: true,
        branchName: true,
        canLogin: true,
        linkedUserId: true,
        department: { select: { id: true, name: true, code: true } },
        linkedUser: { select: { role: { select: { name: true } } } }
      },
      orderBy: [{ designation: "asc" }, { fullName: "asc" }]
    });

    const enriched = await Promise.all(
      rows.map(async (row) => {
        const effectiveDesignation = row.designation;
        const todayAllocatedHours = await this.getAllocatedHoursForDay({
          tenantId,
          employeeId: row.id,
          day: new Date()
        });
        const capacity = row.dailyCapacityHours ?? 8;
        const workloadPercentage = Math.min(100, Math.round((todayAllocatedHours / capacity) * 100));

        return {
          id: row.id,
          fullName: row.fullName,
          email: row.email,
          phone: row.phone,
          designation: row.designation,
          skills: row.skills,
          dailyCapacityHours: row.dailyCapacityHours,
          departmentId: row.departmentId,
          branchName: row.branchName,
          canLogin: row.canLogin,
          linkedUserId: row.linkedUserId,
          department: row.department,
          roleName: row.linkedUser?.role.name ?? null,
          effectiveDesignation,
          todayAllocatedHours,
          workloadPercentage,
          availabilityLabel:
            workloadPercentage >= 90
              ? "High load"
              : workloadPercentage >= 70
                ? "Busy"
                : "Available"
        };
      })
    );

    return enriched.filter((row) =>
      matchesWorkforceDesignation({ designation: row.designation }, designation)
    );
  }

  async previewAssignment(input: {
    tenantId?: string | null;
    employeeId: string;
    plannedStartAt?: string;
    plannedEndAt?: string;
    estimatedHours?: number;
  }) {
    const rangeStart = input.plannedStartAt ? new Date(input.plannedStartAt) : new Date();
    const rangeEnd = input.plannedEndAt ? new Date(input.plannedEndAt) : rangeStart;

    const onApprovedLeave = await this.hasApprovedLeave({
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      from: startOfDayUtc(rangeStart),
      to: endOfDayUtc(rangeEnd)
    });

    const employee = await this.prisma.employee.findUnique({
      where: { id: input.employeeId },
      select: { dailyCapacityHours: true, active: true }
    });

    const capacity = employee?.dailyCapacityHours ?? 8;
    const todayAllocatedHours = await this.getAllocatedHoursForDay({
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      day: input.plannedStartAt ? new Date(input.plannedStartAt) : new Date()
    });
    const incomingHours = input.estimatedHours ?? 0;

    return {
      onApprovedLeave,
      todayAllocatedHours,
      dailyCapacityHours: capacity,
      incomingHours,
      exceedsDailyCapacity: todayAllocatedHours + incomingHours > capacity,
      inactive: employee ? !employee.active : true
    };
  }

  async getWorkloadSummary(
    actor: Actor,
    filters: {
      designation?: string;
      departmentId?: string;
      branchName?: string;
      from?: string;
      to?: string;
      overdueOnly?: boolean;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    const employeeWhere: Prisma.EmployeeWhereInput = {
      active: true,
      tenantId,
      ...(filters.designation?.trim()
        ? { designation: { equals: filters.designation.trim(), mode: "insensitive" } }
        : {}),
      ...(filters.departmentId?.trim() ? { departmentId: filters.departmentId.trim() } : {}),
      ...(filters.branchName?.trim()
        ? { branchName: { equals: filters.branchName.trim(), mode: "insensitive" } }
        : {})
    };

    const employees = await this.prisma.employee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        fullName: true,
        designation: true,
        dailyCapacityHours: true,
        departmentId: true,
        branchName: true
      }
    });

    const results = [];

    for (const employee of employees) {
      const assigneeRows = await this.prisma.workOrderAssignee.findMany({
        where: {
          employeeId: employee.id,
          assignmentStatus: { in: [WorkOrderAssigneeStatus.ASSIGNED, WorkOrderAssigneeStatus.IN_PROGRESS] },
          tenantId,
          workOrder: {
            status: { in: [WorkOrderStatus.OPEN, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ON_HOLD, WorkOrderStatus.OVERDUE] }
          }
        },
        include: {
          workOrder: {
            select: {
              id: true,
              status: true,
              dueDate: true,
              expectedCompletionDate: true,
              plannedEndAt: true
            }
          }
        }
      });

      let pendingCount = 0;
      let inProgressCount = 0;
      let overdueCount = 0;

      for (const row of assigneeRows) {
        if (row.workOrder.status === WorkOrderStatus.IN_PROGRESS) {
          inProgressCount += 1;
        } else {
          pendingCount += 1;
        }

        const risk = calculateSlaRisk({
          dueDate: row.workOrder.dueDate,
          expectedCompletionDate: row.workOrder.expectedCompletionDate,
          plannedEndAt: row.workOrder.plannedEndAt ?? row.plannedEndAt,
          status: row.workOrder.status
        });

        if (risk.level === "OVERDUE") {
          overdueCount += 1;
        }
      }

      const todayAllocatedHours = await this.getAllocatedHoursForDay({
        tenantId,
        employeeId: employee.id,
        day: now
      });

      const monthlyCompleted = await this.prisma.workOrderAssignee.count({
        where: {
          employeeId: employee.id,
          assignmentStatus: WorkOrderAssigneeStatus.COMPLETED,
          updatedAt: { gte: monthStart, lte: monthEnd },
          tenantId
        }
      });

      const capacity = employee.dailyCapacityHours ?? 8;
      const workloadPercentage = Math.min(100, Math.round((todayAllocatedHours / capacity) * 100));

      if (filters.overdueOnly && overdueCount === 0) {
        continue;
      }

      results.push({
        employeeId: employee.id,
        employeeName: employee.fullName,
        designation: employee.designation,
        departmentId: employee.departmentId,
        branchName: employee.branchName,
        pendingCount,
        inProgressCount,
        overdueCount,
        todayAllocatedHours,
        monthlyCompletedTasks: monthlyCompleted,
        workloadPercentage
      });
    }

    return {
      generatedAt: now.toISOString(),
      filters,
      rows: results.sort((a, b) => b.overdueCount - a.overdueCount || b.workloadPercentage - a.workloadPercentage)
    };
  }
}
