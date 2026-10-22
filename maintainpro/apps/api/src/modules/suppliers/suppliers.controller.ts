import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { SuppliersService } from "./suppliers.service";

type AuthedRequest = {
  user: JwtPayload;
};

@ApiTags("Suppliers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER", "OPERATIONS_MANAGER", "SUPERVISOR", "INVENTORY_KEEPER")
  async findAll(@Req() req: AuthedRequest) {
    const data = await this.suppliersService.findAll(req.user);
    return { data, message: "Suppliers fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER", "OPERATIONS_MANAGER")
  async create(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      name: string;
      vendorCode?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      address?: string;
      website?: string;
      taxNumber?: string;
      serviceCategories?: string[];
      notes?: string;
      tenantId?: string;
    }
  ) {
    const data = await this.suppliersService.create(body, req.user);
    return { data, message: "Supplier created" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER", "OPERATIONS_MANAGER", "SUPERVISOR", "INVENTORY_KEEPER")
  async findOne(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.suppliersService.findOne(id, req.user);
    return { data, message: "Supplier fetched" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER", "OPERATIONS_MANAGER")
  async update(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body()
    body: Partial<{
      name: string;
      vendorCode: string;
      contactName: string;
      email: string;
      phone: string;
      address: string;
      website: string;
      taxNumber: string;
      serviceCategories: string[];
      notes: string;
      isActive: boolean;
      performanceScore: number;
    }>
  ) {
    const data = await this.suppliersService.update(id, body, req.user);
    return { data, message: "Supplier updated" };
  }

  @Post(":id/blacklist")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER")
  async blacklist(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { blacklisted: boolean; reason?: string }
  ) {
    const data = await this.suppliersService.setBlacklist(id, body.blacklisted, body.reason, req.user);
    return { data, message: body.blacklisted ? "Vendor blacklisted" : "Vendor blacklist removed" };
  }
}
