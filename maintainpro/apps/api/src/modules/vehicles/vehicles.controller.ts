import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { VehiclesService } from "./vehicles.service";

@ApiTags("Vehicles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("vehicles")
export class VehiclesController {
  constructor(@Inject(VehiclesService) private readonly vehiclesService: VehiclesService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
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
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  async summary(@Query("upcomingDays") upcomingDaysRaw?: string) {
    const data = await this.vehiclesService.summary(this.toPositiveInt(upcomingDaysRaw, 14));
    return { data, message: "Vehicle summary fetched" };
  }

  @Get("alerts")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  async alerts(@Query("upcomingDays") upcomingDaysRaw?: string, @Query("limit") limitRaw?: string) {
    const data = await this.vehiclesService.alerts({
      upcomingDays: this.toPositiveInt(upcomingDaysRaw, 14),
      limit: this.toPositiveInt(limitRaw, 12)
    });
    return { data, message: "Vehicle alerts fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async create(
    @Body()
    body: {
      registrationNo: string;
      make: string;
      vehicleModel: string;
      year: number;
      type: "CAR" | "MOTORCYCLE" | "TRUCK" | "VAN" | "BUS" | "HEAVY_EQUIPMENT" | "OTHER";
      fuelType: "PETROL" | "DIESEL" | "ELECTRIC" | "HYBRID" | "CNG" | "LPG";
      currentMileage?: number;
    }
  ) {
    const data = await this.vehiclesService.create(body);
    return { data, message: "Vehicle created" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  async findOne(@Param("id") id: string) {
    const data = await this.vehiclesService.findOne(id);
    return { data, message: "Vehicle fetched" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async update(
    @Param("id") id: string,
    @Body() body: Partial<{ status: "AVAILABLE" | "IN_USE" | "UNDER_MAINTENANCE" | "OUT_OF_SERVICE" | "DISPOSED"; currentMileage: number; nextServiceDate: string; nextServiceMileage: number; insuranceExpiry: string; roadTaxExpiry: string; color: string }>
  ) {
    const data = await this.vehiclesService.update(id, body);
    return { data, message: "Vehicle updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN")
  async remove(@Param("id") id: string) {
    const data = await this.vehiclesService.remove(id);
    return { data, message: "Vehicle deleted" };
  }

  @Post(":id/assign-driver")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async assignDriver(@Param("id") id: string, @Body() body: { driverId: string }) {
    const data = await this.vehiclesService.assignDriver(id, body.driverId);
    return { data, message: "Driver assigned" };
  }

  @Post(":id/fuel-log")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "DRIVER")
  async fuelLog(@Param("id") id: string, @Body() body: { liters: number; costPerLiter: number; mileageAtFuel: number; fuelStation?: string; notes?: string }) {
    const data = await this.vehiclesService.fuelLog(id, body);
    return { data, message: "Fuel log recorded" };
  }

  @Get(":id/fuel-logs")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "DRIVER", "SUPERVISOR")
  async fuelLogs(@Param("id") id: string) {
    const data = await this.vehiclesService.fuelLogs(id);
    return { data, message: "Fuel logs fetched" };
  }

  @Get(":id/fuel-analytics")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  async fuelAnalytics(@Param("id") id: string) {
    const data = await this.vehiclesService.fuelAnalytics(id);
    return { data, message: "Fuel analytics fetched" };
  }

  @Post(":id/trip-start")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "DRIVER")
  async tripStart(
    @Param("id") id: string,
    @Body() body: { driverId: string; startLocation: string; endLocation: string; startMileage: number; purpose?: string }
  ) {
    const data = await this.vehiclesService.tripStart(id, body);
    return { data, message: "Trip started" };
  }

  @Post(":id/trip-end")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "DRIVER")
  async tripEnd(@Param("id") id: string, @Body() body: { tripId: string; endMileage: number; notes?: string }) {
    const data = await this.vehiclesService.tripEnd(id, body);
    return { data, message: "Trip ended" };
  }

  @Get(":id/trips")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "DRIVER", "SUPERVISOR")
  async trips(@Param("id") id: string) {
    const data = await this.vehiclesService.trips(id);
    return { data, message: "Trips fetched" };
  }

  @Post(":id/gps-update")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "DRIVER")
  async gpsUpdate(@Param("id") id: string, @Body() body: { latitude: number; longitude: number; speed?: number; heading?: number }) {
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
