import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { VehicleStatus } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { FleetService } from "../fleet/fleet.service";

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fleetService: FleetService
  ) {}

  findAll() {
    return this.prisma.vehicle.findMany({ include: { driver: { include: { user: true } } }, orderBy: { createdAt: "desc" } });
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
