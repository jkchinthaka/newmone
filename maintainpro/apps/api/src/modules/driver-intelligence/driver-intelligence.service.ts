import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AccidentResponsibility,
  AccidentSeverity,
  AuditAction,
  ComplianceStatus,
  DriverTrainingStatus,
  FineResponsibility,
  Prisma,
  TripStatus,
  VehicleServiceStatus,
  WorkOrderStatus,
  WorkOrderType
} from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { Phase4Actor, assertActor, isValidObjectId, recordPhase4Audit, resolveTenantId } from "../_phase4/phase4-audit.helper";
import {
  BestDriversQueryDto,
  DriverIntelligenceListQueryDto,
  DriverRiskLevel,
  IntelligenceFiltersDto,
  UpdateDriverIntelligenceInputsDto
} from "./dto/driver-intelligence.dto";

const DEFAULT_LOOKBACK_DAYS = 365;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_BEST_DRIVER_LIMIT = 10;

const driverInclude = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true
    }
  },
  department: {
    select: {
      id: true,
      name: true,
      code: true
    }
  },
  vehicles: {
    select: {
      id: true,
      registrationNo: true,
      vehicleModel: true,
      type: true,
      currentMileage: true,
      complianceStatus: true,
      serviceStatus: true,
      nextServiceDate: true,
      nextServiceMileage: true,
      status: true,
      departmentId: true
    }
  }
} satisfies Prisma.DriverInclude;

type DriverRecord = Prisma.DriverGetPayload<{ include: typeof driverInclude }>;

interface DateRange {
  start: Date;
  end: Date;
}

interface FuelInterval {
  vehicleId: string;
  date: Date;
  liters: number;
  distance: number;
  litersPer100Km: number;
  totalCost: number;
}

interface FuelInsights {
  totalLiters: number;
  totalCost: number;
  avgCostPerLiter: number;
  avgConsumption: number | null;
  distance: number;
  abnormalUsageCount: number;
  anomalies: Array<{
    vehicleId: string;
    date: string;
    litersPer100Km: number;
    distance: number;
    liters: number;
  }>;
  monthlyTrend: Array<{ period: string; totalCost: number; liters: number }>;
}

type FineSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

@Injectable()
export class DriverIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(actor: Phase4Actor, query: IntelligenceFiltersDto = {}) {
    const range = this.resolveDateRange(query);
    const drivers = await this.findDrivers(actor, query);
    const profiles = await Promise.all(drivers.map((driver) => this.buildDriverProfile(driver, range, actor)));
    const fleetCostSummary = await this.aggregateFleetCosts(actor, range, query.vehicleId ? [query.vehicleId] : undefined);
    const fleetFuelLogs = await this.prisma.fuelLog.findMany({
      where: {
        ...(this.tenantVehicleWhere(actor) ? { vehicle: { is: this.tenantVehicleWhere(actor) } } : {}),
        ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
        date: { gte: range.start, lte: range.end }
      },
      orderBy: [{ vehicleId: "asc" }, { mileageAtFuel: "asc" }, { date: "asc" }],
      select: {
        id: true,
        vehicleId: true,
        driverId: true,
        date: true,
        liters: true,
        costPerLiter: true,
        totalCost: true,
        mileageAtFuel: true
      }
    });
    const fleetFuelInsights = this.buildFuelInsights(fleetFuelLogs);

    const averageDriverScore =
      profiles.length > 0
        ? Math.round(profiles.reduce((sum, item) => sum + item.driverScore, 0) / profiles.length)
        : 0;
    const eligibleDrivers = profiles.filter((item) => item.eligibility.eligible).length;
    const riskDistribution = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((level) => ({
      level,
      count: profiles.filter((item) => item.riskLevel === level).length
    }));
    const bestDrivers = [...profiles]
      .sort((left, right) => right.rankingScore - left.rankingScore)
      .slice(0, 5)
      .map((item) => this.toRankingCard(item));
    const highRiskDrivers = [...profiles]
      .filter((item) => item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL")
      .sort((left, right) => left.driverScore - right.driverScore)
      .slice(0, 5)
      .map((item) => ({
        driverId: item.id,
        name: item.displayName,
        driverScore: item.driverScore,
        riskLevel: item.riskLevel,
        primaryReasons: item.eligibility.reasons.slice(0, 3)
      }));

    return {
      generatedAt: new Date().toISOString(),
      filters: this.serializeFilters(range, query),
      summaryCards: [
        { label: "Drivers monitored", value: profiles.length, subLabel: "Drivers in selected scope", tone: "info" },
        { label: "Average driver score", value: averageDriverScore, subLabel: "Weighted Phase 5 intelligence score", tone: averageDriverScore >= 85 ? "success" : averageDriverScore >= 70 ? "warning" : "danger" },
        { label: "Eligible for new vehicle", value: eligibleDrivers, subLabel: `${profiles.length - eligibleDrivers} need review`, tone: eligibleDrivers === profiles.length ? "success" : "warning" },
        { label: "Abnormal fuel events", value: fleetFuelInsights.abnormalUsageCount, subLabel: "Flagged for review only", tone: fleetFuelInsights.abnormalUsageCount > 0 ? "warning" : "success" },
        { label: "Net fleet cost", value: Math.round(fleetCostSummary.breakdown.netCost * 100) / 100, subLabel: "Fuel + maintenance + accident + fines - insurance", tone: "info" }
      ],
      riskDistribution,
      bestDrivers,
      highRiskDrivers,
      fuelInsights: fleetFuelInsights,
      fleetCostSummary,
      driverProfiles: profiles.map((item) => this.toListItem(item)).slice(0, 12),
      alerts: [
        ...highRiskDrivers.map((item) => ({ type: "High risk driver", message: `${item.name} requires review`, tone: "danger" as const })),
        ...fleetFuelInsights.anomalies.slice(0, 3).map((item) => ({ type: "Fuel anomaly", message: `${item.vehicleId} flagged at ${item.litersPer100Km.toFixed(1)} L/100km`, tone: "warning" as const }))
      ]
    };
  }

  async listDrivers(actor: Phase4Actor, query: DriverIntelligenceListQueryDto = {}) {
    const range = this.resolveDateRange(query);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
    const drivers = await this.findDrivers(actor, query);
    let profiles = await Promise.all(drivers.map((driver) => this.buildDriverProfile(driver, range, actor)));

    if (query.riskLevel) {
      profiles = profiles.filter((item) => item.riskLevel === query.riskLevel);
    }

    const sortDirection = query.sortDirection === "asc" ? 1 : -1;
    const sortBy = query.sortBy ?? "score";
    profiles = profiles.sort((left, right) => {
      if (sortBy === "name") {
        return left.displayName.localeCompare(right.displayName) * sortDirection;
      }

      if (sortBy === "eligibility") {
        return (Number(left.eligibility.eligible) - Number(right.eligibility.eligible)) * sortDirection;
      }

      if (sortBy === "riskLevel") {
        return (this.riskLevelRank(left.riskLevel) - this.riskLevelRank(right.riskLevel)) * sortDirection;
      }

      return (left.driverScore - right.driverScore) * sortDirection;
    });

    const total = profiles.length;
    const items = profiles.slice((page - 1) * pageSize, page * pageSize).map((item) => this.toListItem(item));

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      },
      filters: this.serializeFilters(range, query)
    };
  }

  async driverProfile(actor: Phase4Actor, driverId: string, query: IntelligenceFiltersDto = {}) {
    const range = this.resolveDateRange(query);
    const driver = await this.getDriverRecord(actor, driverId);
    return this.buildDriverProfile(driver, range, actor);
  }

  async driverEligibility(actor: Phase4Actor, driverId: string, query: IntelligenceFiltersDto = {}) {
    const profile = await this.driverProfile(actor, driverId, query);
    return profile.eligibility;
  }

  async updateDriverInputs(actor: Phase4Actor, driverId: string, input: UpdateDriverIntelligenceInputsDto) {
    const authActor = assertActor(actor);
    const driver = await this.getDriverRecord(actor, driverId);
    const updated = await this.prisma.driver.update({
      where: { id: driverId },
      data: {
        ...(input.trainingStatus ? { trainingStatus: input.trainingStatus } : {}),
        ...(input.trainingCompletedAt ? { trainingCompletedAt: new Date(input.trainingCompletedAt) } : {}),
        ...(input.trainingExpiry ? { trainingExpiry: new Date(input.trainingExpiry) } : {}),
        ...(typeof input.supervisorReviewScore === "number" ? { supervisorReviewScore: input.supervisorReviewScore } : {}),
        ...(typeof input.pendingDisciplinaryIssues === "number"
          ? { pendingDisciplinaryIssues: input.pendingDisciplinaryIssues }
          : {})
      }
    });

    await recordPhase4Audit(this.prisma, {
      entity: "Driver",
      entityId: driverId,
      action: AuditAction.UPDATE,
      module: "driver-intelligence",
      actor: authActor,
      reason: "Driver intelligence inputs updated",
      metadata: {
        action: "update_inputs",
        changedKeys: Object.keys(input)
      },
      beforeData: {
        trainingStatus: driver.trainingStatus,
        trainingCompletedAt: driver.trainingCompletedAt?.toISOString() ?? null,
        trainingExpiry: driver.trainingExpiry?.toISOString() ?? null,
        supervisorReviewScore: driver.supervisorReviewScore,
        pendingDisciplinaryIssues: driver.pendingDisciplinaryIssues
      },
      afterData: {
        trainingStatus: updated.trainingStatus,
        trainingCompletedAt: updated.trainingCompletedAt?.toISOString() ?? null,
        trainingExpiry: updated.trainingExpiry?.toISOString() ?? null,
        supervisorReviewScore: updated.supervisorReviewScore,
        pendingDisciplinaryIssues: updated.pendingDisciplinaryIssues
      }
    });

    return updated;
  }

  async bestDrivers(actor: Phase4Actor, query: BestDriversQueryDto = {}) {
    const range = this.resolveRankingRange(query);
    const drivers = await this.findDrivers(actor, query);
    const profiles = await Promise.all(drivers.map((driver) => this.buildDriverProfile(driver, range, actor)));
    const limit = Math.max(1, Math.min(50, query.limit ?? DEFAULT_BEST_DRIVER_LIMIT));

    return {
      period: query.period ?? "monthly",
      range: { startDate: range.start.toISOString(), endDate: range.end.toISOString() },
      items: profiles
        .sort((left, right) => right.rankingScore - left.rankingScore)
        .slice(0, limit)
        .map((item, index) => ({
          rank: index + 1,
          ...this.toRankingCard(item)
        }))
    };
  }

  async vehicleCostSummary(actor: Phase4Actor, vehicleId: string, query: IntelligenceFiltersDto = {}) {
    const range = this.resolveDateRange(query);
    const vehicle = await this.getVehicleRecord(actor, vehicleId);
    const summary = await this.aggregateFleetCosts(actor, range, [vehicleId]);

    return {
      vehicle: {
        id: vehicle.id,
        registrationNo: vehicle.registrationNo,
        vehicleModel: vehicle.vehicleModel,
        status: vehicle.status,
        complianceStatus: vehicle.complianceStatus,
        serviceStatus: vehicle.serviceStatus
      },
      period: { startDate: range.start.toISOString(), endDate: range.end.toISOString() },
      ...summary
    };
  }

  private async findDrivers(
    actor: Phase4Actor,
    query: Pick<DriverIntelligenceListQueryDto, "departmentId" | "vehicleId" | "search"> & { driverId?: string }
  ) {
    const tenantId = resolveTenantId(actor);
    const where: Prisma.DriverWhereInput = {
      ...(tenantId !== undefined ? { tenantId } : {}),
      ...(query.driverId ? { id: query.driverId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.vehicleId ? { vehicles: { some: { id: query.vehicleId } } } : {})
    };

    if (actor.role === "DRIVER") {
      where.userId = actor.sub;
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { licenseNumber: { contains: search, mode: "insensitive" } },
        { user: { is: { firstName: { contains: search, mode: "insensitive" } } } },
        { user: { is: { lastName: { contains: search, mode: "insensitive" } } } },
        { user: { is: { email: { contains: search, mode: "insensitive" } } } },
        { vehicles: { some: { registrationNo: { contains: search, mode: "insensitive" } } } }
      ];
    }

    return this.prisma.driver.findMany({
      where,
      include: driverInclude,
      orderBy: { createdAt: "desc" },
      take: 250
    });
  }

  private async getDriverRecord(actor: Phase4Actor, driverId: string) {
    if (!isValidObjectId(driverId)) {
      throw new BadRequestException("Invalid driver id");
    }

    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: driverInclude
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    const tenantId = resolveTenantId(actor);
    if (tenantId !== undefined && driver.tenantId && driver.tenantId !== tenantId) {
      throw new ForbiddenException("Driver not in your tenant");
    }

    if (actor.role === "DRIVER" && driver.userId !== actor.sub) {
      throw new ForbiddenException("You can only view your own driver profile");
    }

    return driver;
  }

  private async getVehicleRecord(actor: Phase4Actor, vehicleId: string) {
    if (!isValidObjectId(vehicleId)) {
      throw new BadRequestException("Invalid vehicle id");
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        tenantId: true,
        registrationNo: true,
        vehicleModel: true,
        status: true,
        complianceStatus: true,
        serviceStatus: true
      }
    });

    if (!vehicle) {
      throw new NotFoundException("Vehicle not found");
    }

    const tenantId = resolveTenantId(actor);
    if (tenantId !== undefined && vehicle.tenantId && vehicle.tenantId !== tenantId) {
      throw new ForbiddenException("Vehicle not in your tenant");
    }

    return vehicle;
  }

  private async buildDriverProfile(driver: DriverRecord, range: DateRange, actor: Phase4Actor) {
    const tenantId = resolveTenantId(actor);
    const assignedVehicleIds = driver.vehicles.map((vehicle) => vehicle.id);

    const [driverAccidents, vehicleDefectAccidents, driverFines, vehicleDefectFines, trips, attributedFuelLogs, assignedVehicleFuelLogs, workOrders, maintenanceLogs] =
      await Promise.all([
        this.prisma.accidentReport.findMany({
          where: {
            ...(tenantId !== undefined ? { tenantId } : {}),
            driverId: driver.id,
            occurredAt: { gte: range.start, lte: range.end }
          },
          select: {
            id: true,
            reportNumber: true,
            occurredAt: true,
            severity: true,
            responsibility: true,
            location: true,
            status: true,
            vehicleId: true
          },
          orderBy: { occurredAt: "desc" }
        }),
        assignedVehicleIds.length > 0
          ? this.prisma.accidentReport.findMany({
              where: {
                ...(tenantId !== undefined ? { tenantId } : {}),
                vehicleId: { in: assignedVehicleIds },
                responsibility: AccidentResponsibility.VEHICLE_DEFECT,
                occurredAt: { gte: range.start, lte: range.end }
              },
              select: {
                id: true,
                reportNumber: true,
                occurredAt: true,
                severity: true,
                responsibility: true,
                vehicleId: true
              },
              orderBy: { occurredAt: "desc" }
            })
          : Promise.resolve([]),
        this.prisma.trafficFine.findMany({
          where: {
            ...(tenantId !== undefined ? { tenantId } : {}),
            driverId: driver.id,
            fineDate: { gte: range.start, lte: range.end }
          },
          select: {
            id: true,
            fineNumber: true,
            fineDate: true,
            fineAmount: true,
            description: true,
            violationCode: true,
            responsibility: true,
            documentRelated: true,
            paymentStatus: true,
            vehicleId: true
          },
          orderBy: { fineDate: "desc" }
        }),
        assignedVehicleIds.length > 0
          ? this.prisma.trafficFine.findMany({
              where: {
                ...(tenantId !== undefined ? { tenantId } : {}),
                vehicleId: { in: assignedVehicleIds },
                responsibility: FineResponsibility.VEHICLE_DEFECT,
                fineDate: { gte: range.start, lte: range.end }
              },
              select: {
                id: true,
                fineNumber: true,
                fineDate: true,
                fineAmount: true,
                description: true,
                violationCode: true,
                responsibility: true,
                vehicleId: true
              },
              orderBy: { fineDate: "desc" }
            })
          : Promise.resolve([]),
        this.prisma.tripLog.findMany({
          where: {
            driverId: driver.id,
            startTime: { gte: range.start, lte: range.end },
            ...(tenantId !== undefined ? { vehicle: { is: { tenantId } } } : {})
          },
          select: {
            id: true,
            vehicleId: true,
            distance: true,
            startTime: true,
            endTime: true,
            status: true
          },
          orderBy: { startTime: "desc" }
        }),
        this.prisma.fuelLog.findMany({
          where: {
            driverId: driver.id,
            date: { gte: range.start, lte: range.end },
            ...(tenantId !== undefined ? { vehicle: { is: { tenantId } } } : {})
          },
          orderBy: [{ vehicleId: "asc" }, { mileageAtFuel: "asc" }, { date: "asc" }],
          select: {
            id: true,
            vehicleId: true,
            driverId: true,
            date: true,
            liters: true,
            costPerLiter: true,
            totalCost: true,
            mileageAtFuel: true
          }
        }),
        assignedVehicleIds.length > 0
          ? this.prisma.fuelLog.findMany({
              where: {
                vehicleId: { in: assignedVehicleIds },
                date: { gte: range.start, lte: range.end },
                ...(tenantId !== undefined ? { vehicle: { is: { tenantId } } } : {})
              },
              orderBy: [{ vehicleId: "asc" }, { mileageAtFuel: "asc" }, { date: "asc" }],
              select: {
                id: true,
                vehicleId: true,
                driverId: true,
                date: true,
                liters: true,
                costPerLiter: true,
                totalCost: true,
                mileageAtFuel: true
              }
            })
          : Promise.resolve([]),
        assignedVehicleIds.length > 0
          ? this.prisma.workOrder.findMany({
              where: {
                ...(tenantId !== undefined ? { tenantId } : {}),
                vehicleId: { in: assignedVehicleIds },
                createdAt: { gte: range.start, lte: range.end }
              },
              select: {
                id: true,
                woNumber: true,
                type: true,
                status: true,
                actualCost: true,
                estimatedCost: true,
                createdAt: true,
                completedDate: true,
                dueDate: true,
                vehicleId: true
              },
              orderBy: { createdAt: "desc" }
            })
          : Promise.resolve([]),
        assignedVehicleIds.length > 0
          ? this.prisma.maintenanceLog.findMany({
              where: {
                vehicleId: { in: assignedVehicleIds },
                performedAt: { gte: range.start, lte: range.end },
                ...(tenantId !== undefined ? { vehicle: { is: { tenantId } } } : {})
              },
              select: {
                id: true,
                vehicleId: true,
                performedAt: true,
                cost: true,
                workOrderId: true,
                description: true
              },
              orderBy: { performedAt: "desc" }
            })
          : Promise.resolve([])
      ]);

    const driverFaultAccidents = driverAccidents.filter((item) => item.responsibility === AccidentResponsibility.DRIVER);
    const driverRelatedFines = driverFines.filter(
      (item) => item.responsibility === FineResponsibility.DRIVER || item.responsibility === FineResponsibility.UNDETERMINED
    );
    const organizationFines = driverFines.filter((item) => item.responsibility === FineResponsibility.ORGANIZATION);
    const vehicleDefectLinkedDriverFines = driverFines.filter((item) => item.responsibility === FineResponsibility.VEHICLE_DEFECT);
    const vehicleDefectFineCount = new Set([
      ...vehicleDefectFines.map((item) => item.id),
      ...vehicleDefectLinkedDriverFines.map((item) => item.id)
    ]).size;
    const safetyAccidentPenalty = driverFaultAccidents.reduce((sum, item) => sum + this.accidentPenalty(item.severity), 0);
    const safetyFinePenalty = driverRelatedFines.reduce((sum, item) => {
      const multiplier = item.responsibility === FineResponsibility.UNDETERMINED ? 0.5 : 1;
      return sum + this.finePenalty(item) * multiplier;
    }, 0);
    const safetyScore = this.clampScore(100 - safetyAccidentPenalty - safetyFinePenalty);

    const attributedFuelInsights = this.buildFuelInsights(attributedFuelLogs);
    const assignedVehicleFuelInsights = this.buildFuelInsights(assignedVehicleFuelLogs);

    const completedTrips = trips.filter((item) => item.status === TripStatus.COMPLETED).length;
    const tripReliabilityScore = trips.length === 0 ? 60 : Math.round((completedTrips / trips.length) * 100);
    const fuelEfficiencyScore = this.fuelEfficiencyScore(attributedFuelInsights);
    const vehicleCareScore = this.vehicleCareScore(driver, workOrders, vehicleDefectFines, vehicleDefectAccidents);
    const complianceReadinessScore = this.complianceReadinessScore(driver);
    const supervisorReviewScore = this.clampScore(driver.supervisorReviewScore ?? 70);

    let driverScore = Math.round(
      safetyScore * 0.4 +
        vehicleCareScore * 0.18 +
        tripReliabilityScore * 0.12 +
        fuelEfficiencyScore * 0.08 +
        complianceReadinessScore * 0.12 +
        supervisorReviewScore * 0.1
    );

    driverScore = this.clampScore(driverScore - driver.pendingDisciplinaryIssues * 6);
    if (!this.isLicenseValid(driver.licenseExpiry)) {
      driverScore = Math.min(driverScore, 35);
    }

    const seriousDriverFines = driverRelatedFines.filter((item) => {
      const severity = this.fineSeverity(item.fineAmount, item.description, item.violationCode);
      return severity === "HIGH" || severity === "CRITICAL";
    });

    const riskLevel = this.classifyRiskLevel(driverScore, {
      licenseValid: this.isLicenseValid(driver.licenseExpiry),
      pendingDisciplinaryIssues: driver.pendingDisciplinaryIssues,
      seriousDriverFines: seriousDriverFines.length,
      driverFaultAccidents: driverFaultAccidents.length,
      nonCompliantVehicles: driver.vehicles.filter((item) => item.complianceStatus === ComplianceStatus.NON_COMPLIANT).length
    });

    const accidentFreeScore = this.clampScore(100 - safetyAccidentPenalty * 1.4);
    const fineFreeScore = this.clampScore(100 - safetyFinePenalty * 2.2);
    const rankingScore = Math.round(
      accidentFreeScore * 0.25 +
        fineFreeScore * 0.2 +
        vehicleCareScore * 0.2 +
        fuelEfficiencyScore * 0.1 +
        tripReliabilityScore * 0.1 +
        complianceReadinessScore * 0.1 +
        supervisorReviewScore * 0.05
    );

    const eligibility = this.evaluateEligibility({
      driver,
      driverScore,
      riskLevel,
      seriousDriverFines: seriousDriverFines.length,
      driverFaultAccidents: driverFaultAccidents.length,
      vehicleCareScore
    });

    return {
      id: driver.id,
      userId: driver.userId,
      displayName: this.displayName(driver),
      department: driver.department,
      driverScore,
      riskLevel,
      rankingScore,
      assignedVehicles: driver.vehicles.map((vehicle) => ({
        id: vehicle.id,
        registrationNo: vehicle.registrationNo,
        vehicleModel: vehicle.vehicleModel,
        status: vehicle.status,
        complianceStatus: vehicle.complianceStatus,
        serviceStatus: vehicle.serviceStatus,
        currentMileage: vehicle.currentMileage,
        type: vehicle.type
      })),
      license: {
        number: driver.licenseNumber,
        licenseClass: driver.licenseClass,
        expiry: driver.licenseExpiry.toISOString(),
        valid: this.isLicenseValid(driver.licenseExpiry),
        expiresInDays: this.daysUntil(driver.licenseExpiry)
      },
      inputs: {
        trainingStatus: driver.trainingStatus,
        trainingCompletedAt: driver.trainingCompletedAt?.toISOString() ?? null,
        trainingExpiry: driver.trainingExpiry?.toISOString() ?? null,
        supervisorReviewScore: driver.supervisorReviewScore,
        pendingDisciplinaryIssues: driver.pendingDisciplinaryIssues
      },
      components: {
        safetyScore,
        vehicleCareScore,
        tripReliabilityScore,
        fuelEfficiencyScore,
        complianceReadinessScore,
        supervisorReviewScore
      },
      summary: {
        driverFaultAccidents: driverFaultAccidents.length,
        driverRelatedFines: driverRelatedFines.length,
        organizationFines: organizationFines.length,
        documentRelatedOrganizationFines: organizationFines.filter((item) => item.documentRelated).length,
        vehicleDefectFines: vehicleDefectFineCount,
        abnormalFuelUsageCount: assignedVehicleFuelInsights.abnormalUsageCount,
        totalTrips: trips.length,
        completedTrips,
        correctiveWorkOrders: workOrders.filter((item) => item.type === WorkOrderType.CORRECTIVE).length,
        overdueAssignedVehicles: driver.vehicles.filter((item) => item.serviceStatus === VehicleServiceStatus.OVERDUE).length,
        nonCompliantAssignedVehicles: driver.vehicles.filter((item) => item.complianceStatus === ComplianceStatus.NON_COMPLIANT).length
      },
      fuel: {
        attributed: attributedFuelInsights,
        assignedVehicleFlags: assignedVehicleFuelInsights
      },
      eligibility,
      linkedData: {
        accidents: driverAccidents.slice(0, 6).map((item) => ({
          id: item.id,
          reportNumber: item.reportNumber,
          occurredAt: item.occurredAt.toISOString(),
          severity: item.severity,
          responsibility: item.responsibility,
          status: item.status,
          vehicleId: item.vehicleId,
          location: item.location
        })),
        fines: driverFines.slice(0, 6).map((item) => ({
          id: item.id,
          fineNumber: item.fineNumber,
          fineDate: item.fineDate.toISOString(),
          fineAmount: item.fineAmount,
          responsibility: item.responsibility,
          severity: this.fineSeverity(item.fineAmount, item.description, item.violationCode),
          description: item.description,
          paymentStatus: item.paymentStatus,
          documentRelated: item.documentRelated
        })),
        workOrders: workOrders.slice(0, 6).map((item) => ({
          id: item.id,
          woNumber: item.woNumber,
          type: item.type,
          status: item.status,
          actualCost: item.actualCost,
          estimatedCost: item.estimatedCost,
          createdAt: item.createdAt.toISOString()
        })),
        maintenanceLogs: maintenanceLogs.slice(0, 6).map((item) => ({
          id: item.id,
          performedAt: item.performedAt.toISOString(),
          cost: item.cost,
          description: item.description
        }))
      }
    };
  }

  private vehicleCareScore(
    driver: DriverRecord,
    workOrders: Array<{ type: WorkOrderType; status: WorkOrderStatus }>,
    vehicleDefectFines: Array<unknown>,
    vehicleDefectAccidents: Array<unknown>
  ) {
    const nonCompliantVehicles = driver.vehicles.filter((item) => item.complianceStatus === ComplianceStatus.NON_COMPLIANT).length;
    const attentionVehicles = driver.vehicles.filter((item) => item.complianceStatus === ComplianceStatus.ATTENTION_REQUIRED).length;
    const overdueVehicles = driver.vehicles.filter((item) => item.serviceStatus === VehicleServiceStatus.OVERDUE).length;
    const correctiveOrders = workOrders.filter((item) => item.type === WorkOrderType.CORRECTIVE && item.status !== WorkOrderStatus.COMPLETED).length;
    const emergencyOrders = workOrders.filter((item) => item.type === WorkOrderType.EMERGENCY && item.status !== WorkOrderStatus.COMPLETED).length;

    return this.clampScore(
      100 -
        nonCompliantVehicles * 20 -
        attentionVehicles * 8 -
        overdueVehicles * 10 -
        vehicleDefectFines.length * 6 -
        vehicleDefectAccidents.length * 8 -
        correctiveOrders * 4 -
        emergencyOrders * 3
    );
  }

  private complianceReadinessScore(driver: DriverRecord) {
    let score = this.isLicenseValid(driver.licenseExpiry) ? 78 : 0;
    if (this.daysUntil(driver.licenseExpiry) <= 30) {
      score -= 12;
    }

    if (driver.trainingStatus === DriverTrainingStatus.CURRENT) {
      score += 15;
    } else if (driver.trainingStatus === DriverTrainingStatus.IN_PROGRESS) {
      score += 8;
    } else if (driver.trainingStatus === DriverTrainingStatus.EXPIRED) {
      score -= 10;
    }

    if (driver.vehicles.length > 0 && driver.vehicles.every((item) => item.complianceStatus === ComplianceStatus.COMPLIANT)) {
      score += 7;
    }

    return this.clampScore(score);
  }

  private evaluateEligibility(input: {
    driver: DriverRecord;
    driverScore: number;
    riskLevel: DriverRiskLevel;
    seriousDriverFines: number;
    driverFaultAccidents: number;
    vehicleCareScore: number;
  }) {
    const reasons: string[] = [];

    if (!this.isLicenseValid(input.driver.licenseExpiry)) {
      reasons.push("Driver license is expired");
    }
    if (input.riskLevel === "HIGH" || input.riskLevel === "CRITICAL") {
      reasons.push(`Driver risk level is ${input.riskLevel}`);
    }
    if (input.seriousDriverFines > 0) {
      reasons.push(`${input.seriousDriverFines} serious driver-related fine(s) in the selected period`);
    }
    if (input.driverFaultAccidents > 0) {
      reasons.push(`${input.driverFaultAccidents} driver-fault accident(s) in the selected period`);
    }
    if (input.driver.pendingDisciplinaryIssues > 0) {
      reasons.push(`${input.driver.pendingDisciplinaryIssues} pending disciplinary issue(s)`);
    }
    if (input.vehicleCareScore < 70) {
      reasons.push("Vehicle care score is below the minimum threshold");
    }

    return {
      eligible: reasons.length === 0,
      reasons,
      reviewedScore: input.driverScore,
      minimumVehicleCareScore: 70,
      vehicleCareScore: input.vehicleCareScore
    };
  }

  private classifyRiskLevel(
    driverScore: number,
    conditions: {
      licenseValid: boolean;
      pendingDisciplinaryIssues: number;
      seriousDriverFines: number;
      driverFaultAccidents: number;
      nonCompliantVehicles: number;
    }
  ): DriverRiskLevel {
    if (!conditions.licenseValid) {
      return "CRITICAL";
    }
    if (driverScore < 55 || conditions.pendingDisciplinaryIssues >= 2) {
      return "CRITICAL";
    }
    if (driverScore < 70 || conditions.seriousDriverFines > 0 || conditions.driverFaultAccidents > 0) {
      return "HIGH";
    }
    if (driverScore < 85 || conditions.nonCompliantVehicles > 0) {
      return "MEDIUM";
    }
    return "LOW";
  }

  private accidentPenalty(severity: AccidentSeverity) {
    switch (severity) {
      case AccidentSeverity.MINOR:
        return 12;
      case AccidentSeverity.MODERATE:
        return 18;
      case AccidentSeverity.MAJOR:
        return 28;
      case AccidentSeverity.TOTAL_LOSS:
        return 35;
      default:
        return 12;
    }
  }

  private finePenalty(fine: { fineAmount: number; description: string; violationCode: string | null }) {
    const severity = this.fineSeverity(fine.fineAmount, fine.description, fine.violationCode);
    switch (severity) {
      case "LOW":
        return 4;
      case "MEDIUM":
        return 8;
      case "HIGH":
        return 12;
      case "CRITICAL":
        return 18;
      default:
        return 8;
    }
  }

  private fineSeverity(fineAmount: number, description: string, violationCode: string | null): FineSeverity {
    const descriptor = `${violationCode ?? ""} ${description}`.toLowerCase();
    if (/(dui|reckless|dangerous|suspended|disqualified)/.test(descriptor) || fineAmount >= 500) {
      return "CRITICAL";
    }
    if (/(speeding|overload|overloading|red light|signal)/.test(descriptor) || fineAmount >= 250) {
      return "HIGH";
    }
    if (fineAmount >= 100) {
      return "MEDIUM";
    }
    return "LOW";
  }

  private buildFuelInsights(
    logs: Array<{
      vehicleId: string;
      date: Date;
      liters: number;
      costPerLiter: number;
      totalCost: number;
      mileageAtFuel: number;
    }>
  ): FuelInsights {
    const totalLiters = logs.reduce((sum, item) => sum + Number(item.liters), 0);
    const totalCost = logs.reduce((sum, item) => sum + Number(item.totalCost), 0);
    const avgCostPerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;
    const intervals: FuelInterval[] = [];
    const byVehicle = new Map<string, typeof logs>();

    for (const log of logs) {
      const items = byVehicle.get(log.vehicleId) ?? [];
      items.push(log);
      byVehicle.set(log.vehicleId, items);
    }

    for (const [vehicleId, items] of byVehicle.entries()) {
      const sorted = [...items].sort((left, right) => {
        const mileageDiff = Number(left.mileageAtFuel) - Number(right.mileageAtFuel);
        if (mileageDiff !== 0) {
          return mileageDiff;
        }
        return left.date.getTime() - right.date.getTime();
      });

      for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        const distance = Number(current.mileageAtFuel) - Number(previous.mileageAtFuel);

        if (distance <= 0) {
          continue;
        }

        intervals.push({
          vehicleId,
          date: current.date,
          liters: Number(current.liters),
          distance,
          litersPer100Km: (Number(current.liters) / distance) * 100,
          totalCost: Number(current.totalCost)
        });
      }
    }

    const baseline =
      intervals.length > 0 ? intervals.reduce((sum, item) => sum + item.litersPer100Km, 0) / intervals.length : null;
    const anomalies =
      baseline === null
        ? []
        : intervals.filter(
            (item) =>
              item.litersPer100Km > baseline * 1.35 ||
              item.litersPer100Km < baseline * 0.55 ||
              (item.distance < 25 && item.liters > 12)
          );

    const monthlyTrendMap = new Map<string, { totalCost: number; liters: number }>();
    for (const log of logs) {
      const key = log.date.toISOString().slice(0, 7);
      const current = monthlyTrendMap.get(key) ?? { totalCost: 0, liters: 0 };
      current.totalCost += Number(log.totalCost);
      current.liters += Number(log.liters);
      monthlyTrendMap.set(key, current);
    }

    return {
      totalLiters,
      totalCost,
      avgCostPerLiter,
      avgConsumption: baseline === null ? null : Math.round(baseline * 100) / 100,
      distance: intervals.reduce((sum, item) => sum + item.distance, 0),
      abnormalUsageCount: anomalies.length,
      anomalies: anomalies.map((item) => ({
        vehicleId: item.vehicleId,
        date: item.date.toISOString(),
        litersPer100Km: Math.round(item.litersPer100Km * 100) / 100,
        distance: item.distance,
        liters: item.liters
      })),
      monthlyTrend: [...monthlyTrendMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([period, value]) => ({ period, totalCost: Math.round(value.totalCost * 100) / 100, liters: Math.round(value.liters * 100) / 100 }))
    };
  }

  private fuelEfficiencyScore(insights: FuelInsights) {
    if (insights.avgConsumption === null) {
      return 65;
    }
    if (insights.abnormalUsageCount > 0) {
      return 62;
    }
    if (insights.avgConsumption <= 8) {
      return 95;
    }
    if (insights.avgConsumption <= 10) {
      return 85;
    }
    if (insights.avgConsumption <= 13) {
      return 72;
    }
    return 60;
  }

  private async aggregateFleetCosts(actor: Phase4Actor, range: DateRange, vehicleIds?: string[]) {
    const tenantId = resolveTenantId(actor);
    const vehicleFilter = vehicleIds && vehicleIds.length > 0 ? { in: vehicleIds } : undefined;

    const [fuelLogs, workOrders, maintenanceLogs, accidents, fines, claims] = await Promise.all([
      this.prisma.fuelLog.findMany({
        where: {
          ...(vehicleFilter ? { vehicleId: vehicleFilter } : {}),
          date: { gte: range.start, lte: range.end },
          ...(tenantId !== undefined ? { vehicle: { is: { tenantId } } } : {})
        },
        select: { vehicleId: true, date: true, totalCost: true, liters: true }
      }),
      this.prisma.workOrder.findMany({
        where: {
          ...(tenantId !== undefined ? { tenantId } : {}),
          ...(vehicleFilter ? { vehicleId: vehicleFilter } : {}),
          createdAt: { gte: range.start, lte: range.end }
        },
        select: { vehicleId: true, createdAt: true, actualCost: true }
      }),
      this.prisma.maintenanceLog.findMany({
        where: {
          ...(vehicleFilter ? { vehicleId: vehicleFilter } : {}),
          performedAt: { gte: range.start, lte: range.end },
          ...(tenantId !== undefined ? { vehicle: { is: { tenantId } } } : {})
        },
        select: { vehicleId: true, performedAt: true, cost: true, workOrderId: true }
      }),
      this.prisma.accidentReport.findMany({
        where: {
          ...(tenantId !== undefined ? { tenantId } : {}),
          ...(vehicleFilter ? { vehicleId: vehicleFilter } : {}),
          occurredAt: { gte: range.start, lte: range.end }
        },
        select: { vehicleId: true, occurredAt: true, actualDamageCost: true, estimatedDamageCost: true }
      }),
      this.prisma.trafficFine.findMany({
        where: {
          ...(tenantId !== undefined ? { tenantId } : {}),
          ...(vehicleFilter ? { vehicleId: vehicleFilter } : {}),
          fineDate: { gte: range.start, lte: range.end }
        },
        select: { vehicleId: true, fineDate: true, fineAmount: true, paidAmount: true }
      }),
      this.prisma.insuranceClaim.findMany({
        where: {
          ...(tenantId !== undefined ? { tenantId } : {}),
          ...(vehicleFilter ? { vehicleId: vehicleFilter } : {}),
          createdAt: { gte: range.start, lte: range.end }
        },
        select: { vehicleId: true, createdAt: true, approvedAmount: true }
      })
    ]);

    const breakdown = {
      fuelCost: fuelLogs.reduce((sum, item) => sum + Number(item.totalCost), 0),
      maintenanceCost:
        workOrders.reduce((sum, item) => sum + Number(item.actualCost ?? 0), 0) +
        maintenanceLogs.filter((item) => !item.workOrderId).reduce((sum, item) => sum + Number(item.cost ?? 0), 0),
      accidentCost: accidents.reduce((sum, item) => sum + Number(item.actualDamageCost ?? item.estimatedDamageCost ?? 0), 0),
      fineCost: fines.reduce((sum, item) => sum + Number(item.paidAmount ?? item.fineAmount), 0),
      insuranceRecovery: claims.reduce((sum, item) => sum + Number(item.approvedAmount ?? 0), 0),
      netCost: 0
    };
    breakdown.netCost = breakdown.fuelCost + breakdown.maintenanceCost + breakdown.accidentCost + breakdown.fineCost - breakdown.insuranceRecovery;

    const monthly = new Map<string, { fuelCost: number; maintenanceCost: number; accidentCost: number; fineCost: number; insuranceRecovery: number }>();
    const ensureMonth = (value: Date) => {
      const key = value.toISOString().slice(0, 7);
      const current = monthly.get(key) ?? {
        fuelCost: 0,
        maintenanceCost: 0,
        accidentCost: 0,
        fineCost: 0,
        insuranceRecovery: 0
      };
      monthly.set(key, current);
      return current;
    };

    for (const item of fuelLogs) {
      ensureMonth(item.date).fuelCost += Number(item.totalCost);
    }
    for (const item of workOrders) {
      ensureMonth(item.createdAt).maintenanceCost += Number(item.actualCost ?? 0);
    }
    for (const item of maintenanceLogs.filter((entry) => !entry.workOrderId)) {
      ensureMonth(item.performedAt).maintenanceCost += Number(item.cost ?? 0);
    }
    for (const item of accidents) {
      ensureMonth(item.occurredAt).accidentCost += Number(item.actualDamageCost ?? item.estimatedDamageCost ?? 0);
    }
    for (const item of fines) {
      ensureMonth(item.fineDate).fineCost += Number(item.paidAmount ?? item.fineAmount);
    }
    for (const item of claims) {
      ensureMonth(item.createdAt).insuranceRecovery += Number(item.approvedAmount ?? 0);
    }

    return {
      breakdown: {
        fuelCost: Math.round(breakdown.fuelCost * 100) / 100,
        maintenanceCost: Math.round(breakdown.maintenanceCost * 100) / 100,
        accidentCost: Math.round(breakdown.accidentCost * 100) / 100,
        fineCost: Math.round(breakdown.fineCost * 100) / 100,
        insuranceRecovery: Math.round(breakdown.insuranceRecovery * 100) / 100,
        netCost: Math.round(breakdown.netCost * 100) / 100
      },
      monthlyTrend: [...monthly.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([period, value]) => ({
          period,
          fuelCost: Math.round(value.fuelCost * 100) / 100,
          maintenanceCost: Math.round(value.maintenanceCost * 100) / 100,
          accidentCost: Math.round(value.accidentCost * 100) / 100,
          fineCost: Math.round(value.fineCost * 100) / 100,
          insuranceRecovery: Math.round(value.insuranceRecovery * 100) / 100,
          netCost: Math.round((value.fuelCost + value.maintenanceCost + value.accidentCost + value.fineCost - value.insuranceRecovery) * 100) / 100
        }))
    };
  }

  private resolveDateRange(query: Pick<IntelligenceFiltersDto, "startDate" | "endDate">): DateRange {
    const end = query.endDate ? new Date(query.endDate) : new Date();
    const start = query.startDate
      ? new Date(query.startDate)
      : new Date(end.getTime() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException("Invalid date range supplied");
    }
    if (start.getTime() > end.getTime()) {
      throw new BadRequestException("startDate must be before endDate");
    }

    return { start, end };
  }

  private resolveRankingRange(query: BestDriversQueryDto): DateRange {
    if (query.period === "annual") {
      const year = query.year ?? new Date().getUTCFullYear();
      return {
        start: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
        end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
      };
    }

    if (query.period === "custom") {
      return this.resolveDateRange(query);
    }

    const now = new Date();
    const year = query.year ?? now.getUTCFullYear();
    const month = (query.month ?? now.getUTCMonth() + 1) - 1;
    return {
      start: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999))
    };
  }

  private tenantVehicleWhere(actor: Phase4Actor): Prisma.VehicleWhereInput | undefined {
    const tenantId = resolveTenantId(actor);
    if (tenantId === undefined) {
      return undefined;
    }
    return { tenantId };
  }

  private displayName(driver: DriverRecord) {
    const first = driver.user?.firstName?.trim() ?? "";
    const last = driver.user?.lastName?.trim() ?? "";
    const joined = [first, last].filter(Boolean).join(" ");
    return joined || driver.user?.email || driver.licenseNumber;
  }

  private serializeFilters(range: DateRange, query: IntelligenceFiltersDto) {
    return {
      startDate: range.start.toISOString(),
      endDate: range.end.toISOString(),
      departmentId: query.departmentId ?? null,
      driverId: query.driverId ?? null,
      vehicleId: query.vehicleId ?? null,
      status: query.status ?? null
    };
  }

  private toListItem(profile: Awaited<ReturnType<DriverIntelligenceService["buildDriverProfile"]>>) {
    return {
      id: profile.id,
      displayName: profile.displayName,
      driverScore: profile.driverScore,
      riskLevel: profile.riskLevel,
      rankingScore: profile.rankingScore,
      eligibleForNewVehicle: profile.eligibility.eligible,
      department: profile.department?.name ?? null,
      assignedVehicleCount: profile.assignedVehicles.length,
      inputs: profile.inputs,
      summary: profile.summary,
      license: profile.license,
      components: profile.components
    };
  }

  private toRankingCard(profile: Awaited<ReturnType<DriverIntelligenceService["buildDriverProfile"]>>) {
    return {
      driverId: profile.id,
      name: profile.displayName,
      rankingScore: profile.rankingScore,
      driverScore: profile.driverScore,
      riskLevel: profile.riskLevel,
      assignedVehicleCount: profile.assignedVehicles.length,
      supervisorReviewScore: profile.components.supervisorReviewScore,
      eligibility: profile.eligibility.eligible
    };
  }

  private clampScore(value: number) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private isLicenseValid(expiry: Date) {
    return expiry.getTime() >= Date.now();
  }

  private daysUntil(date: Date) {
    return Math.floor((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  }

  private riskLevelRank(level: DriverRiskLevel) {
    switch (level) {
      case "LOW":
        return 1;
      case "MEDIUM":
        return 2;
      case "HIGH":
        return 3;
      case "CRITICAL":
        return 4;
      default:
        return 4;
    }
  }
}