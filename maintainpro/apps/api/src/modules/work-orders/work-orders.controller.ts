import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PartReturnCondition, Priority, WorkOrderStatus } from "@prisma/client";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { ApproveWorkOrderDto, RejectWorkOrderDto, SubmitWorkOrderForApprovalDto } from "./dto/work-order-approval.dto";
import { WorkOrderActivityService } from "./work-order-activity.service";
import { WorkOrderAssigneesService } from "./work-order-assignees.service";
import { WorkOrderHistoryService } from "./work-order-history.service";
import { WorkOrderGovernanceService } from "./work-order-governance.service";
import { WorkOrderPartsService } from "./work-order-parts.service";
import { WorkOrderQueuesService } from "./work-order-queues.service";
import { WorkOrdersService } from "./work-orders.service";
import { EvidenceService } from "../evidence/evidence.service";
import { VendorRepairService } from "./vendor-repair.service";

type AuthedRequest = {
  user: JwtPayload;
};

@ApiTags("Work Orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("work-orders")
export class WorkOrdersController {
  constructor(
    private readonly workOrdersService: WorkOrdersService,
    private readonly workOrderActivityService: WorkOrderActivityService,
    private readonly workOrderAssigneesService: WorkOrderAssigneesService,
    private readonly workOrderHistoryService: WorkOrderHistoryService,
    private readonly workOrderGovernanceService: WorkOrderGovernanceService,
    private readonly workOrderPartsService: WorkOrderPartsService,
    private readonly workOrderQueuesService: WorkOrderQueuesService,
    private readonly evidenceService: EvidenceService,
    private readonly vendorRepairService: VendorRepairService
  ) {}

  @Get("governance/parts-exceptions")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "INVENTORY_KEEPER")
  async partsGovernanceExceptions(@Req() req: AuthedRequest) {
    const data = await this.workOrderPartsService.getPartsExceptions(req.user);
    return { data, message: "Work order parts exceptions fetched" };
  }

  @Get("governance/exceptions")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER")
  async governanceExceptions(@Req() req: AuthedRequest) {
    const data = await this.workOrderGovernanceService.getExceptionSummary(req.user);
    return { data, message: "Work order governance exceptions fetched" };
  }

  @Get("queues")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "OPERATIONS_MANAGER",
    "ASSET_MANAGER",
    "MECHANIC",
    "TECHNICIAN",
    "SUPERVISOR",
    "INVENTORY_KEEPER",
    "SECURITY_OFFICER"
  )
  async queueSummary(@Req() req: AuthedRequest) {
    const data = await this.workOrderQueuesService.getQueueSummary(req.user);
    return { data, message: "Work order queue summary fetched" };
  }

  @Get("smart-views")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "OPERATIONS_MANAGER",
    "ASSET_MANAGER",
    "MECHANIC",
    "TECHNICIAN",
    "SUPERVISOR",
    "INVENTORY_KEEPER",
    "SECURITY_OFFICER"
  )
  async smartViews(@Req() req: AuthedRequest) {
    const data = await this.workOrderQueuesService.getSmartViews(req.user);
    return { data, message: "Work order smart views fetched" };
  }

  @Get("action-required")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "OPERATIONS_MANAGER",
    "ASSET_MANAGER",
    "MECHANIC",
    "TECHNICIAN",
    "SUPERVISOR",
    "INVENTORY_KEEPER",
    "SECURITY_OFFICER"
  )
  async actionRequired(@Req() req: AuthedRequest, @Query() query: Record<string, string>) {
    const data = await this.workOrderQueuesService.getActionRequired(req.user, query);
    return { data, message: "Action required work orders fetched" };
  }

  @Get("queues/:queueKey")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "OPERATIONS_MANAGER",
    "ASSET_MANAGER",
    "MECHANIC",
    "TECHNICIAN",
    "SUPERVISOR",
    "INVENTORY_KEEPER",
    "SECURITY_OFFICER"
  )
  async queueItems(@Req() req: AuthedRequest, @Param("queueKey") queueKey: string, @Query() query: Record<string, string>) {
    const data = await this.workOrderQueuesService.getQueue(req.user, queueKey, query);
    return { data, message: "Work order queue fetched" };
  }

  @Get("category-summary")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "OPERATIONS_MANAGER",
    "ASSET_MANAGER",
    "SUPERVISOR",
    "INVENTORY_KEEPER"
  )
  async categorySummary(@Req() req: AuthedRequest, @Query() query: Record<string, string>) {
    const data = await this.workOrderQueuesService.getCategorySummary(req.user, query);
    return { data, message: "Work order category summary fetched" };
  }

  @Get()
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "OPERATIONS_MANAGER",
    "ASSET_MANAGER",
    "MECHANIC",
    "TECHNICIAN",
    "SUPERVISOR",
    "INVENTORY_KEEPER",
    "SECURITY_OFFICER"
  )
  async findAll(@Req() req: AuthedRequest, @Query() query: Record<string, string>) {
    const hasQueueParams =
      query.queue ||
      query.page ||
      query.pageSize ||
      query.overdueOnly ||
      query.highRiskOnly ||
      query.riskSeverity ||
      query.myAssignedOnly ||
      query.categoryId ||
      query.taxonomyCategoryId ||
      query.typeId ||
      query.taxonomyTypeId ||
      query.issueId ||
      query.taxonomyIssueId ||
      query.triageOnly;

    if (hasQueueParams) {
      const data = await this.workOrderQueuesService.search(req.user, query);
      return { data, message: "Work orders fetched" };
    }

    const data = await this.workOrdersService.findAll(req.user);
    return { data, message: "Work orders fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER")
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
      expectedCompletionDate?: string;
      requiresApproval?: boolean;
      taxonomyCategoryId?: string;
      taxonomyTypeId?: string;
      taxonomyIssueId?: string;
      isTriage?: boolean;
      triageReason?: string;
    }
  ) {
    const data = await this.workOrdersService.create(body, req.user);
    return { data, message: "Work order created" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN")
  async findOne(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.workOrdersService.findOne(id, req.user);
    return { data, message: "Work order fetched" };
  }

  @Get(":id/history")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN")
  async workOrderHistory(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.workOrderHistoryService.getHistory(id, req.user);
    return { data, message: "Work order history fetched" };
  }

  @Get(":id/activity")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN")
  async activityTimeline(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.workOrderActivityService.getActivityTimeline(id, req.user);
    return { data, message: "Work order activity timeline fetched" };
  }

  @Post(":id/evidence")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "FACILITY_MANAGER", "MANAGER")
  async createEvidence(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body()
    body: {
      evidenceType: string;
      note?: string;
      fileName?: string;
      mimeType?: string;
      sizeBytes?: number;
      capturedAt?: string;
      source?: string;
      clientGeneratedId?: string;
      offlineCreatedAt?: string;
    }
  ) {
    const data = await this.evidenceService.createWorkOrderEvidence(id, body as never, req.user);
    return { data, message: "Work order evidence processed" };
  }

  @Get(":id/evidence")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "FACILITY_MANAGER")
  async listEvidence(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.evidenceService.listWorkOrderEvidence(id, req.user);
    return { data, message: "Work order evidence fetched" };
  }

  @Post(":id/evidence/upload-request")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "FACILITY_MANAGER", "MANAGER")
  async createEvidenceUploadRequest(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body()
    body: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      evidenceType?: string;
      note?: string;
      capturedAt?: string;
      source?: string;
      clientGeneratedId?: string;
    }
  ) {
    const data = await this.evidenceService.createWorkOrderUploadRequest(id, body as never, req.user);
    return { data, message: "Evidence upload request processed" };
  }

  @Post(":id/evidence/confirm")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "FACILITY_MANAGER")
  async confirmEvidenceUpload(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { attachmentId: string }
  ) {
    const data = await this.evidenceService.confirmWorkOrderUpload(id, body, req.user);
    return { data, message: "Evidence upload confirmation processed" };
  }

  @Patch(":id/evidence/:evidenceId")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "FACILITY_MANAGER", "MANAGER")
  async patchEvidence(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("evidenceId") evidenceId: string,
    @Body() body: { note?: string; evidenceType?: string }
  ) {
    const data = await this.evidenceService.patchWorkOrderEvidence(id, evidenceId, body as never, req.user);
    return { data, message: "Evidence updated" };
  }

  @Delete(":id/evidence/:evidenceId")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "FACILITY_MANAGER", "MANAGER")
  async deleteEvidence(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("evidenceId") evidenceId: string,
    @Body() body: { reason: string }
  ) {
    const data = await this.evidenceService.deleteWorkOrderEvidence(id, evidenceId, body.reason, req.user);
    return { data, message: "Evidence deleted" };
  }

  @Post(":id/evidence/:evidenceId/accept")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR")
  async acceptEvidence(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("evidenceId") evidenceId: string,
    @Body() body: { note?: string }
  ) {
    const data = await this.evidenceService.acceptWorkOrderEvidence(id, evidenceId, req.user, body.note);
    return { data, message: "Evidence accepted" };
  }

  @Post(":id/evidence/:evidenceId/reject")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR")
  async rejectEvidence(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("evidenceId") evidenceId: string,
    @Body() body: { reason: string }
  ) {
    const data = await this.evidenceService.rejectWorkOrderEvidence(id, evidenceId, body.reason, req.user);
    return { data, message: "Evidence rejected" };
  }

  @Post(":id/verify-qr")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "FACILITY_MANAGER", "MANAGER")
  async verifyQr(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { scannedAssetId?: string; scannedVehicleId?: string; overrideReason?: string }
  ) {
    const data = await this.evidenceService.verifyWorkOrderQr(id, body, req.user);
    return { data, message: data.message };
  }

  @Patch(":id/taxonomy")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR")
  async changeTaxonomy(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body()
    body: {
      taxonomyCategoryId: string;
      taxonomyTypeId: string;
      taxonomyIssueId?: string;
      reason: string;
    }
  ) {
    const data = await this.workOrdersService.changeTaxonomy(id, body, req.user);
    return { data, message: "Work order category updated" };
  }

  @Patch(":id/classify-triage")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR")
  async classifyTriage(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body()
    body: {
      taxonomyCategoryId: string;
      taxonomyTypeId: string;
      taxonomyIssueId?: string;
      reason: string;
    }
  ) {
    const data = await this.workOrdersService.classifyTriage(id, body, req.user);
    return { data, message: "Triage work order classified" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER")
  @Permissions("work_orders.manage")
  async update(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Partial<{ title: string; description: string; dueDate: string; expectedCompletionDate: string; plannedStartAt: string; plannedEndAt: string; estimatedCost: number; estimatedHours: number }>
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

  @Get(":id/assignees")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN")
  async listAssignees(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.workOrderAssigneesService.listAssignees(id, req.user);
    return { data, message: "Work order assignees fetched" };
  }

  @Post(":id/assignees")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER")
  @Permissions("work_orders.manage")
  async addAssignee(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body()
    body: {
      employeeId: string;
      designation?: string;
      roleInTask?: string;
      isPrimary?: boolean;
      plannedStartAt?: string;
      plannedEndAt?: string;
      estimatedHours?: number;
      remarks?: string;
      leaveOverride?: boolean;
      leaveOverrideReason?: string;
    }
  ) {
    const data = await this.workOrderAssigneesService.addAssignee(id, body, req.user);
    return { data, message: "Work order assignee added" };
  }

  @Delete(":id/assignees/:assigneeId")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER")
  @Permissions("work_orders.manage")
  async removeAssignee(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("assigneeId") assigneeId: string,
    @Body() body: { reason: string }
  ) {
    const data = await this.workOrderAssigneesService.removeAssignee(id, assigneeId, req.user, body.reason);
    return { data, message: "Work order assignee removed" };
  }

  @Post(":id/assign")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER")
  @Permissions("work_orders.manage")
  async assign(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { technicianId: string }) {
    const data = await this.workOrdersService.assign(id, body.technicianId, req.user);
    return { data, message: "Work order assigned" };
  }

  @Post(":id/submit-for-approval")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN")
  @Permissions("work_orders.manage", "work_orders.update_status")
  async submitForApproval(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: SubmitWorkOrderForApprovalDto
  ) {
    const data = await this.workOrdersService.submitForApproval(id, body.notes, req.user);
    return { data, message: "Work order submitted for approval" };
  }

  @Patch(":id/approve")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER")
  @Permissions("work_orders.manage")
  async approveWorkOrder(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: ApproveWorkOrderDto) {
    const data = await this.workOrdersService.approveWorkOrder(id, body.notes, req.user);
    return { data, message: "Work order approved" };
  }

  @Patch(":id/reject")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER")
  @Permissions("work_orders.manage")
  async rejectWorkOrder(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: RejectWorkOrderDto) {
    const data = await this.workOrdersService.rejectWorkOrder(id, body.reason, req.user);
    return { data, message: "Work order rejected" };
  }

  @Patch(":id/status")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN")
  @Permissions("work_orders.update_status")
  async updateStatus(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body()
    body: {
      status: WorkOrderStatus;
      actualCost?: number;
      actualHours?: number;
      delayReason?: string;
      cancelReason?: string;
      completionNote?: string;
      emergencyCloseReason?: string;
      completionCondition?: string;
      followUpRequired?: boolean;
      followUpNote?: string;
      overrideReason?: string;
    }
  ) {
    const data = await this.workOrdersService.updateStatus(id, body as Parameters<WorkOrdersService["updateStatus"]>[1], req.user);
    return { data, message: "Work order status updated" };
  }

  @Post(":id/verify-supervisor")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER")
  @Permissions("work_orders.manage")
  async verifySupervisor(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { verificationNote?: string; actualCost?: number; actualHours?: number; delayReason?: string; overrideReason?: string }
  ) {
    const data = await this.workOrdersService.verifySupervisor(id, body, req.user);
    return { data, message: "Work order supervisor verified" };
  }

  @Post(":id/reject-supervisor")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER")
  @Permissions("work_orders.manage")
  async rejectSupervisor(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { reason: string }) {
    const data = await this.workOrdersService.rejectSupervisor(id, body.reason, req.user);
    return { data, message: "Work order supervisor rejection recorded" };
  }

  @Post(":id/reopen")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("work_orders.manage")
  async reopenWorkOrder(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { reason: string }) {
    const data = await this.workOrdersService.reopenWorkOrder(id, body.reason, req.user);
    return { data, message: "Work order reopened" };
  }

  @Post(":id/parts")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "INVENTORY_KEEPER", "OPERATIONS_MANAGER")
  @Permissions("inventory.stock_issue")
  async addPart(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { partId: string; quantity: number; unitCost: number; reason?: string }
  ) {
    const data = await this.workOrdersService.addPart(id, body, req.user);
    return { data, message: "Part added to work order" };
  }

  @Get(":id/parts/summary")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER")
  async partsSummary(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.workOrderPartsService.getCostSummary(id, req.user);
    return { data, message: "Work order parts cost summary fetched" };
  }

  @Get(":id/parts")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER")
  async parts(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.workOrdersService.parts(id, req.user);
    return { data, message: "Work order parts fetched" };
  }

  @Patch(":id/parts/:lineId/use")
  @Roles("SUPER_ADMIN", "ADMIN", "MECHANIC", "TECHNICIAN", "INVENTORY_KEEPER", "ASSET_MANAGER")
  async markPartUsed(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("lineId") lineId: string,
    @Body() body: { usedQuantity: number; note?: string }
  ) {
    const data = await this.workOrderPartsService.markUsed(id, lineId, body, req.user);
    return { data, message: "Part usage recorded" };
  }

  @Post(":id/parts/:lineId/return")
  @Roles("SUPER_ADMIN", "ADMIN", "MECHANIC", "TECHNICIAN", "INVENTORY_KEEPER", "ASSET_MANAGER")
  async requestPartReturn(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("lineId") lineId: string,
    @Body() body: { returnedQuantity: number; returnCondition: PartReturnCondition; returnNote?: string }
  ) {
    const data = await this.workOrderPartsService.requestReturn(id, lineId, body, req.user);
    return { data, message: "Part return requested" };
  }

  @Post(":id/parts/:lineId/confirm-return")
  @Roles("SUPER_ADMIN", "ADMIN", "INVENTORY_KEEPER", "OPERATIONS_MANAGER", "ASSET_MANAGER")
  @Permissions("inventory.stock_issue")
  async confirmPartReturn(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("lineId") lineId: string,
    @Body() body: { confirmedQuantity: number; note?: string }
  ) {
    const data = await this.workOrderPartsService.confirmReturn(id, lineId, body, req.user);
    return { data, message: "Part return confirmed" };
  }

  @Post(":id/notes")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN")
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
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "INVENTORY_KEEPER", "OPERATIONS_MANAGER")
  @Permissions("part_requests.issue", "inventory.stock_issue")
  async issuePartRequest(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("requestId") requestId: string,
    @Body() body: { quantity?: number; notes?: string; storeLocation?: string }
  ) {
    const data = await this.workOrdersService.issuePartRequest(id, requestId, body, req.user);
    return { data, message: "Part request stock issued" };
  }

  @Get(":id/vendor-repair")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC")
  async getVendorRepair(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.vendorRepairService.getVendorRepair(id, req.user);
    return { data, message: "Vendor repair fetched" };
  }

  @Post(":id/vendor-repair/request")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR")
  async requestVendorRepair(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { externalRepairReason: string; supplierId?: string; isEmergency?: boolean; overrideReason?: string }
  ) {
    const data = await this.vendorRepairService.requestVendorRepair(id, body, req.user);
    return { data, message: "Vendor repair requested" };
  }

  @Post(":id/vendor-repair/select-vendor")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR")
  async selectVendor(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { supplierId: string; overrideReason?: string }
  ) {
    const data = await this.vendorRepairService.selectVendor(id, body.supplierId, body.overrideReason, req.user);
    return { data, message: "Vendor selected" };
  }

  @Post(":id/vendor-repair/quotations")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR")
  async addQuotation(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body()
    body: {
      supplierId: string;
      quotationNo: string;
      quotationDate: string;
      quotedAmount: number;
      currency?: string;
      validityDate?: string;
      evidenceAttachmentId?: string;
    }
  ) {
    const data = await this.vendorRepairService.addQuotation(id, body, req.user);
    return { data, message: "Quotation submitted" };
  }

  @Post(":id/vendor-repair/quotations/:quotationId/approve")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR")
  async approveQuotation(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("quotationId") quotationId: string,
    @Body() body: { approvalNote?: string }
  ) {
    const data = await this.vendorRepairService.approveQuotation(id, quotationId, body.approvalNote, req.user);
    return { data, message: "Quotation approved" };
  }

  @Post(":id/vendor-repair/quotations/:quotationId/reject")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR")
  async rejectQuotation(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("quotationId") quotationId: string,
    @Body() body: { reason: string }
  ) {
    const data = await this.vendorRepairService.rejectQuotation(id, quotationId, body.reason, req.user);
    return { data, message: "Quotation rejected" };
  }

  @Post(":id/vendor-repair/authorize")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR")
  async authorizeVendorWork(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { overrideReason?: string }) {
    const data = await this.vendorRepairService.authorizeVendorWork(id, body.overrideReason, req.user);
    return { data, message: "Vendor work authorized" };
  }

  @Post(":id/vendor-repair/vendor-completed")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC")
  async markVendorCompleted(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.vendorRepairService.markVendorCompleted(id, req.user);
    return { data, message: "Vendor work marked completed" };
  }

  @Post(":id/vendor-repair/invoices")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR")
  async submitInvoice(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body()
    body: {
      supplierId: string;
      invoiceNo: string;
      invoiceDate: string;
      invoiceAmount: number;
      taxAmount?: number;
      currency?: string;
      evidenceAttachmentId?: string;
      exceedsQuotationReason?: string;
    }
  ) {
    const data = await this.vendorRepairService.submitInvoice(id, body, req.user);
    return { data, message: "Invoice submitted" };
  }

  @Post(":id/vendor-repair/invoices/:invoiceId/approve")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER")
  async approveInvoice(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("invoiceId") invoiceId: string,
    @Body() body: { financeNote?: string }
  ) {
    const data = await this.vendorRepairService.approveInvoice(id, invoiceId, body.financeNote, req.user);
    return { data, message: "Invoice finance approved" };
  }

  @Post(":id/vendor-repair/invoices/:invoiceId/reject")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER")
  async rejectInvoice(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("invoiceId") invoiceId: string,
    @Body() body: { reason: string }
  ) {
    const data = await this.vendorRepairService.rejectInvoice(id, invoiceId, body.reason, req.user);
    return { data, message: "Invoice rejected" };
  }

  @Post(":id/vendor-repair/close")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER")
  async closeVendorRepair(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { overrideReason?: string }) {
    const data = await this.vendorRepairService.closeVendorRepair(id, body.overrideReason, req.user);
    return { data, message: "Vendor repair closed" };
  }
}
