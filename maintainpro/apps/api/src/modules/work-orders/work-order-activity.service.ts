import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { buildWorkOrderActivityTimeline } from "./work-order-activity.mapper";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

const WORK_ORDER_ACTIVITY_SELECT = {
  id: true,
  tenantId: true,
  woNumber: true,
  title: true,
  status: true,
  priority: true,
  createdAt: true,
  dueDate: true,
  startDate: true,
  completedDate: true,
  slaDeadline: true,
  createdBy: {
    select: {
      firstName: true,
      lastName: true
    }
  },
  technician: {
    select: {
      firstName: true,
      lastName: true
    }
  },
  facilityIssue: {
    select: {
      id: true,
      tenantId: true,
      title: true,
      description: true,
      category: true,
      severity: true,
      status: true,
      createdAt: true,
      firstResponseAt: true,
      resolvedAt: true,
      workOrderId: true,
      room: {
        select: {
          name: true
        }
      },
      location: {
        select: {
          name: true
        }
      },
      reportedBy: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  },
  partRequests: {
    select: {
      id: true,
      createdAt: true,
      status: true,
      requestedQuantity: true,
      part: {
        select: {
          name: true,
          partNumber: true
        }
      },
      requestedBy: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: {
      createdAt: "asc" as const
    },
    take: 10
  }
} as const;

@Injectable()
export class WorkOrderActivityService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveTenantId(actor?: Actor): string | null | undefined {
    if (!actor) {
      return undefined;
    }

    return actor.tenantId ?? null;
  }

  async getActivityTimeline(workOrderId: string, actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    const where: { id: string; tenantId?: string | null } = { id: workOrderId };

    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }

    const workOrder = await this.prisma.workOrder.findFirst({
      where,
      select: WORK_ORDER_ACTIVITY_SELECT
    });

    if (!workOrder) {
      throw new NotFoundException("Work order not found");
    }

    return buildWorkOrderActivityTimeline(workOrder);
  }
}
