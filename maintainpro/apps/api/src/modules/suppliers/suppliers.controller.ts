import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuppliersService } from "./suppliers.service";

@ApiTags("Suppliers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async findAll() {
    const data = await this.suppliersService.findAll();
    return { data, message: "Suppliers fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async create(@Body() body: { name: string; contactName?: string; email?: string; phone?: string; address?: string; website?: string; taxNumber?: string; notes?: string }) {
    const data = await this.suppliersService.create(body);
    return { data, message: "Supplier created" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async findOne(@Param("id") id: string) {
    const data = await this.suppliersService.findOne(id);
    return { data, message: "Supplier fetched" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async update(@Param("id") id: string, @Body() body: Partial<{ name: string; contactName: string; email: string; phone: string; address: string; website: string; taxNumber: string; notes: string; isActive: boolean }>) {
    const data = await this.suppliersService.update(id, body);
    return { data, message: "Supplier updated" };
  }
}
