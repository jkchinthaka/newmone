import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, WorkOrderStatus, WorkOrderType } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "tenantId">;

const BREAKDOWN_TYPES: WorkOrderType[] = [
  WorkOrderType.CORRECTIVE,
  WorkOrderType.EMERGENCY,
  WorkOrderType.ACCIDENT_REPAIR
];

const MAINTENANCE_TYPES: WorkOrderType[] = [
  WorkOrderType.PREVENTIVE,
  WorkOrderType.INSPECTION,
  WorkOrderType.INSTALLATION
];

export type WorkOrderHistoryContext = {
  workOrderId: string;
  hasLinkedTarget: boolean;
  message?: string;
  assetSummary: Record<string, unknown> | null;
  vehicleSummary: Record<string, unknown> | null;
  lastService: Record<string, unknown> | null;
  previousMaintenance: Array<Record<string, unknown>>;
  previousBreakdowns: Array<Record<string, unknown>>;
  previousPartsUsed: Array<Record<string, unknown>>;
  costSummary: {
    totalActualCost: number;
    totalEstimatedCost: number;
    completedJobCount: number;
  };
  meterHistory: Array<Record<string, unknown>>;
  complianceWarnings: Array<Record<string, unknown>>;
  repeatIssueWarnings: Array<{ kind: string; label: string; count: number; windowDays: number }>;
  readOnly: true;
  dataSources: string[];
};

@Injectable()
export class WorkOrderHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveTenantId(actor?: Actor) {
    return requireTenantId(actor?.tenantId);
  }

  private buildTargetFilter(assetId?: string | null, vehicleId?: string | null): Prisma.WorkOrderWhereInput | null {
    const clauses: Prisma.WorkOrderWhereInput[] = [];
    if (assetId) clauses.push({ assetId });
    if (vehicleId) clauses.push({ vehicleId });
    if (clauses.length === 0) return null;
    return clauses.length === 1 ? clauses[0]! : { OR: clauses };
  }

  private mapWorkOrderRow(
    row: {
      id: string;
      woNumber: string;
      title: string;
      description: string;
      type: WorkOrderType;
      status: WorkOrderStatus;
      completedDate: Date | null;
      actualCost: number | null;
      estimatedCost: number | null;
      technician: { firstName: string; lastName: string } | null;
      assignees: Array<{
        isPrimary: boolean;
        employee: { fullName: string; designation: string | null };
      }>;
    }
  ) {
    const primaryAssignee =
      row.assignees.find((item) => item.isPrimary)?.employee ??
      row.assignees[0]?.employee ??
      null;
    const technicianName = primaryAssignee
      ? primaryAssignee.fullName.trim()
      : row.technician
        ? `${row.technician.firstName} ${row.technician.lastName}`.trim()
        : null;

    return {
      id: row.id,
      woNumber: row.woNumber,
      title: row.title,
      description: row.description,
      type: row.type,
      status: row.status,
      completedDate: row.completedDate?.toISOString() ?? null,
      actualCost: row.actualCost,
      estimatedCost: row.estimatedCost,
      technicianName,
      designation: primaryAssignee?.designation ?? null
    };
  }

  private detectRepeatIssues(
    rows: Array<{ type: WorkOrderType; title: string }>,
    windowDays: number
  ): WorkOrderHistoryContext["repeatIssueWarnings"] {
    const warnings: WorkOrderHistoryContext["repeatIssueWarnings"] = [];

    const typeCounts = new Map<WorkOrderType, number>();
    const titleCounts = new Map<string, number>();

    for (const row of rows) {
      typeCounts.set(row.type, (typeCounts.get(row.type) ?? 0) + 1);
      const normalizedTitle = row.title.trim().toLowerCase();
      if (normalizedTitle.length >= 4) {
        titleCounts.set(normalizedTitle, (titleCounts.get(normalizedTitle) ?? 0) + 1);
      }
    }

    for (const [type, count] of typeCounts.entries()) {
      if (count > 2) {
        warnings.push({
          kind: "category",
          label: `Repeated ${type.replaceAll("_", " ").toLowerCase()} work orders (${count} in ${windowDays} days)`,
          count,
          windowDays
        });
      }
    }

    for (const [title, count] of titleCounts.entries()) {
      if (count > 2) {
        warnings.push({
          kind: "issue",
          label: `Repeated issue "${title}" (${count} in ${windowDays} days)`,
          count,
          windowDays
        });
      }
    }

    return warnings;
  }

  async getHistory(workOrderId: string, actor?: Actor): Promise<WorkOrderHistoryContext> {
    const tenantId = this.resolveTenantId(actor);
    const workOrder = await this.prisma.workOrder.findFirst({
      where: {
        id: workOrderId,
        tenantId
      },
      include: {
        asset: {
          select: {
            id: true,
            assetTag: true,
            name: true,
            category: true,
            status: true,
            lastServiceDate: true,
            nextServiceDate: true,
            meterReading: true,
            location: true
          }
        },
        vehicle: {
          select: {
            id: true,
            registrationNo: true,
            vehicleModel: true,
            status: true,
            currentMileage: true,
            nextServiceDate: true,
            nextServiceMileage: true,
            serviceStatus: true
          }
        }
      }
    });

    if (!workOrder) {
      throw new NotFoundException("Work order not found");
    }

    const emptyBase: WorkOrderHistoryContext = {
      workOrderId,
      hasLinkedTarget: false,
      message: "No asset or vehicle linked to this work order.",
      assetSummary: null,
      vehicleSummary: null,
      lastService: null,
      previousMaintenance: [],
      previousBreakdowns: [],
      previousPartsUsed: [],
      costSummary: { totalActualCost: 0, totalEstimatedCost: 0, completedJobCount: 0 },
      meterHistory: [],
      complianceWarnings: [],
      repeatIssueWarnings: [],
      readOnly: true,
      dataSources: []
    };

    if (!workOrder.assetId && !workOrder.vehicleId) {
      return emptyBase;
    }

    const targetFilter = this.buildTargetFilter(workOrder.assetId, workOrder.vehicleId);
    if (!targetFilter) {
      return emptyBase;
    }

    const windowDays = 60;
    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const sharedWhere: Prisma.WorkOrderWhereInput = {
      tenantId,
      id: { not: workOrderId },
      ...targetFilter
    };

    const previousOrders = await this.prisma.workOrder.findMany({
      where: sharedWhere,
      orderBy: [{ completedDate: "desc" }, { createdAt: "desc" }],
      take: 25,
      include: {
        technician: { select: { firstName: true, lastName: true } },
        assignees: {
          where: { assignmentStatus: { not: "REMOVED" } },
          include: { employee: { select: { fullName: true, designation: true } } }
        },
        parts: { include: { part: { select: { id: true, partNumber: true, name: true } } } }
      }
    });

    const recentForRepeat = await this.prisma.workOrder.findMany({
      where: {
        ...sharedWhere,
        createdAt: { gte: since }
      },
      select: { type: true, title: true }
    });

    const maintenanceLogs = await this.prisma.maintenanceLog.findMany({
      where: {
        OR: [
          ...(workOrder.assetId ? [{ assetId: workOrder.assetId }] : []),
          ...(workOrder.vehicleId ? [{ vehicleId: workOrder.vehicleId }] : [])
        ]
      },
      orderBy: { performedAt: "desc" },
      take: 10
    });

    const mappedOrders = previousOrders.map((row) => this.mapWorkOrderRow(row));
    const previousMaintenance = mappedOrders.filter((row) =>
      MAINTENANCE_TYPES.includes(row.type as WorkOrderType)
    );
    const previousBreakdowns = mappedOrders.filter((row) =>
      BREAKDOWN_TYPES.includes(row.type as WorkOrderType)
    );

    const previousPartsUsed = previousOrders.flatMap((row) =>
      row.parts.map((partRow) => ({
        workOrderId: row.id,
        woNumber: row.woNumber,
        partId: partRow.partId,
        partNumber: partRow.part.partNumber,
        partName: partRow.part.name,
        quantity: partRow.quantity,
        totalCost: partRow.totalCost,
        completedDate: row.completedDate?.toISOString() ?? null
      }))
    );

    const completedOrders = previousOrders.filter((row) => row.status === WorkOrderStatus.COMPLETED);
    const costSummary = {
      totalActualCost: completedOrders.reduce((sum, row) => sum + (row.actualCost ?? 0), 0),
      totalEstimatedCost: previousOrders.reduce((sum, row) => sum + (row.estimatedCost ?? 0), 0),
      completedJobCount: completedOrders.length
    };

    const meterHistory = workOrder.vehicleId
      ? (
          await this.prisma.vehicleMeterLog.findMany({
            where: { vehicleId: workOrder.vehicleId },
            orderBy: { createdAt: "desc" },
            take: 12,
            select: {
              id: true,
              reading: true,
              readingType: true,
              source: true,
              createdAt: true
            }
          })
        ).map((row) => ({
          id: row.id,
          reading: row.reading,
          readingType: row.readingType,
          source: row.source,
          recordedAt: row.createdAt.toISOString()
        }))
      : workOrder.asset?.meterReading != null
        ? [
            {
              id: workOrder.asset.id,
              reading: workOrder.asset.meterReading,
              readingType: "ASSET_METER",
              source: "asset_record",
              recordedAt: workOrder.asset.lastServiceDate?.toISOString() ?? null
            }
          ]
        : [];

    const complianceWarnings = workOrder.vehicleId
      ? (
          await this.prisma.vehicleDocument.findMany({
            where: {
              vehicleId: workOrder.vehicleId,
              tenantId,
              OR: [{ status: "EXPIRED" }, { expiryDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } }]
            },
            orderBy: { expiryDate: "asc" },
            take: 8,
            select: {
              id: true,
              documentType: true,
              documentNumber: true,
              expiryDate: true,
              status: true
            }
          })
        ).map((doc) => ({
          id: doc.id,
          documentType: doc.documentType,
          documentNumber: doc.documentNumber,
          expiryDate: doc.expiryDate.toISOString(),
          status: doc.status,
          message:
            doc.status === "EXPIRED" || doc.expiryDate <= new Date()
              ? "Document expired"
              : "Document expiring within 30 days"
        }))
      : [];

    const lastServiceLog = maintenanceLogs[0];
    const lastService = lastServiceLog
      ? {
          description: lastServiceLog.description,
          performedBy: lastServiceLog.performedBy,
          performedAt: lastServiceLog.performedAt.toISOString(),
          cost: lastServiceLog.cost
        }
      : workOrder.asset?.lastServiceDate
        ? {
            description: "Asset last service date on record",
            performedBy: null,
            performedAt: workOrder.asset.lastServiceDate.toISOString(),
            cost: null
          }
        : workOrder.vehicle?.nextServiceDate
          ? {
              description: "Vehicle next service due",
              performedBy: null,
              performedAt: workOrder.vehicle.nextServiceDate.toISOString(),
              cost: null
            }
          : null;

    const repeatIssueWarnings = this.detectRepeatIssues(recentForRepeat, windowDays);
    const hasRecords =
      mappedOrders.length > 0 ||
      maintenanceLogs.length > 0 ||
      previousPartsUsed.length > 0 ||
      meterHistory.length > 0 ||
      complianceWarnings.length > 0;

    return {
      workOrderId,
      hasLinkedTarget: true,
      message: hasRecords ? undefined : "No previous maintenance history found.",
      assetSummary: workOrder.asset
        ? {
            id: workOrder.asset.id,
            assetTag: workOrder.asset.assetTag,
            name: workOrder.asset.name,
            category: workOrder.asset.category,
            status: workOrder.asset.status,
            lastServiceDate: workOrder.asset.lastServiceDate?.toISOString() ?? null,
            nextServiceDate: workOrder.asset.nextServiceDate?.toISOString() ?? null,
            meterReading: workOrder.asset.meterReading,
            location: workOrder.asset.location
          }
        : null,
      vehicleSummary: workOrder.vehicle
        ? {
            id: workOrder.vehicle.id,
            registrationNo: workOrder.vehicle.registrationNo,
            vehicleModel: workOrder.vehicle.vehicleModel,
            status: workOrder.vehicle.status,
            currentMileage: workOrder.vehicle.currentMileage,
            nextServiceDate: workOrder.vehicle.nextServiceDate?.toISOString() ?? null,
            nextServiceMileage: workOrder.vehicle.nextServiceMileage,
            serviceStatus: workOrder.vehicle.serviceStatus
          }
        : null,
      lastService,
      previousMaintenance,
      previousBreakdowns,
      previousPartsUsed,
      costSummary,
      meterHistory,
      complianceWarnings,
      repeatIssueWarnings,
      readOnly: true,
      dataSources: [
        "WorkOrder",
        "MaintenanceLog",
        "WorkOrderPart",
        ...(workOrder.vehicleId ? ["VehicleMeterLog", "VehicleDocument"] : []),
        ...(workOrder.assetId ? ["Asset"] : [])
      ]
    };
  }
}
