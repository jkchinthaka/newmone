import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Priority, WorkOrderStatus } from "@prisma/client";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { WorkOrdersService } from "./work-orders.service";

type AuthedRequest = {
  user: JwtPayload;
};

@ApiTags("Work Orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("work-orders")
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async findAll(@Req() req: AuthedRequest) {
    const data = await this.workOrdersService.findAll(req.user);
    return { data, message: "Work orders fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("work_orders.manage")
  async create(
    @Req() req: AuthedRequest,
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
    const data = await this.workOrdersService.create(body, req.user);
    return { data, message: "Work order created" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async findOne(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.workOrdersService.findOne(id, req.user);
    return { data, message: "Work order fetched" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("work_orders.manage")
  async update(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Partial<{ title: string; description: string; dueDate: string; estimatedCost: number; estimatedHours: number }>
  ) {
    const data = await this.workOrdersService.update(id, body, req.user);
    return { data, message: "Work order updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("work_orders.manage")
  async remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.workOrdersService.remove(id, req.user);
    return { data, message: "Work order deleted" };
  }

  @Post(":id/assign")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("work_orders.manage")
  async assign(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { technicianId: string }) {
    const data = await this.workOrdersService.assign(id, body.technicianId, req.user);
    return { data, message: "Work order assigned" };
  }

  @Patch(":id/status")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  @Permissions("work_orders.update_status")
  async updateStatus(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { status: WorkOrderStatus; actualCost?: number; actualHours?: number }
  ) {
    const data = await this.workOrdersService.updateStatus(id, body, req.user);
    return { data, message: "Work order status updated" };
  }

  @Post(":id/parts")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  @Permissions("inventory.stock_issue")
  async addPart(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { partId: string; quantity: number; unitCost: number }) {
    const data = await this.workOrdersService.addPart(id, body, req.user);
    return { data, message: "Part added to work order" };
  }

  @Get(":id/parts")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async parts(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.workOrdersService.parts(id, req.user);
    return { data, message: "Work order parts fetched" };
  }

  @Post(":id/notes")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async notes(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { note: string }) {
    const data = await this.workOrdersService.addNote(id, body.note, req.user);
    return { data, message: "Work order note added" };
  }

  @Post(":id/attachments")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async attachments(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { attachmentUrl: string }) {
    const data = await this.workOrdersService.addAttachment(id, body.attachmentUrl, req.user);
    return { data, message: "Work order attachment added" };
  }

  @Get(":id/part-requests")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "INVENTORY_KEEPER", "SUPERVISOR")
  @Permissions("part_requests.view")
  async listPartRequests(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.workOrdersService.listPartRequests(id, req.user);
    return { data, message: "Part requests fetched" };
  }

  @Post(":id/part-requests")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN")
  @Permissions("part_requests.create")
  async createPartRequest(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { partId: string; quantity: number; unitCost?: number; reason?: string; pettyCash?: boolean }
  ) {
    const data = await this.workOrdersService.createPartRequest(id, body, req.user);
    return { data, message: "Part request submitted" };
  }

  @Patch(":id/part-requests/:requestId/approve-operational")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "INVENTORY_KEEPER", "OPERATIONS_MANAGER")
  @Permissions("part_requests.approve_operational")
  async approvePartRequestOperational(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("requestId") requestId: string,
    @Body() body: { approvedQuantity?: number; reason?: string }
  ) {
    const data = await this.workOrdersService.approvePartRequestOperational(id, requestId, body, req.user);
    return { data, message: "Part request operationally approved" };
  }

  @Patch(":id/part-requests/:requestId/approve-finance")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER")
  @Permissions("part_requests.approve_finance")
  async approvePartRequestFinance(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("requestId") requestId: string,
    @Body() body: { approvedQuantity?: number; reason?: string }
  ) {
    const data = await this.workOrdersService.approvePartRequestFinance(id, requestId, body, req.user);
    return { data, message: "Part request finance approved" };
  }

  @Patch(":id/part-requests/:requestId/reject")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "INVENTORY_KEEPER", "OPERATIONS_MANAGER")
  @Permissions("part_requests.reject")
  async rejectPartRequest(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("requestId") requestId: string,
    @Body() body: { reason: string; stage?: "OPERATIONAL" | "FINANCE" }
  ) {
    const data = await this.workOrdersService.rejectPartRequest(id, requestId, body, req.user);
    return { data, message: "Part request rejected" };
  }

  @Post(":id/part-requests/:requestId/issue")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "INVENTORY_KEEPER", "OPERATIONS_MANAGER")
  @Permissions("part_requests.issue", "inventory.stock_issue")
  async issuePartRequest(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("requestId") requestId: string,
    @Body() body: { quantity?: number; notes?: string }
  ) {
    const data = await this.workOrdersService.issuePartRequest(id, requestId, body, req.user);
    return { data, message: "Part request stock issued" };
  }
}
