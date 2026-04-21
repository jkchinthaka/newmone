import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AssetsService } from "./assets.service";

@ApiTags("Assets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("assets")
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async findAll(@Query() query: { category?: string; status?: string; location?: string; page?: number; limit?: number }) {
    const data = await this.assetsService.findAll(query);
    return { data, message: "Assets fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async create(
    @Body()
    body: {
      assetTag: string;
      name: string;
      category: "MACHINE" | "TOOL" | "INFRASTRUCTURE" | "EQUIPMENT" | "VEHICLE" | "OTHER";
      status?: "ACTIVE" | "INACTIVE" | "UNDER_MAINTENANCE" | "DISPOSED" | "RETIRED";
      description?: string;
      location?: string;
    }
  ) {
    const data = await this.assetsService.create(body);
    return { data, message: "Asset created" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER")
  async findOne(@Param("id") id: string) {
    const data = await this.assetsService.findOne(id);
    return { data, message: "Asset fetched" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async update(
    @Param("id") id: string,
    @Body() body: Partial<{ name: string; description: string; status: "ACTIVE" | "INACTIVE" | "UNDER_MAINTENANCE" | "DISPOSED" | "RETIRED"; location: string; disposalReason: string }>
  ) {
    const data = await this.assetsService.update(id, body);
    return { data, message: "Asset updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN")
  async remove(@Param("id") id: string) {
    const data = await this.assetsService.remove(id);
    return { data, message: "Asset deleted" };
  }

  @Get(":id/qr-code")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN", "VIEWER")
  async getQrCode(@Param("id") id: string) {
    const data = await this.assetsService.getQrCode(id);
    return { data, message: "Asset QR fetched" };
  }

  @Get(":id/maintenance-history")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN", "VIEWER")
  async maintenanceHistory(@Param("id") id: string) {
    const data = await this.assetsService.maintenanceHistory(id);
    return { data, message: "Maintenance history fetched" };
  }

  @Post("bulk-import")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async bulkImport(@Body() body: { items: Array<{ assetTag: string; name: string; category: "MACHINE" | "TOOL" | "INFRASTRUCTURE" | "EQUIPMENT" | "VEHICLE" | "OTHER"; location?: string }> }) {
    const data = await this.assetsService.bulkImport(body.items ?? []);
    return { data, message: "Bulk import complete" };
  }
}
