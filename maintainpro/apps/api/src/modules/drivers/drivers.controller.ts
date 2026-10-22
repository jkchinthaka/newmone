import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { DriversService } from "./drivers.service";

@ApiTags("Drivers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("drivers")
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async findAll(@Query("q") q?: string, @Query("pageSize") pageSize?: string) {
    const data = await this.driversService.findAll({
      q,
      pageSize: pageSize ? Number(pageSize) : undefined
    });
    return { data, message: "Drivers fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async create(@Body() body: { userId: string; licenseNumber: string; licenseClass: string; licenseExpiry: string }) {
    const data = await this.driversService.create(body);
    return { data, message: "Driver created" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async findOne(@Param("id") id: string) {
    const data = await this.driversService.findOne(id);
    return { data, message: "Driver fetched" };
  }
}
