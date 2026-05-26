import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { VehiclesService } from "./vehicles.service";

@ApiTags("Vehicles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("vehicles")
export class VehiclesController {
  constructor(@Inject(VehiclesService) private readonly vehiclesService: VehiclesService) {}

  @Get()
  @Permissions("vehicles.view")
  async findAll(
    @Query("q") q?: string,
    @Query("status") statusRaw?: string | string[],
    @Query("sortBy") sortByRaw?: string,
    @Query("sortDir") sortDirRaw?: string,
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string
  ) {
    const data = await this.vehiclesService.findAll({
      q,
      status: this.parseStatuses(statusRaw),
      sortBy: this.parseSortBy(sortByRaw),
      sortDir: sortDirRaw === "asc" ? "asc" : "desc",
      page: this.toPositiveInt(pageRaw, 1),
      pageSize: this.toPositiveInt(pageSizeRaw, 12)
    });

    return { data, message: "Vehicles fetched" };
  }

  @Get("summary")
  @Permissions("vehicles.view")
  async summary(@Query("upcomingDays") upcomingDaysRaw?: string) {
    const data = await this.vehiclesService.summary(this.toPositiveInt(upcomingDaysRaw, 14));
    return { data, message: "Vehicle summary fetched" };
  }

  @Get("alerts")
  @Permissions("vehicles.view")
  async alerts(@Query("upcomingDays") upcomingDaysRaw?: string, @Query("limit") limitRaw?: string) {
    const data = await this.vehiclesService.alerts({
      upcomingDays: this.toPositiveInt(upcomingDaysRaw, 14),
      limit: this.toPositiveInt(limitRaw, 12)
    });
    return { data, message: "Vehicle alerts fetched" };
  }

  @Post()
  @Permissions("vehicles.create")
  async create(
    @Body()
    body: {
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
      acquisitionDate?: string;
      purchasePrice?: number;
      currentValue?: number;
      warrantyExpiry?: string;
      costCenter?: string;
      vendorName?: string;
      customFields?: Record<string, unknown>;
    }
  ) {
    const data = await this.vehiclesService.create(body);
    return { data, message: "Vehicle created" };
  }

  @Get(":id")
  @Permissions("vehicles.view")
  async findOne(@Param("id") id: string) {
    const data = await this.vehiclesService.findOne(id);
    return { data, message: "Vehicle fetched" };
  }

  @Patch(":id")
  @Permissions("vehicles.edit")
  async update(
    @Param("id") id: string,
    @Body()
    body: Partial<{
      status: "AVAILABLE" | "IN_USE" | "UNDER_MAINTENANCE" | "OUT_OF_SERVICE" | "DISPOSED";
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
    const data = await this.vehiclesService.update(id, body);
    return { data, message: "Vehicle updated" };
  }

  @Delete(":id")
  @Permissions("vehicles.delete")
  async remove(@Param("id") id: string) {
    const data = await this.vehiclesService.remove(id);
    return { data, message: "Vehicle deleted" };
  }

  @Post(":id/assign-driver")
  @Permissions("vehicles.edit")
  async assignDriver(@Param("id") id: string, @Body() body: { driverId: string }) {
    const data = await this.vehiclesService.assignDriver(id, body.driverId);
    return { data, message: "Driver assigned" };
  }

  @Post(":id/fuel-log")
  @Permissions("vehicles.operate")
  async fuelLog(@Param("id") id: string, @Body() body: { liters: number; costPerLiter: number; mileageAtFuel: number; fuelStation?: string; notes?: string }) {
    const data = await this.vehiclesService.fuelLog(id, body);
    return { data, message: "Fuel log recorded" };
  }

  @Get(":id/fuel-logs")
  @Permissions("vehicles.view")
  async fuelLogs(@Param("id") id: string) {
    const data = await this.vehiclesService.fuelLogs(id);
    return { data, message: "Fuel logs fetched" };
  }

  @Get(":id/fuel-analytics")
  @Permissions("vehicles.view")
  async fuelAnalytics(@Param("id") id: string) {
    const data = await this.vehiclesService.fuelAnalytics(id);
    return { data, message: "Fuel analytics fetched" };
  }

  @Post(":id/trip-start")
  @Permissions("vehicles.operate")
  async tripStart(
    @Param("id") id: string,
    @Body() body: { driverId: string; startLocation: string; endLocation: string; startMileage: number; purpose?: string }
  ) {
    const data = await this.vehiclesService.tripStart(id, body);
    return { data, message: "Trip started" };
  }

  @Post(":id/trip-end")
  @Permissions("vehicles.operate")
  async tripEnd(@Param("id") id: string, @Body() body: { tripId: string; endMileage: number; notes?: string }) {
    const data = await this.vehiclesService.tripEnd(id, body);
    return { data, message: "Trip ended" };
  }

  @Get(":id/trips")
  @Permissions("vehicles.view")
  async trips(@Param("id") id: string) {
    const data = await this.vehiclesService.trips(id);
    return { data, message: "Trips fetched" };
  }

  @Get(":id/history")
  @Permissions("vehicles.view")
  async history(
    @Param("id") id: string,
    @Query("from") fromRaw?: string,
    @Query("to") toRaw?: string,
    @Query("limit") limitRaw?: string
  ) {
    const data = await this.vehiclesService.history(id, {
      from: fromRaw,
      to: toRaw,
      limit: this.toPositiveInt(limitRaw, 1000)
    });
    return { data, message: "Vehicle history fetched" };
  }

  @Post(":id/gps-update")
  @Permissions("vehicles.operate")
  async gpsUpdate(
    @Param("id") id: string,
    @Body()
    body: {
      latitude: number;
      longitude: number;
      speed?: number;
      heading?: number;
      engineStatus?: boolean | "ON" | "OFF";
      fuelLevel?: number;
      batteryVoltage?: number;
    }
  ) {
    const data = await this.vehiclesService.gpsUpdate(id, body);
    return { data, message: "GPS updated" };
  }

  private parseStatuses(statusRaw?: string | string[]) {
    if (!statusRaw) {
      return undefined;
    }

    const values = Array.isArray(statusRaw) ? statusRaw : [statusRaw];
    const parsed = values
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value): value is "AVAILABLE" | "IN_USE" | "UNDER_MAINTENANCE" | "OUT_OF_SERVICE" | "DISPOSED" =>
        ["AVAILABLE", "IN_USE", "UNDER_MAINTENANCE", "OUT_OF_SERVICE", "DISPOSED"].includes(value)
      );

    return parsed.length > 0 ? parsed : undefined;
  }

  private parseSortBy(sortByRaw?: string): "mileage" | "nextServiceDate" | "year" | "createdAt" {
    if (sortByRaw === "mileage" || sortByRaw === "nextServiceDate" || sortByRaw === "year") {
      return sortByRaw;
    }

    return "createdAt";
  }

  private toPositiveInt(value: string | undefined, fallback: number) {
    if (!value) {
      return fallback;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }
}
