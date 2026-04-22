import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, VehicleStatus } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
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

@Injectable()
export class VehiclesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FleetService) private readonly fleetService: FleetService
  ) {}

  async findAll(query: VehicleListQuery = {}) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_LIST_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_LIST_PAGE_SIZE));
    const q = query.q?.trim() ?? "";
    const sortBy = query.sortBy ?? "createdAt";
    const sortDir = query.sortDir ?? "desc";

    const where: Prisma.VehicleWhereInput = {};

    if (q) {
      where.OR = [
        { registrationNo: { contains: q, mode: "insensitive" } },
        { vehicleModel: { contains: q, mode: "insensitive" } }
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
    const now = new Date();
    const upcomingLimit = new Date(now.getTime() + upcomingDays * 24 * 60 * 60 * 1000);

    const [totalVehicles, groupedByStatus, upcomingServices, overdueMaintenance] = await this.prisma.$transaction([
      this.prisma.vehicle.count(),
      this.prisma.vehicle.groupBy({
        by: ["status"],
        orderBy: {
          status: "asc"
        },
        _count: {
          _all: true
        }
      }),
      this.prisma.vehicle.count({
        where: {
          nextServiceDate: {
            gte: now,
            lte: upcomingLimit
          },
          status: {
            not: VehicleStatus.DISPOSED
          }
        }
      }),
      this.prisma.vehicle.count({
        where: {
          nextServiceDate: {
            lt: now
          },
          status: {
            notIn: [VehicleStatus.DISPOSED]
          }
        }
      })
    ]);

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
    const now = new Date();
    const upcomingDays = Math.max(1, options.upcomingDays ?? 14);
    const limit = Math.min(50, Math.max(1, options.limit ?? 12));
    const upcomingLimit = new Date(now.getTime() + upcomingDays * 24 * 60 * 60 * 1000);

    const [upcoming, overdue, statusAttention] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where: {
          nextServiceDate: {
            gte: now,
            lte: upcomingLimit
          },
          status: {
            notIn: [VehicleStatus.DISPOSED]
          }
        },
        select: {
          id: true,
          registrationNo: true,
          status: true,
          nextServiceDate: true,
          updatedAt: true
        },
        orderBy: {
          nextServiceDate: "asc"
        },
        take: limit
      }),
      this.prisma.vehicle.findMany({
        where: {
          nextServiceDate: {
            lt: now
          },
          status: {
            notIn: [VehicleStatus.DISPOSED]
          }
        },
        select: {
          id: true,
          registrationNo: true,
          status: true,
          nextServiceDate: true,
          updatedAt: true
        },
        orderBy: {
          nextServiceDate: "asc"
        },
        take: limit
      }),
      this.prisma.vehicle.findMany({
        where: {
          status: {
            in: [VehicleStatus.UNDER_MAINTENANCE, VehicleStatus.OUT_OF_SERVICE, VehicleStatus.IN_USE]
          }
        },
        select: {
          id: true,
          registrationNo: true,
          status: true,
          nextServiceDate: true,
          updatedAt: true
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: limit
      })
    ]);

    const overdueAlerts: VehicleAlert[] = overdue.map((vehicle) => ({
      id: `overdue-${vehicle.id}`,
      type: "OVERDUE_MAINTENANCE",
      severity: "critical",
      vehicleId: vehicle.id,
      registrationNo: vehicle.registrationNo,
      title: "Overdue maintenance",
      message: `${vehicle.registrationNo} is past its next service date.`,
      status: vehicle.status,
      dueAt: vehicle.nextServiceDate,
      createdAt: vehicle.updatedAt
    }));

    const upcomingAlerts: VehicleAlert[] = upcoming.map((vehicle) => ({
      id: `upcoming-${vehicle.id}`,
      type: "UPCOMING_SERVICE",
      severity: "warning",
      vehicleId: vehicle.id,
      registrationNo: vehicle.registrationNo,
      title: "Upcoming service",
      message: `${vehicle.registrationNo} requires scheduled service soon.`,
      status: vehicle.status,
      dueAt: vehicle.nextServiceDate,
      createdAt: vehicle.updatedAt
    }));

    const statusAlerts: VehicleAlert[] = statusAttention.map((vehicle) => ({
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
    }));

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
    const vehicle = await this.prisma.vehicle.findUnique({
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
    make: string;
    vehicleModel: string;
    year: number;
    type: "CAR" | "MOTORCYCLE" | "TRUCK" | "VAN" | "BUS" | "HEAVY_EQUIPMENT" | "OTHER";
    fuelType: "PETROL" | "DIESEL" | "ELECTRIC" | "HYBRID" | "CNG" | "LPG";
    currentMileage?: number;
  }) {
    return this.prisma.vehicle.create({
      data: {
        ...data,
        currentMileage: data.currentMileage ?? 0,
        images: []
      }
    });
  }

  async update(
    id: string,
    data: Partial<{
      status: VehicleStatus;
      currentMileage: number;
      nextServiceDate: string;
      nextServiceMileage: number;
      insuranceExpiry: string;
      roadTaxExpiry: string;
      color: string;
    }>
  ) {
    const current = await this.findOne(id);

    if (typeof data.currentMileage === "number" && data.currentMileage < Number(current.currentMileage)) {
      throw new BadRequestException("Mileage entries must be monotonically increasing");
    }

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...data,
        nextServiceDate: data.nextServiceDate ? new Date(data.nextServiceDate) : undefined,
        insuranceExpiry: data.insuranceExpiry ? new Date(data.insuranceExpiry) : undefined,
        roadTaxExpiry: data.roadTaxExpiry ? new Date(data.roadTaxExpiry) : undefined
      }
    });
  }

  async remove(id: string) {
    await this.prisma.vehicle.delete({ where: { id } });
    return { deleted: true };
  }

  async assignDriver(id: string, driverId: string) {
    const vehicle = await this.findOne(id);

    const driver = await this.prisma.driver.findUnique({
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

  async fuelLog(id: string, data: { liters: number; costPerLiter: number; mileageAtFuel: number; fuelStation?: string; notes?: string }) {
    const vehicle = await this.findOne(id);

    if (vehicle.status === VehicleStatus.OUT_OF_SERVICE) {
      throw new BadRequestException("Cannot log fuel for a vehicle that is OUT_OF_SERVICE");
    }

    if (data.mileageAtFuel < Number(vehicle.currentMileage)) {
      throw new BadRequestException("Mileage entries must be monotonically increasing");
    }

    const totalCost = data.liters * data.costPerLiter;

    await this.prisma.vehicle.update({
      where: { id },
      data: { currentMileage: data.mileageAtFuel }
    });

    return this.prisma.fuelLog.create({
      data: {
        vehicleId: id,
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

  fuelLogs(id: string) {
    return this.prisma.fuelLog.findMany({ where: { vehicleId: id }, orderBy: { date: "desc" } });
  }

  async fuelAnalytics(id: string) {
    const logs = await this.fuelLogs(id);

    if (logs.length < 2) {
      return {
        averageConsumptionLPer100Km: 0,
        costPerKm: 0,
        monthlyFuelCostTrend: []
      };
    }

    const totalLiters = logs.reduce((sum, log) => sum + Number(log.liters), 0);
    const totalCost = logs.reduce((sum, log) => sum + Number(log.totalCost), 0);
    const distance = Number(logs[0].mileageAtFuel) - Number(logs[logs.length - 1].mileageAtFuel);

    const averageConsumptionLPer100Km = distance > 0 ? (totalLiters / distance) * 100 : 0;
    const costPerKm = distance > 0 ? totalCost / distance : 0;

    return {
      averageConsumptionLPer100Km,
      costPerKm,
      monthlyFuelCostTrend: logs.map((log) => ({
        month: log.date.toISOString().slice(0, 7),
        totalCost: Number(log.totalCost)
      }))
    };
  }

  async tripStart(id: string, data: { driverId: string; startLocation: string; endLocation: string; startMileage: number; purpose?: string }) {
    const vehicle = await this.findOne(id);

    if (vehicle.status === VehicleStatus.UNDER_MAINTENANCE) {
      throw new BadRequestException("Cannot start a trip if vehicle is UNDER_MAINTENANCE");
    }

    if (data.startMileage < Number(vehicle.currentMileage)) {
      throw new BadRequestException("Mileage entries must be monotonically increasing");
    }

    await this.prisma.vehicle.update({
      where: { id },
      data: { status: VehicleStatus.IN_USE, currentMileage: data.startMileage }
    });

    return this.prisma.tripLog.create({
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
        status: "IN_PROGRESS"
      }
    });
  }

  async tripEnd(id: string, data: { tripId: string; endMileage: number; notes?: string }) {
    const trip = await this.prisma.tripLog.findUnique({ where: { id: data.tripId } });

    if (!trip || trip.vehicleId !== id) {
      throw new NotFoundException("Trip not found");
    }

    if (data.endMileage < Number(trip.startMileage)) {
      throw new BadRequestException("Mileage entries must be monotonically increasing");
    }

    const distance = data.endMileage - Number(trip.startMileage);

    const ended = await this.prisma.tripLog.update({
      where: { id: data.tripId },
      data: {
        endMileage: data.endMileage,
        endTime: new Date(),
        distance,
        notes: data.notes,
        status: "COMPLETED"
      }
    });

    await this.prisma.vehicle.update({
      where: { id },
      data: {
        status: VehicleStatus.AVAILABLE,
        currentMileage: data.endMileage
      }
    });

    return ended;
  }

  trips(id: string) {
    return this.prisma.tripLog.findMany({ where: { vehicleId: id }, orderBy: { createdAt: "desc" } });
  }

  gpsUpdate(id: string, data: { latitude: number; longitude: number; speed?: number; heading?: number }) {
    return this.fleetService.updateGps(id, data);
  }
}
