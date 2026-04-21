import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Priority, WorkOrderStatus } from "@prisma/client";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { WorkOrdersService } from "./work-orders.service";

@ApiTags("Work Orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("work-orders")
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN")
  async findAll() {
    const data = await this.workOrdersService.findAll();
    return { data, message: "Work orders fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async create(
    @Body()
    body: {
      title: string;
      description: string;
      priority: Priority;
      type: "PREVENTIVE" | "CORRECTIVE" | "EMERGENCY" | "INSPECTION" | "INSTALLATION";
      assetId?: string;
      vehicleId?: string;
      scheduleId?: string;
      createdById: string;
      dueDate?: string;
    }
  ) {
    const data = await this.workOrdersService.create(body);
    return { data, message: "Work order created" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN")
  async findOne(@Param("id") id: string) {
    const data = await this.workOrdersService.findOne(id);
    return { data, message: "Work order fetched" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async update(
    @Param("id") id: string,
    @Body() body: Partial<{ title: string; description: string; dueDate: string; estimatedCost: number; estimatedHours: number }>
  ) {
    const data = await this.workOrdersService.update(id, body);
    return { data, message: "Work order updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN")
  async remove(@Param("id") id: string) {
    const data = await this.workOrdersService.remove(id);
    return { data, message: "Work order deleted" };
  }

  @Post(":id/assign")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async assign(@Param("id") id: string, @Body() body: { technicianId: string }) {
    const data = await this.workOrdersService.assign(id, body.technicianId);
    return { data, message: "Work order assigned" };
  }

  @Patch(":id/status")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN")
  async updateStatus(
    @Param("id") id: string,
    @Body() body: { status: WorkOrderStatus; actualCost?: number; actualHours?: number }
  ) {
    const data = await this.workOrdersService.updateStatus(id, body);
    return { data, message: "Work order status updated" };
  }

  @Post(":id/parts")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN")
  async addPart(@Param("id") id: string, @Body() body: { partId: string; quantity: number; unitCost: number }) {
    const data = await this.workOrdersService.addPart(id, body);
    return { data, message: "Part added to work order" };
  }

  @Get(":id/parts")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN")
  async parts(@Param("id") id: string) {
    const data = await this.workOrdersService.parts(id);
    return { data, message: "Work order parts fetched" };
  }

  @Post(":id/notes")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN")
  async notes(@Param("id") id: string, @Body() body: { note: string }) {
    const data = await this.workOrdersService.addNote(id, body.note);
    return { data, message: "Work order note added" };
  }

  @Post(":id/attachments")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN")
  async attachments(@Param("id") id: string, @Body() body: { attachmentUrl: string }) {
    const data = await this.workOrdersService.addAttachment(id, body.attachmentUrl);
    return { data, message: "Work order attachment added" };
  }
}
