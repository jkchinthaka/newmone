import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import type { RoleName } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { closeLabourSessionTimestamps } from "../../common/utils/work-order-labour.util";
import { canOverrideCompletionBlock } from "../../common/utils/work-order-evidence-rbac";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { assertNotLockedForTechnician } from "./work-order-edit-rights";
import { minutesBetween, TASK_STATUSES, type WorkOrderTaskStatus } from "./work-order-tasks.util";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

export type TaskInput = {
  title?: string;
  employeeIds?: string[];
  estimatedHours?: number | null;
};

const TASK_INCLUDE = {
  assignees: { include: { employee: { select: { id: true, fullName: true, linkedUserId: true } } } }
} as const;

@Injectable()
export class WorkOrderTasksService {
  constructor(private readonly prisma: PrismaService) {}

  private tenant(actor?: Actor) {
    return requireTenantId(requestContext.getTenantId() ?? actor?.tenantId);
  }

  private isManager(actor?: Actor) {
    return canOverrideCompletionBlock(actor?.role as RoleName);
  }

  private async assertWorkOrder(workOrderId: string, tenantId: string) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      select: { id: true, status: true }
    });
    if (!wo) throw new NotFoundException("Work order not found");
    return wo;
  }

  private cleanTitle(title?: string) {
    const t = title?.trim();
    if (!t) throw new BadRequestException("Task title is required");
    if (t.length > 300) throw new BadRequestException("Task title is too long");
    return t;
  }

  private cleanHours(h?: number | null) {
    if (h == null) return null;
    if (!Number.isFinite(h) || h < 0 || h > 1000) throw new BadRequestException("Hours must be between 0 and 1000");
    return h;
  }

  private async assertEmployees(employeeIds: string[], tenantId: string) {
    const ids = [...new Set(employeeIds.filter(Boolean))];
    if (!ids.length) return ids;
    const found = await this.prisma.employee.count({ where: { id: { in: ids }, tenantId } });
    if (found !== ids.length) throw new BadRequestException("One or more people were not found");
    return ids;
  }

  private shape(task: {
    id: string;
    title: string;
    status: string;
    sortOrder: number;
    estimatedHours: number | null;
    startedAt: Date | null;
    completedAt: Date | null;
    timeSpentMinutes: number | null;
    assignees: Array<{ employee: { id: string; fullName: string; linkedUserId: string | null } }>;
  }, actor?: Actor) {
    const mine = Boolean(actor) && task.assignees.some((a) => a.employee.linkedUserId === actor?.sub);
    return {
      id: task.id,
      title: task.title,
      status: task.status as WorkOrderTaskStatus,
      sortOrder: task.sortOrder,
      estimatedHours: task.estimatedHours,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      timeSpentMinutes: task.timeSpentMinutes,
      assignees: task.assignees.map((a) => ({ employeeId: a.employee.id, fullName: a.employee.fullName })),
      isMine: mine
    };
  }

  async list(workOrderId: string, actor?: Actor) {
    const tenantId = this.tenant(actor);
    await this.assertWorkOrder(workOrderId, tenantId);
    let rows;
    try {
      rows = await this.prisma.workOrderTask.findMany({
        where: { workOrderId, tenantId },
        include: TASK_INCLUDE,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      });
    } catch (err) {
      // Table missing (migration not applied) or Prisma client not regenerated yet.
      throw new ServiceUnavailableException(
        "Job tasks need a database update. Run: npm run db:generate and npm run db:migrate:deploy, then restart the API."
      );
    }
    const tasks = rows.map((r) => this.shape(r, actor));
    return { tasks, done: tasks.filter((t) => t.status === "DONE").length, total: tasks.length };
  }

  async add(workOrderId: string, input: TaskInput, actor?: Actor) {
    const tenantId = this.tenant(actor);
    const wo = await this.assertWorkOrder(workOrderId, tenantId);
    assertNotLockedForTechnician(wo.status, actor?.role);
    const title = this.cleanTitle(input.title);
    const hours = this.cleanHours(input.estimatedHours);
    const employeeIds = await this.assertEmployees(input.employeeIds ?? [], tenantId);
    const last = await this.prisma.workOrderTask.aggregate({
      where: { workOrderId },
      _max: { sortOrder: true }
    });
    const created = await this.prisma.workOrderTask.create({
      data: {
        tenantId,
        workOrderId,
        title,
        estimatedHours: hours,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        createdById: actor?.sub ?? null,
        assignees: { create: employeeIds.map((employeeId) => ({ employeeId })) }
      },
      include: TASK_INCLUDE
    });
    return this.shape(created, actor);
  }

  private async loadTask(workOrderId: string, taskId: string, tenantId: string) {
    const task = await this.prisma.workOrderTask.findFirst({
      where: { id: taskId, workOrderId, tenantId },
      include: TASK_INCLUDE
    });
    if (!task) throw new NotFoundException("Task not found");
    return task;
  }

  async update(workOrderId: string, taskId: string, input: TaskInput, actor?: Actor) {
    const tenantId = this.tenant(actor);
    const wo = await this.assertWorkOrder(workOrderId, tenantId);
    assertNotLockedForTechnician(wo.status, actor?.role);
    await this.loadTask(workOrderId, taskId, tenantId);
    const data: { title?: string; estimatedHours?: number | null } = {};
    if (input.title !== undefined) data.title = this.cleanTitle(input.title);
    if (input.estimatedHours !== undefined) data.estimatedHours = this.cleanHours(input.estimatedHours);
    const employeeIds = input.employeeIds ? await this.assertEmployees(input.employeeIds, tenantId) : null;
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) await tx.workOrderTask.update({ where: { id: taskId }, data });
      if (employeeIds) {
        await tx.workOrderTaskAssignee.deleteMany({ where: { taskId } });
        if (employeeIds.length) {
          await tx.workOrderTaskAssignee.createMany({ data: employeeIds.map((employeeId) => ({ taskId, employeeId })) });
        }
      }
    });
    return this.shape(await this.loadTask(workOrderId, taskId, tenantId), actor);
  }

  async remove(workOrderId: string, taskId: string, actor?: Actor) {
    const tenantId = this.tenant(actor);
    const wo = await this.assertWorkOrder(workOrderId, tenantId);
    assertNotLockedForTechnician(wo.status, actor?.role);
    await this.loadTask(workOrderId, taskId, tenantId);
    await this.prisma.workOrderTask.delete({ where: { id: taskId } });
    return { id: taskId };
  }

  /** Assigned people (or a manager) move a task NOT_STARTED -> WORKING -> DONE. Other tasks stay untouched. */
  async setStatus(workOrderId: string, taskId: string, status: string, actor?: Actor) {
    if (!TASK_STATUSES.includes(status as WorkOrderTaskStatus)) {
      throw new BadRequestException("Status must be NOT_STARTED, WORKING or DONE");
    }
    const tenantId = this.tenant(actor);
    const wo = await this.assertWorkOrder(workOrderId, tenantId);
    assertNotLockedForTechnician(wo.status, actor?.role);
    const task = await this.loadTask(workOrderId, taskId, tenantId);
    const mine = task.assignees.some((a) => a.employee.linkedUserId === actor?.sub);
    if (!mine && !this.isManager(actor)) {
      throw new ForbiddenException("Only people assigned to this task can update it");
    }
    if (task.status === status) return this.shape(task, actor);

    const now = new Date();
    const patch: Record<string, unknown> = { status };
    if (status === "WORKING") {
      patch.startedAt = task.startedAt ?? now;
      patch.completedAt = null;
      patch.completedById = null;
    } else if (status === "DONE") {
      const started = task.startedAt ?? now;
      patch.startedAt = started;
      patch.completedAt = now;
      patch.completedById = actor?.sub ?? null;
      patch.timeSpentMinutes = minutesBetween(started, now);
    } else {
      patch.startedAt = null;
      patch.completedAt = null;
      patch.completedById = null;
      patch.timeSpentMinutes = null;
    }
    await this.prisma.workOrderTask.update({ where: { id: taskId }, data: patch });
    if (mine && actor?.sub && (status === "WORKING" || status === "DONE")) {
      await this.syncLabourSession(workOrderId, actor.sub, tenantId, status);
    }
    return this.shape(await this.loadTask(workOrderId, taskId, tenantId), actor);
  }

  /**
   * Keeps the person's labour clock in step with their tasks so actual hours/cost stay correct
   * with one click. Best effort: it never blocks the task change and never touches other people.
   * Start task -> open a session if they have none running anywhere. Last open task done -> close it.
   */
  private async syncLabourSession(
    workOrderId: string,
    userId: string,
    tenantId: string,
    status: "WORKING" | "DONE"
  ) {
    try {
      if (status === "WORKING") {
        const running = await this.prisma.workOrderLabourEntry.findFirst({
          where: { tenantId, technicianUserId: userId, endedAt: null },
          select: { id: true }
        });
        if (!running) {
          await this.prisma.workOrderLabourEntry.create({
            data: { tenantId, workOrderId, technicianUserId: userId, startedAt: new Date() }
          });
        }
        return;
      }
      const stillOpen = await this.prisma.workOrderTask.count({
        where: {
          workOrderId,
          status: { not: "DONE" },
          assignees: { some: { employee: { linkedUserId: userId } } }
        }
      });
      if (stillOpen > 0) return;
      const open = await this.prisma.workOrderLabourEntry.findMany({
        where: { tenantId, workOrderId, technicianUserId: userId, endedAt: null },
        select: { id: true, startedAt: true }
      });
      for (const entry of open) {
        await this.prisma.workOrderLabourEntry.update({
          where: { id: entry.id },
          data: closeLabourSessionTimestamps(entry.startedAt)
        });
      }
    } catch {
      // Task status already saved; the labour clock can still be started/stopped by hand.
    }
  }
}
