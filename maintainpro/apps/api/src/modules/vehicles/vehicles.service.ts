import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  AuditAction,
  GateMovementStatus,
  GateMovementType,
  Prisma,
  RoleName,
  TripStatus,
  VehicleMeterReadingType,
  VehicleServiceStatus,
  VehicleStatus
} from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { PrismaService } from "../../database/prisma.service";
import { ComplianceService } from "../compliance/compliance.service";
import { FleetService } from "../fleet/fleet.service";

type VehicleListSortBy = "mileage" | "nextServiceDate" | "year" | "createdAt";

interface VehicleListQuery {
  q?: string;
  status?: VehicleStatus[];
  sortBy?: VehicleListSortBy;
  sortDir?: Prisma.SortOrder;
  page?: number;
  pageSize?: number;
}

interface VehicleHistoryQuery {
  from?: string;
  to?: string;
  limit?: number;
}

interface VehicleMeterLogQuery {
  limit?: number;
}

export interface ServiceWindowEvaluation {
  overdue: boolean;
  dueSoon: boolean;
  reason: "MILEAGE" | "DATE" | "STATUS" | "NONE";
  dueAt: Date | null;
  remainingMileage: number | null;
}

export type VehicleAlertType = "UPCOMING_SERVICE" | "OVERDUE_MAINTENANCE" | "STATUS_CHANGE";
export type VehicleAlertSeverity = "info" | "warning" | "critical";

export interface VehicleAlert {
  id: string;
  type: VehicleAlertType;
  severity: VehicleAlertSeverity;
  vehicleId: string;
  registrationNo: string;
  title: string;
  message: string;
  status: VehicleStatus;
  dueAt: Date | null;
  createdAt: Date;
}

const DEFAULT_LIST_PAGE_SIZE = 12;
const MAX_LIST_PAGE_SIZE = 100;
const DEFAULT_SERVICE_ALERT_DAYS = 14;
const DEFAULT_SERVICE_ALERT_MILEAGE = 500;
const MAX_METER_LOG_LIMIT = 500;

@Injectable()
export class VehiclesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FleetService) private readonly fleetService: FleetService,
    @Inject(ComplianceService) private readonly complianceService: ComplianceService
  ) {}

  private currentTenantId(): string | null {
    return requestContext.get()?.tenantId ?? null;
  }

  async findAll(query: VehicleListQuery = {}) {
    const tenantId = this.currentTenantId();
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_LIST_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_LIST_PAGE_SIZE));
    const q = query.q?.trim() ?? "";
    const sortBy = query.sortBy ?? "createdAt";
    const sortDir = query.sortDir ?? "desc";

    const where: Prisma.VehicleWhereInput = tenantId ? { tenantId } : {};

    if (q) {
      where.OR = [
        { registrationNo: { contains: q, mode: "insensitive" } },
        { vehicleModel: { contains: q, mode: "insensitive" } },
        { make: { contains: q, mode: "insensitive" } },
        { assetTag: { contains: q, mode: "insensitive" } }
      ];
    }

    if (query.status && query.status.length > 0) {
      where.status = { in: query.status };
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.vehicle.count({ where }),
      this.prisma.vehicle.findMany({
        where,
        include: { driver: { include: { user: true } } },
        orderBy: this.resolveListOrderBy(sortBy, sortDir),
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages
      },
      sorting: {
        sortBy,
        sortDir
      }
    };
  }

  async summary(upcomingDays = 14) {
    const tenantId = this.currentTenantId();
    const normalizedUpcomingDays = Math.max(1, upcomingDays);

    const [totalVehicles, groupedByStatus, serviceCandidates] = await this.prisma.$transaction([
      this.prisma.vehicle.count({
        where: tenantId ? { tenantId } : {}
      }),
      this.prisma.vehicle.groupBy({
        where: tenantId ? { tenantId } : {},
        by: ["status"],
        orderBy: {
          status: "asc"
        },
        _count: {
          _all: true
        }
      }),
      this.prisma.vehicle.findMany({
        where: {
          ...(tenantId ? { tenantId } : {}),
          status: {
            not: VehicleStatus.DISPOSED
          }
        },
        select: {
          currentMileage: true,
          nextServiceDate: true,
          nextServiceMileage: true,
          serviceStatus: true
        }
      })
    ]);

    let upcomingServices = 0;
    let overdueMaintenance = 0;
    for (const vehicle of serviceCandidates) {
      const evaluation = this.evaluateServiceWindow(vehicle, {
        leadDays: normalizedUpcomingDays
      });

      if (evaluation.overdue) {
        overdueMaintenance += 1;
      } else if (evaluation.dueSoon) {
        upcomingServices += 1;
      }
    }

    const statusCount = groupedByStatus.reduce<Record<VehicleStatus, number>>((acc, row) => {
      const count =
        typeof row._count === "object" &&
        row._count !== null &&
        "_all" in row._count &&
        typeof row._count._all === "number"
          ? row._count._all
          : 0;

      acc[row.status] = count;
      return acc;
    }, {
      AVAILABLE: 0,
      IN_USE: 0,
      UNDER_MAINTENANCE: 0,
      OUT_OF_SERVICE: 0,
      DISPOSED: 0
    });

    return {
      totalVehicles,
      availableVehicles: statusCount.AVAILABLE,
      vehiclesUnderMaintenance: statusCount.UNDER_MAINTENANCE,
      vehiclesInUse: statusCount.IN_USE,
      vehiclesOutOfService: statusCount.OUT_OF_SERVICE,
      disposedVehicles: statusCount.DISPOSED,
      upcomingServices,
      overdueMaintenance
    };
  }

  async alerts(options: { upcomingDays?: number; limit?: number } = {}) {
    const tenantId = this.currentTenantId();
    const upcomingDays = Math.max(1, options.upcomingDays ?? DEFAULT_SERVICE_ALERT_DAYS);
    const limit = Math.min(50, Math.max(1, options.limit ?? 12));
    const candidates = await this.prisma.vehicle.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: {
          notIn: [VehicleStatus.DISPOSED]
        }
      },
      select: {
        id: true,
        registrationNo: true,
        status: true,
        nextServiceDate: true,
        nextServiceMileage: true,
        currentMileage: true,
        serviceStatus: true,
        updatedAt: true
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 500
    });

    const overdueAlerts: VehicleAlert[] = [];
    const upcomingAlerts: VehicleAlert[] = [];
    const statusAlerts: VehicleAlert[] = [];

    for (const vehicle of candidates) {
      const evaluation = this.evaluateServiceWindow(vehicle, {
        leadDays: upcomingDays
      });

      if (evaluation.overdue) {
        overdueAlerts.push({
          id: `overdue-${vehicle.id}`,
          type: "OVERDUE_MAINTENANCE",
          severity: "critical",
          vehicleId: vehicle.id,
          registrationNo: vehicle.registrationNo,
          title: "Overdue maintenance",
          message: this.buildServiceAlertMessage(vehicle.registrationNo, evaluation, true),
          status: vehicle.status,
          dueAt: evaluation.dueAt,
          createdAt: vehicle.updatedAt
        });
      } else if (evaluation.dueSoon) {
        upcomingAlerts.push({
          id: `upcoming-${vehicle.id}`,
          type: "UPCOMING_SERVICE",
          severity: "warning",
          vehicleId: vehicle.id,
          registrationNo: vehicle.registrationNo,
          title: "Upcoming service",
          message: this.buildServiceAlertMessage(vehicle.registrationNo, evaluation, false),
          status: vehicle.status,
          dueAt: evaluation.dueAt,
          createdAt: vehicle.updatedAt
        });
      }

      const alertStatuses: VehicleStatus[] = [
        VehicleStatus.UNDER_MAINTENANCE,
        VehicleStatus.OUT_OF_SERVICE,
        VehicleStatus.IN_USE
      ];
      if (alertStatuses.includes(vehicle.status)) {
        statusAlerts.push({
          id: `status-${vehicle.id}`,
          type: "STATUS_CHANGE",
          severity: vehicle.status === VehicleStatus.OUT_OF_SERVICE ? "critical" : "info",
          vehicleId: vehicle.id,
          registrationNo: vehicle.registrationNo,
          title: "Vehicle status update",
          message: `${vehicle.registrationNo} is currently ${vehicle.status.replaceAll("_", " ").toLowerCase()}.`,
          status: vehicle.status,
          dueAt: vehicle.nextServiceDate,
          createdAt: vehicle.updatedAt
        });
      }
    }

    const severityOrder: Record<VehicleAlertSeverity, number> = {
      critical: 3,
      warning: 2,
      info: 1
    };

    return [...overdueAlerts, ...upcomingAlerts, ...statusAlerts]
      .sort((a, b) => {
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) {
          return severityDiff;
        }

        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, limit);
  }

  private resolveListOrderBy(
    sortBy: VehicleListSortBy,
    sortDir: Prisma.SortOrder
  ): Prisma.VehicleOrderByWithRelationInput | Prisma.VehicleOrderByWithRelationInput[] {
    if (sortBy === "createdAt") {
      return { createdAt: sortDir };
    }

    if (sortBy === "mileage") {
      return [{ currentMileage: sortDir }, { createdAt: "desc" }];
    }

    if (sortBy === "nextServiceDate") {
      return [{ nextServiceDate: sortDir }, { createdAt: "desc" }];
    }

    return [{ year: sortDir }, { createdAt: "desc" }];
  }

  async findOne(id: string) {
    const tenantId = this.currentTenantId();
    const vehicle = tenantId
      ? await this.prisma.vehicle.findFirst({
          where: {
            id,
            tenantId
          },
          include: {
            driver: { include: { user: true } },
            fuelLogs: true,
            tripLogs: true
          }
        })
      : await this.prisma.vehicle.findUnique({
          where: { id },
          include: {
            driver: { include: { user: true } },
            fuelLogs: true,
            tripLogs: true
          }
        });

    if (!vehicle) {
      throw new NotFoundException("Vehicle not found");
    }

    return vehicle;
  }

  create(data: {
    registrationNo: string;
    assetTag?: string;
    make: string;
    vehicleModel: string;
    description?: string;
    location?: string;
    year: number;
    type: "CAR" | "MOTORCYCLE" | "TRUCK" | "VAN" | "BUS" | "HEAVY_EQUIPMENT" | "OTHER";
    ownershipType?: "OWNED" | "LEASED" | "RENTED" | "THIRD_PARTY";
    fuelType: "PETROL" | "DIESEL" | "ELECTRIC" | "HYBRID" | "CNG" | "LPG";
    serviceStatus?: "ON_SCHEDULE" | "DUE_SOON" | "OVERDUE";
    fuelCapacity?: number;
    currentMileage?: number;
    serviceIntervalDays?: number;
    serviceIntervalMileage?: number;
    nextServiceDate?: string;
    nextServiceMileage?: number;
    acquisitionDate?: string;
    purchasePrice?: number;
    currentValue?: number;
    warrantyExpiry?: string;
    costCenter?: string;
    vendorName?: string;
    customFields?: Record<string, unknown>;
  }) {
    const tenantId = this.currentTenantId();
    const currentMileage = data.currentMileage ?? 0;
    const nextServiceDate = data.nextServiceDate
      ? this.parseDateOrThrow(data.nextServiceDate, "nextServiceDate")
      : undefined;
    const nextServiceMileage =
      typeof data.nextServiceMileage === "number"
        ? data.nextServiceMileage
        : typeof data.serviceIntervalMileage === "number"
          ? currentMileage + data.serviceIntervalMileage
          : undefined;

    const resolvedServiceStatus = this.resolveServiceStatus({
      currentMileage,
      nextServiceDate,
      nextServiceMileage,
      serviceStatus: data.serviceStatus ? (data.serviceStatus as VehicleServiceStatus) : undefined
    });

    return this.prisma.vehicle.create({
      data: {
        tenantId: tenantId ?? undefined,
        registrationNo: data.registrationNo.trim(),
        assetTag: data.assetTag?.trim() || undefined,
        make: data.make.trim(),
        vehicleModel: data.vehicleModel.trim(),
        description: data.description?.trim() || undefined,
        location: data.location?.trim() || undefined,
        year: data.year,
        type: data.type,
        ownershipType: data.ownershipType,
        fuelType: data.fuelType,
        serviceStatus: resolvedServiceStatus,
        fuelCapacity: data.fuelCapacity,
        currentMileage,
        serviceIntervalDays: data.serviceIntervalDays,
        serviceIntervalMileage: data.serviceIntervalMileage,
        nextServiceDate,
        nextServiceMileage,
        acquisitionDate: data.acquisitionDate
          ? this.parseDateOrThrow(data.acquisitionDate, "acquisitionDate")
          : undefined,
        purchasePrice: data.purchasePrice,
        currentValue: data.currentValue,
        warrantyExpiry: data.warrantyExpiry
          ? this.parseDateOrThrow(data.warrantyExpiry, "warrantyExpiry")
          : undefined,
        costCenter: data.costCenter?.trim() || undefined,
        vendorName: data.vendorName?.trim() || undefined,
        customFields: data.customFields as Prisma.InputJsonValue | undefined,
        images: []
      }
    });
  }

  async update(
    id: string,
    data: Partial<{
      status: VehicleStatus;
      serviceStatus: "ON_SCHEDULE" | "DUE_SOON" | "OVERDUE";
      currentMileage: number;
      nextServiceDate: string;
      nextServiceMileage: number;
      serviceIntervalDays: number;
      serviceIntervalMileage: number;
      acquisitionDate: string;
      purchasePrice: number;
      currentValue: number;
      warrantyExpiry: string;
      insuranceExpiry: string;
      roadTaxExpiry: string;
      decommissionedAt: string;
      decommissionReason: string;
      assetTag: string;
      color: string;
      location: string;
      description: string;
      ownershipType: "OWNED" | "LEASED" | "RENTED" | "THIRD_PARTY";
      costCenter: string;
      vendorName: string;
      customFields: Record<string, unknown>;
    }>
  ) {
    const current = await this.findOne(id);

    if (typeof data.currentMileage === "number" && data.currentMileage < Number(current.currentMileage)) {
      throw new BadRequestException("Mileage entries must be monotonically increasing");
    }

    const nextServiceDate = data.nextServiceDate
      ? this.parseDateOrThrow(data.nextServiceDate, "nextServiceDate")
      : current.nextServiceDate ?? undefined;

    const resolvedServiceStatus = this.resolveServiceStatus({
      currentMileage:
        typeof data.currentMileage === "number"
          ? data.currentMileage
          : Number(current.currentMileage),
      nextServiceDate,
      nextServiceMileage:
        typeof data.nextServiceMileage === "number"
          ? data.nextServiceMileage
          : current.nextServiceMileage ?? undefined,
      serviceStatus: data.serviceStatus
        ? (data.serviceStatus as VehicleServiceStatus)
        : current.serviceStatus
    });

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        status: data.status,
        serviceStatus: resolvedServiceStatus,
        currentMileage: data.currentMileage,
        nextServiceDate,
        nextServiceMileage: data.nextServiceMileage,
        serviceIntervalDays: data.serviceIntervalDays,
        serviceIntervalMileage: data.serviceIntervalMileage,
        acquisitionDate: data.acquisitionDate ? new Date(data.acquisitionDate) : undefined,
        purchasePrice: data.purchasePrice,
        currentValue: data.currentValue,
        warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : undefined,
        insuranceExpiry: data.insuranceExpiry ? new Date(data.insuranceExpiry) : undefined,
        roadTaxExpiry: data.roadTaxExpiry ? new Date(data.roadTaxExpiry) : undefined,
        decommissionedAt: data.decommissionedAt ? new Date(data.decommissionedAt) : undefined,
        decommissionReason: data.decommissionReason?.trim() || undefined,
        assetTag: data.assetTag?.trim() || undefined,
        color: data.color?.trim() || undefined,
        location: data.location?.trim() || undefined,
        description: data.description?.trim() || undefined,
        ownershipType: data.ownershipType,
        costCenter: data.costCenter?.trim() || undefined,
        vendorName: data.vendorName?.trim() || undefined,
        customFields: data.customFields as Prisma.InputJsonValue | undefined
      }
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.vehicle.delete({ where: { id } });
    return { deleted: true };
  }

  async gateOut(
    id: string,
    data: {
      meterReading: number;
      driverId?: string;
      checkpoint?: string;
      gatePassNo?: string;
      notes?: string;
      allowOverride?: boolean;
      overrideReason?: string;
      approvedByUserId?: string;
      occurredAt?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    const tenantId = this.currentTenantId();
    const vehicle = await this.findOne(id);

    if (data.meterReading < Number(vehicle.currentMileage)) {
      throw new BadRequestException("Mileage entries must be monotonically increasing");
    }

    const gateTime = data.occurredAt
      ? this.parseDateOrThrow(data.occurredAt, "occurredAt")
      : new Date();

    let selectedDriver = vehicle.driver;
    if (data.driverId) {
      const resolvedDriver = tenantId
        ? await this.prisma.driver.findFirst({
            where: {
              id: data.driverId,
              tenantId
            },
            include: { user: true }
          })
        : await this.prisma.driver.findUnique({
            where: { id: data.driverId },
            include: { user: true }
          });

      if (!resolvedDriver) {
        throw new NotFoundException("Driver not found");
      }

      if (resolvedDriver.licenseExpiry.getTime() < Date.now()) {
        throw new BadRequestException("Cannot gate-out with an expired driver license");
      }

      selectedDriver = resolvedDriver;
    }

    const blockReasons: string[] = [];
    const blockedStatuses: VehicleStatus[] = [
      VehicleStatus.IN_USE,
      VehicleStatus.UNDER_MAINTENANCE,
      VehicleStatus.OUT_OF_SERVICE,
      VehicleStatus.DISPOSED
    ];
    if (blockedStatuses.includes(vehicle.status)) {
      blockReasons.push(`Vehicle status is ${vehicle.status.replaceAll("_", " ")}`);
    }

    const serviceEvaluation = this.evaluateServiceWindow(vehicle);
    if (serviceEvaluation.overdue) {
      blockReasons.push("Vehicle service is overdue");
    }

    const complianceReasons = await this.complianceService.evaluateForGateOut(id);
    if (complianceReasons.length > 0) {
      blockReasons.push(...complianceReasons);
    }

    const blocked = blockReasons.length > 0;
    const blockReasonText = blocked ? blockReasons.join("; ") : null;

    if (blocked && !data.allowOverride) {
      const movement = await this.prisma.vehicleGateMovement.create({
        data: {
          vehicleId: id,
          driverId: selectedDriver?.id,
          movementType: GateMovementType.OUT,
          status: GateMovementStatus.BLOCKED,
          meterReading: data.meterReading,
          previousMileage: Number(vehicle.currentMileage),
          blockedReason: blockReasonText,
          checkpoint: data.checkpoint,
          gatePassNo: data.gatePassNo,
          occurredAt: gateTime,
          metadata: data.metadata as Prisma.InputJsonValue | undefined
        }
      });

      return {
        allowed: false,
        blocked: true,
        blockedReason: blockReasonText,
        movement
      };
    }

    let approvedByUserId: string | undefined;
    let movementStatus: GateMovementStatus = GateMovementStatus.ALLOWED;
    if (blocked && data.allowOverride) {
      approvedByUserId = await this.assertGateOverrideApprover(data.approvedByUserId);
      if (!data.overrideReason?.trim()) {
        throw new BadRequestException("Override reason is required when bypassing a blocked gate-out");
      }
      movementStatus = GateMovementStatus.OVERRIDE_APPROVED;
    }

    const serviceStatus = this.resolveServiceStatus({
      currentMileage: data.meterReading,
      nextServiceDate: vehicle.nextServiceDate ?? undefined,
      nextServiceMileage: vehicle.nextServiceMileage ?? undefined,
      serviceStatus: vehicle.serviceStatus
    });

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.vehicle.update({
        where: { id },
        data: {
          status: VehicleStatus.IN_USE,
          currentMileage: data.meterReading,
          driverId: selectedDriver?.id ?? undefined,
          serviceStatus
        }
      });

      const movement = await tx.vehicleGateMovement.create({
        data: {
          vehicleId: id,
          driverId: selectedDriver?.id,
          movementType: GateMovementType.OUT,
          status: movementStatus,
          meterReading: data.meterReading,
          previousMileage: Number(vehicle.currentMileage),
          blockedReason: blockReasonText,
          overrideReason: data.overrideReason?.trim() || undefined,
          approvedById: approvedByUserId,
          checkpoint: data.checkpoint,
          gatePassNo: data.gatePassNo,
          occurredAt: gateTime,
          metadata: data.metadata as Prisma.InputJsonValue | undefined
        }
      });

      await tx.vehicleMeterLog.create({
        data: {
          vehicleId: id,
          recordedById: selectedDriver?.userId,
          reading: data.meterReading,
          readingType: VehicleMeterReadingType.GATE_OUT,
          source: "gate-out",
          notes: data.notes
        }
      });

      return movement;
    });

    if (movementStatus === GateMovementStatus.OVERRIDE_APPROVED) {
      await this.recordAudit({
        entity: "VEHICLE_GATE_MOVEMENT",
        entityId: result.id,
        action: AuditAction.UPDATE,
        reason: data.overrideReason,
        metadata: {
          event: "GATE_OUT_OVERRIDE_APPROVED",
          vehicleId: id,
          meterReading: data.meterReading,
          previousMileage: Number(vehicle.currentMileage),
          blockedReason: blockReasonText,
          approvedByUserId
        },
        beforeData: {
          status: GateMovementStatus.BLOCKED,
          blockedReason: blockReasonText
        },
        afterData: {
          status: movementStatus,
          overrideReason: data.overrideReason?.trim() || null,
          approvedByUserId
        }
      });
    }

    return {
      allowed: true,
      blocked,
      blockedReason: blockReasonText,
      overrideUsed: movementStatus === GateMovementStatus.OVERRIDE_APPROVED,
      movement: result
    };
  }

  async gateIn(
    id: string,
    data: {
      meterReading: number;
      checkpoint?: string;
      notes?: string;
      occurredAt?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    const vehicle = await this.findOne(id);

    if (data.meterReading < Number(vehicle.currentMileage)) {
      throw new BadRequestException("Mileage entries must be monotonically increasing");
    }

    const gateTime = data.occurredAt
      ? this.parseDateOrThrow(data.occurredAt, "occurredAt")
      : new Date();

    const serviceStatus = this.resolveServiceStatus({
      currentMileage: data.meterReading,
      nextServiceDate: vehicle.nextServiceDate ?? undefined,
      nextServiceMileage: vehicle.nextServiceMileage ?? undefined,
      serviceStatus: vehicle.serviceStatus
    });

    const movement = await this.prisma.$transaction(async (tx) => {
      const activeTrip = await tx.tripLog.findFirst({
        where: {
          vehicleId: id,
          status: TripStatus.IN_PROGRESS
        },
        orderBy: {
          startTime: "desc"
        }
      });

      if (activeTrip && data.meterReading >= Number(activeTrip.startMileage)) {
        await tx.tripLog.update({
          where: { id: activeTrip.id },
          data: {
            endMileage: data.meterReading,
            endTime: gateTime,
            distance: data.meterReading - Number(activeTrip.startMileage),
            notes: data.notes,
            status: TripStatus.COMPLETED
          }
        });
      }

      await tx.vehicle.update({
        where: { id },
        data: {
          status: VehicleStatus.AVAILABLE,
          currentMileage: data.meterReading,
          serviceStatus
        }
      });

      const movementRecord = await tx.vehicleGateMovement.create({
        data: {
          vehicleId: id,
          driverId: vehicle.driverId ?? undefined,
          movementType: GateMovementType.IN,
          status: GateMovementStatus.ALLOWED,
          meterReading: data.meterReading,
          previousMileage: Number(vehicle.currentMileage),
          checkpoint: data.checkpoint,
          occurredAt: gateTime,
          metadata: data.metadata as Prisma.InputJsonValue | undefined
        }
      });

      await tx.vehicleMeterLog.create({
        data: {
          vehicleId: id,
          recordedById: vehicle.driver?.userId ?? undefined,
          reading: data.meterReading,
          readingType: VehicleMeterReadingType.GATE_IN,
          source: "gate-in",
          notes: data.notes
        }
      });

      return movementRecord;
    });

    return {
      allowed: true,
      movement
    };
  }

  async recordMeterReading(
    id: string,
    data: {
      reading: number;
      source?: string;
      notes?: string;
      recordedByUserId?: string;
    }
  ) {
    const vehicle = await this.findOne(id);
    const previousMileage = Number(vehicle.currentMileage);

    if (data.reading < Number(vehicle.currentMileage)) {
      throw new BadRequestException("Mileage entries must be monotonically increasing");
    }

    const serviceStatus = this.resolveServiceStatus({
      currentMileage: data.reading,
      nextServiceDate: vehicle.nextServiceDate ?? undefined,
      nextServiceMileage: vehicle.nextServiceMileage ?? undefined,
      serviceStatus: vehicle.serviceStatus
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedVehicle = await tx.vehicle.update({
        where: { id },
        data: {
          currentMileage: data.reading,
          serviceStatus
        }
      });

      const meterLog = await tx.vehicleMeterLog.create({
        data: {
          vehicleId: id,
          recordedById: data.recordedByUserId,
          reading: data.reading,
          readingType: VehicleMeterReadingType.MANUAL,
          source: data.source?.trim() || "manual",
          notes: data.notes
        }
      });

      return {
        vehicle: updatedVehicle,
        meterLog
      };
    });

    await this.recordAudit({
      entity: "VEHICLE",
      entityId: id,
      action: AuditAction.UPDATE,
      reason: data.notes,
      metadata: {
        event: "MANUAL_METER_READING",
        source: data.source?.trim() || "manual",
        meterLogId: result.meterLog.id,
        reading: data.reading
      },
      beforeData: {
        currentMileage: previousMileage,
        serviceStatus: vehicle.serviceStatus
      },
      afterData: {
        currentMileage: Number(result.vehicle.currentMileage),
        serviceStatus: result.vehicle.serviceStatus
      }
    });

    return {
      ...result,
      evaluation: this.evaluateServiceWindow(result.vehicle)
    };
  }

  async meterLogs(id: string, query: VehicleMeterLogQuery = {}) {
    await this.findOne(id);

    const limit = Math.min(MAX_METER_LOG_LIMIT, Math.max(1, query.limit ?? 100));
    return this.prisma.vehicleMeterLog.findMany({
      where: { vehicleId: id },
      include: {
        recordedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }

  async gateMovements(id: string, limitRaw?: number) {
    await this.findOne(id);

    const limit = Math.min(500, Math.max(1, limitRaw ?? 100));
    return this.prisma.vehicleGateMovement.findMany({
      where: { vehicleId: id },
      include: {
        driver: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        approvedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { occurredAt: "desc" },
      take: limit
    });
  }

  async serviceRule(id: string) {
    const tenantId = this.currentTenantId();
    const vehicle = tenantId
      ? await this.prisma.vehicle.findFirst({
          where: {
            id,
            tenantId
          },
          select: {
            id: true,
            registrationNo: true,
            currentMileage: true,
            serviceStatus: true,
            serviceIntervalDays: true,
            serviceIntervalMileage: true,
            lastServiceDate: true,
            nextServiceDate: true,
            nextServiceMileage: true,
            updatedAt: true
          }
        })
      : await this.prisma.vehicle.findUnique({
          where: { id },
          select: {
            id: true,
            registrationNo: true,
            currentMileage: true,
            serviceStatus: true,
            serviceIntervalDays: true,
            serviceIntervalMileage: true,
            lastServiceDate: true,
            nextServiceDate: true,
            nextServiceMileage: true,
            updatedAt: true
          }
        });

    if (!vehicle) {
      throw new NotFoundException("Vehicle not found");
    }

    return {
      ...vehicle,
      evaluation: this.evaluateServiceWindow(vehicle)
    };
  }

  async updateServiceRule(
    id: string,
    data: Partial<{
      serviceIntervalDays: number;
      serviceIntervalMileage: number;
      nextServiceDate: string;
      nextServiceMileage: number;
      lastServiceDate: string;
      resetFromCurrentMileage: boolean;
      notes: string;
    }>
  ) {
    const vehicle = await this.findOne(id);
    const now = new Date();

    const serviceIntervalDays =
      typeof data.serviceIntervalDays === "number"
        ? data.serviceIntervalDays
        : vehicle.serviceIntervalDays ?? undefined;
    const serviceIntervalMileage =
      typeof data.serviceIntervalMileage === "number"
        ? data.serviceIntervalMileage
        : vehicle.serviceIntervalMileage ?? undefined;

    let nextServiceDate =
      data.nextServiceDate
        ? this.parseDateOrThrow(data.nextServiceDate, "nextServiceDate")
        : vehicle.nextServiceDate ?? undefined;

    let nextServiceMileage =
      typeof data.nextServiceMileage === "number"
        ? data.nextServiceMileage
        : vehicle.nextServiceMileage ?? undefined;

    if (data.resetFromCurrentMileage) {
      if (!data.nextServiceDate && typeof serviceIntervalDays === "number") {
        nextServiceDate = new Date(now.getTime() + serviceIntervalDays * 24 * 60 * 60 * 1000);
      }

      if (typeof serviceIntervalMileage === "number" && typeof data.nextServiceMileage !== "number") {
        nextServiceMileage = Number(vehicle.currentMileage) + serviceIntervalMileage;
      }
    }

    const lastServiceDate = data.lastServiceDate
      ? this.parseDateOrThrow(data.lastServiceDate, "lastServiceDate")
      : undefined;

    const serviceStatus = this.resolveServiceStatus({
      currentMileage: Number(vehicle.currentMileage),
      nextServiceDate,
      nextServiceMileage,
      serviceStatus: vehicle.serviceStatus
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedVehicle = await tx.vehicle.update({
        where: { id },
        data: {
          serviceIntervalDays,
          serviceIntervalMileage,
          nextServiceDate,
          nextServiceMileage,
          lastServiceDate,
          serviceStatus
        }
      });

      await tx.vehicleMeterLog.create({
        data: {
          vehicleId: id,
          reading: Number(updatedVehicle.currentMileage),
          readingType: VehicleMeterReadingType.SERVICE_UPDATE,
          source: "service-rule",
          notes: data.notes
        }
      });

      return updatedVehicle;
    });

    await this.recordAudit({
      entity: "VEHICLE",
      entityId: id,
      action: AuditAction.UPDATE,
      reason: data.notes,
      metadata: {
        event: "SERVICE_RULE_UPDATE",
        resetFromCurrentMileage: Boolean(data.resetFromCurrentMileage)
      },
      beforeData: {
        serviceIntervalDays: vehicle.serviceIntervalDays,
        serviceIntervalMileage: vehicle.serviceIntervalMileage,
        nextServiceDate: vehicle.nextServiceDate,
        nextServiceMileage: vehicle.nextServiceMileage,
        lastServiceDate: vehicle.lastServiceDate,
        serviceStatus: vehicle.serviceStatus
      },
      afterData: {
        serviceIntervalDays: updated.serviceIntervalDays,
        serviceIntervalMileage: updated.serviceIntervalMileage,
        nextServiceDate: updated.nextServiceDate,
        nextServiceMileage: updated.nextServiceMileage,
        lastServiceDate: updated.lastServiceDate,
        serviceStatus: updated.serviceStatus
      }
    });

    return {
      vehicle: updated,
      evaluation: this.evaluateServiceWindow(updated)
    };
  }

  async assignDriver(id: string, driverId: string) {
    const tenantId = this.currentTenantId();
    const vehicle = await this.findOne(id);

    const driver = tenantId
      ? await this.prisma.driver.findFirst({
          where: {
            id: driverId,
            tenantId
          },
          include: { user: true }
        })
      : await this.prisma.driver.findUnique({
          where: { id: driverId },
          include: { user: true }
        });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    if (driver.licenseExpiry.getTime() < Date.now()) {
      throw new BadRequestException("Cannot assign a driver whose license is expired");
    }

    if (vehicle.driverId && vehicle.driverId !== driverId) {
      throw new BadRequestException("Only one driver can be actively assigned per vehicle");
    }

    return this.prisma.vehicle.update({
      where: { id },
      data: { driverId }
    });
  }

  async fuelLog(
    id: string,
    data: { driverId?: string; liters: number; costPerLiter: number; mileageAtFuel: number; fuelStation?: string; notes?: string }
  ) {
    const vehicle = await this.findOne(id);

    if (vehicle.status === VehicleStatus.OUT_OF_SERVICE) {
      throw new BadRequestException("Cannot log fuel for a vehicle that is OUT_OF_SERVICE");
    }

    if (data.mileageAtFuel < Number(vehicle.currentMileage)) {
      throw new BadRequestException("Mileage entries must be monotonically increasing");
    }

    const totalCost = data.liters * data.costPerLiter;
    const resolvedDriverId = await this.resolveFuelDriverId(data.driverId ?? vehicle.driverId ?? undefined);

    await this.prisma.vehicle.update({
      where: { id },
      data: { currentMileage: data.mileageAtFuel }
    });

    return this.prisma.fuelLog.create({
      data: {
        vehicleId: id,
        driverId: resolvedDriverId,
        date: new Date(),
        liters: data.liters,
        costPerLiter: data.costPerLiter,
        totalCost,
        mileageAtFuel: data.mileageAtFuel,
        fuelStation: data.fuelStation,
        notes: data.notes
      }
    });
  }

  async fuelLogs(id: string, filters?: { startDate?: Date; endDate?: Date; driverId?: string }) {
    await this.findOne(id);
    return this.prisma.fuelLog.findMany({
      where: {
        vehicleId: id,
        ...(filters?.driverId ? { driverId: filters.driverId } : {}),
        ...(filters?.startDate || filters?.endDate
          ? {
              date: {
                ...(filters?.startDate ? { gte: filters.startDate } : {}),
                ...(filters?.endDate ? { lte: filters.endDate } : {})
              }
            }
          : {})
      },
      orderBy: { date: "desc" }
    });
  }

  async fuelAnalytics(id: string, filters?: { startDate?: Date; endDate?: Date; driverId?: string }) {
    const logs = await this.fuelLogs(id, filters);
    const sorted = [...logs].sort((left, right) => {
      const mileageDiff = Number(left.mileageAtFuel) - Number(right.mileageAtFuel);
      if (mileageDiff !== 0) {
        return mileageDiff;
      }
      return left.date.getTime() - right.date.getTime();
    });
    const monthlyFuelCostTrend = new Map<string, { totalCost: number; liters: number }>();

    for (const log of logs) {
      const month = log.date.toISOString().slice(0, 7);
      const current = monthlyFuelCostTrend.get(month) ?? { totalCost: 0, liters: 0 };
      current.totalCost += Number(log.totalCost);
      current.liters += Number(log.liters);
      monthlyFuelCostTrend.set(month, current);
    }

    if (sorted.length < 2) {
      const totalLiters = logs.reduce((sum, log) => sum + Number(log.liters), 0);
      const totalCost = logs.reduce((sum, log) => sum + Number(log.totalCost), 0);
      return {
        totalLiters,
        totalCost,
        avgCostPerLiter: totalLiters > 0 ? totalCost / totalLiters : 0,
        avgConsumption: 0,
        averageConsumptionLPer100Km: 0,
        distance: 0,
        costPerKm: 0,
        abnormalUsageCount: 0,
        anomalies: [],
        monthlyFuelCostTrend: [...monthlyFuelCostTrend.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([month, value]) => ({ month, totalCost: value.totalCost, liters: value.liters }))
      };
    }

    const intervals: Array<{
      date: Date;
      liters: number;
      distance: number;
      litersPer100Km: number;
    }> = [];

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      const distance = Number(current.mileageAtFuel) - Number(previous.mileageAtFuel);

      if (distance <= 0) {
        continue;
      }

      intervals.push({
        date: current.date,
        liters: Number(current.liters),
        distance,
        litersPer100Km: (Number(current.liters) / distance) * 100
      });
    }

    const totalLiters = logs.reduce((sum, log) => sum + Number(log.liters), 0);
    const totalCost = logs.reduce((sum, log) => sum + Number(log.totalCost), 0);
    const distance = intervals.reduce((sum, interval) => sum + interval.distance, 0);

    const averageConsumptionLPer100Km = distance > 0 ? (totalLiters / distance) * 100 : 0;
    const costPerKm = distance > 0 ? totalCost / distance : 0;
    const anomalyBaseline =
      intervals.length > 0
        ? intervals.reduce((sum, interval) => sum + interval.litersPer100Km, 0) / intervals.length
        : 0;
    const anomalies = intervals.filter(
      (interval) =>
        (anomalyBaseline > 0 &&
          (interval.litersPer100Km > anomalyBaseline * 1.35 || interval.litersPer100Km < anomalyBaseline * 0.55)) ||
        (interval.distance < 25 && interval.liters > 12)
    );

    return {
      totalLiters,
      totalCost,
      avgCostPerLiter: totalLiters > 0 ? totalCost / totalLiters : 0,
      avgConsumption: averageConsumptionLPer100Km,
      averageConsumptionLPer100Km,
      distance,
      costPerKm,
      abnormalUsageCount: anomalies.length,
      anomalies: anomalies.map((interval) => ({
        date: interval.date.toISOString(),
        distance: interval.distance,
        liters: interval.liters,
        litersPer100Km: Math.round(interval.litersPer100Km * 100) / 100
      })),
      monthlyFuelCostTrend: [...monthlyFuelCostTrend.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([month, value]) => ({ month, totalCost: value.totalCost, liters: value.liters }))
    };
  }

  private async resolveFuelDriverId(driverId?: string) {
    const tenantId = this.currentTenantId();
    if (!driverId) {
      return undefined;
    }

    const driver = tenantId
      ? await this.prisma.driver.findFirst({
          where: {
            id: driverId,
            tenantId
          },
          select: { id: true }
        })
      : await this.prisma.driver.findUnique({ where: { id: driverId }, select: { id: true } });
    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    return driver.id;
  }

  async tripStart(id: string, data: { driverId: string; startLocation: string; endLocation: string; startMileage: number; purpose?: string }) {
    await this.resolveFuelDriverId(data.driverId);
    const vehicle = await this.findOne(id);

    if (vehicle.status === VehicleStatus.UNDER_MAINTENANCE) {
      throw new BadRequestException("Cannot start a trip if vehicle is UNDER_MAINTENANCE");
    }

    if (data.startMileage < Number(vehicle.currentMileage)) {
      throw new BadRequestException("Mileage entries must be monotonically increasing");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.vehicle.update({
        where: { id },
        data: { status: VehicleStatus.IN_USE, currentMileage: data.startMileage }
      });

      const trip = await tx.tripLog.create({
        data: {
          vehicleId: id,
          driverId: data.driverId,
          startLocation: data.startLocation,
          endLocation: data.endLocation,
          startMileage: data.startMileage,
          endMileage: data.startMileage,
          distance: 0,
          startTime: new Date(),
          purpose: data.purpose,
          status: TripStatus.IN_PROGRESS
        }
      });

      await tx.vehicleMeterLog.create({
        data: {
          vehicleId: id,
          recordedById: vehicle.driver?.userId ?? undefined,
          reading: data.startMileage,
          readingType: VehicleMeterReadingType.TRIP_START,
          source: "trip-start",
          notes: data.purpose
        }
      });

      return trip;
    });
  }

  async tripEnd(id: string, data: { tripId: string; endMileage: number; notes?: string }) {
    const tenantId = this.currentTenantId();
    if (tenantId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id, tenantId },
        select: { id: true }
      });
      if (!vehicle) {
        throw new NotFoundException("Vehicle not found");
      }
    }
    const trip = await this.prisma.tripLog.findUnique({ where: { id: data.tripId } });

    if (!trip || trip.vehicleId !== id) {
      throw new NotFoundException("Trip not found");
    }

    if (data.endMileage < Number(trip.startMileage)) {
      throw new BadRequestException("Mileage entries must be monotonically increasing");
    }

    const distance = data.endMileage - Number(trip.startMileage);

    return this.prisma.$transaction(async (tx) => {
      const ended = await tx.tripLog.update({
        where: { id: data.tripId },
        data: {
          endMileage: data.endMileage,
          endTime: new Date(),
          distance,
          notes: data.notes,
          status: TripStatus.COMPLETED
        }
      });

      const vehicle = await tx.vehicle.findUnique({
        where: { id },
        select: {
          currentMileage: true,
          nextServiceDate: true,
          nextServiceMileage: true,
          serviceStatus: true
        }
      });

      if (!vehicle) {
        throw new NotFoundException("Vehicle not found");
      }

      const serviceStatus = this.resolveServiceStatus({
        currentMileage: data.endMileage,
        nextServiceDate: vehicle.nextServiceDate ?? undefined,
        nextServiceMileage: vehicle.nextServiceMileage ?? undefined,
        serviceStatus: vehicle.serviceStatus
      });

      await tx.vehicle.update({
        where: { id },
        data: {
          status: VehicleStatus.AVAILABLE,
          currentMileage: data.endMileage,
          serviceStatus
        }
      });

      const driver = await tx.driver.findUnique({
        where: { id: trip.driverId },
        select: { userId: true }
      });

      await tx.vehicleMeterLog.create({
        data: {
          vehicleId: id,
          recordedById: driver?.userId,
          reading: data.endMileage,
          readingType: VehicleMeterReadingType.TRIP_END,
          source: "trip-end",
          notes: data.notes
        }
      });

      return ended;
    });
  }

  async trips(id: string) {
    await this.findOne(id);
    return this.prisma.tripLog.findMany({ where: { vehicleId: id }, orderBy: { createdAt: "desc" } });
  }

  async history(id: string, query: VehicleHistoryQuery = {}) {
    await this.findOne(id);

    const where: Prisma.GpsLocationWhereInput = { vehicleId: id };
    const from = query.from ? this.parseDateOrThrow(query.from, "from") : null;
    const to = query.to ? this.parseDateOrThrow(query.to, "to") : null;

    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException("The from date must be earlier than the to date");
    }

    if (from || to) {
      where.timestamp = {
        gte: from ?? undefined,
        lte: to ?? undefined
      };
    }

    const limit = Math.min(5_000, Math.max(50, query.limit ?? 1_000));

    return this.prisma.gpsLocation.findMany({
      where,
      orderBy: { timestamp: "asc" },
      take: limit,
      select: {
        id: true,
        vehicleId: true,
        latitude: true,
        longitude: true,
        speed: true,
        heading: true,
        timestamp: true
      }
    });
  }

  async gpsUpdate(
    id: string,
    data: {
      latitude: number;
      longitude: number;
      speed?: number;
      heading?: number;
      engineStatus?: boolean | "ON" | "OFF";
      fuelLevel?: number;
      batteryVoltage?: number;
    }
  ) {
    await this.findOne(id);
    return this.fleetService.updateGps(id, data);
  }

  private evaluateServiceWindow(
    vehicle: {
      currentMileage: number;
      nextServiceDate?: Date | null;
      nextServiceMileage?: number | null;
      serviceStatus?: VehicleServiceStatus;
    },
    options: {
      leadDays?: number;
      leadMileage?: number;
      now?: Date;
    } = {}
  ): ServiceWindowEvaluation {
    const now = options.now ?? new Date();
    const leadDays = Math.max(1, options.leadDays ?? DEFAULT_SERVICE_ALERT_DAYS);
    const leadMileage = Math.max(1, options.leadMileage ?? DEFAULT_SERVICE_ALERT_MILEAGE);
    const currentMileage = Number(vehicle.currentMileage ?? 0);
    const nextServiceMileage =
      typeof vehicle.nextServiceMileage === "number" ? Number(vehicle.nextServiceMileage) : null;
    const nextServiceDate = vehicle.nextServiceDate ?? null;

    const mileageOverdue = nextServiceMileage !== null ? currentMileage >= nextServiceMileage : false;
    const dateOverdue = nextServiceDate ? nextServiceDate.getTime() < now.getTime() : false;
    const statusOverdue = vehicle.serviceStatus === VehicleServiceStatus.OVERDUE;

    if (mileageOverdue || dateOverdue || statusOverdue) {
      return {
        overdue: true,
        dueSoon: false,
        reason: mileageOverdue ? "MILEAGE" : dateOverdue ? "DATE" : "STATUS",
        dueAt: nextServiceDate,
        remainingMileage: nextServiceMileage === null ? null : Math.max(0, nextServiceMileage - currentMileage)
      };
    }

    const mileageDueSoon = nextServiceMileage !== null ? currentMileage >= nextServiceMileage - leadMileage : false;
    const dateDueSoon = nextServiceDate
      ? nextServiceDate.getTime() <= now.getTime() + leadDays * 24 * 60 * 60 * 1000
      : false;
    const statusDueSoon = vehicle.serviceStatus === VehicleServiceStatus.DUE_SOON;

    if (mileageDueSoon || dateDueSoon || statusDueSoon) {
      return {
        overdue: false,
        dueSoon: true,
        reason: mileageDueSoon ? "MILEAGE" : dateDueSoon ? "DATE" : "STATUS",
        dueAt: nextServiceDate,
        remainingMileage: nextServiceMileage === null ? null : Math.max(0, nextServiceMileage - currentMileage)
      };
    }

    return {
      overdue: false,
      dueSoon: false,
      reason: "NONE",
      dueAt: nextServiceDate,
      remainingMileage: nextServiceMileage === null ? null : Math.max(0, nextServiceMileage - currentMileage)
    };
  }

  private resolveServiceStatus(input: {
    currentMileage: number;
    nextServiceDate?: Date | null;
    nextServiceMileage?: number | null;
    serviceStatus?: VehicleServiceStatus;
  }): VehicleServiceStatus {
    const evaluation = this.evaluateServiceWindow(input);
    if (evaluation.overdue) {
      return VehicleServiceStatus.OVERDUE;
    }

    if (evaluation.dueSoon) {
      return VehicleServiceStatus.DUE_SOON;
    }

    return VehicleServiceStatus.ON_SCHEDULE;
  }

  private buildServiceAlertMessage(
    registrationNo: string,
    evaluation: ServiceWindowEvaluation,
    overdue: boolean
  ): string {
    if (evaluation.reason === "MILEAGE") {
      if (overdue) {
        return `${registrationNo} is overdue by service mileage.`;
      }

      const remaining = evaluation.remainingMileage ?? 0;
      return `${registrationNo} is nearing service mileage (${remaining.toFixed(0)} km remaining).`;
    }

    if (evaluation.reason === "DATE" && evaluation.dueAt) {
      return overdue
        ? `${registrationNo} is past its service date (${evaluation.dueAt.toLocaleDateString()}).`
        : `${registrationNo} has service due on ${evaluation.dueAt.toLocaleDateString()}.`;
    }

    return overdue
      ? `${registrationNo} is marked as overdue for service.`
      : `${registrationNo} requires scheduled service soon.`;
  }

  private async assertGateOverrideApprover(userId?: string): Promise<string> {
    if (!userId) {
      throw new BadRequestException("An approver is required for gate override");
    }

    const approver = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          select: {
            name: true
          }
        }
      }
    });

    if (!approver) {
      throw new NotFoundException("Override approver not found");
    }

    const allowedRoles = new Set<RoleName>([
      RoleName.SUPER_ADMIN,
      RoleName.ADMIN,
      RoleName.MANAGER,
      RoleName.OPERATIONS_MANAGER,
      RoleName.FLEET_MANAGER,
      RoleName.FARM_OWNER,
      RoleName.FARM_MANAGER
    ]);

    if (!allowedRoles.has(approver.role.name)) {
      throw new BadRequestException("Override approver does not have authority for gate release");
    }

    return approver.id;
  }

  private async recordAudit(payload: {
    entity: string;
    entityId: string;
    action: AuditAction;
    reason?: string;
    metadata?: unknown;
    beforeData?: unknown;
    afterData?: unknown;
  }) {
    const ctx = requestContext.get();

    await this.prisma.auditLog.create({
      data: {
        tenantId: ctx?.tenantId ?? null,
        actorId: ctx?.actorId ?? null,
        entity: payload.entity,
        entityId: payload.entityId,
        action: payload.action,
        module: ctx?.module ?? "vehicles",
        reason: payload.reason,
        ipAddress: ctx?.ipAddress ?? undefined,
        userAgent: ctx?.userAgent ?? undefined,
        requestPath: ctx?.requestPath ?? undefined,
        actorSnapshot:
          ctx?.actorId || ctx?.actorEmail || ctx?.actorRole
            ? ({ id: ctx?.actorId, email: ctx?.actorEmail, role: ctx?.actorRole } as Prisma.InputJsonValue)
            : undefined,
        metadata: payload.metadata as Prisma.InputJsonValue | undefined,
        beforeData: payload.beforeData as Prisma.InputJsonValue | undefined,
        afterData: payload.afterData as Prisma.InputJsonValue | undefined
      }
    });
  }

  private parseDateOrThrow(value: string, label: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ${label} date`);
    }

    return parsed;
  }
}
