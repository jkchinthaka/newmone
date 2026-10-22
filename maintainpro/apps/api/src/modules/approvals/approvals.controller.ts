import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ApprovalProcessType } from "@prisma/client";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ApprovalInboxService } from "./approval-inbox.service";
import { ApprovalsService } from "./approvals.service";
import {
  ApprovalInboxQueryDto,
  BulkApproveDto,
  CreateApprovalRuleDto,
  DecideApprovalDto,
  EmergencyOverrideDto,
  InboxDecisionDto,
  ListRulesQueryDto,
  SimulateApprovalDto
} from "./dto/approvals.dto";
import { gateOverrideApprovalHook } from "./approval-conditions";

interface AuthedRequest {
  user?: {
    sub: string;
    email?: string;
    role: string;
    tenantId?: string | null;
    permissions?: string[];
  };
}

const READ_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER",
  "SUPERVISOR",
  "ASSET_MANAGER",
  "FACILITY_MANAGER",
  "FINANCE",
  "VIEWER"
] as const;

const MANAGE_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"] as const;

const DECIDE_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER",
  "SUPERVISOR",
  "ASSET_MANAGER",
  "FACILITY_MANAGER",
  "FINANCE"
] as const;

@ApiTags("Approvals")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ApprovalsController {
  constructor(
    private readonly approvals: ApprovalsService,
    private readonly inbox: ApprovalInboxService
  ) {}

  @Get("approvals/inbox")
  @Roles(...READ_ROLES)
  @Permissions("approvals.view", "access.approvalscontroller.listinbox")
  async listInbox(@Req() req: AuthedRequest, @Query() query: ApprovalInboxQueryDto) {
    const data = await this.inbox.list(req.user!, query);
    return { data, message: "Approval inbox fetched", meta: data.meta };
  }

  @Post("approvals/inbox/decide")
  @Roles(...DECIDE_ROLES)
  @Permissions("approvals.decide", "access.approvalscontroller.decideinbox")
  async decideInbox(
    @Req() req: AuthedRequest,
    @Body() body: InboxDecisionDto & { id?: string },
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    const id = body.id;
    if (!id) {
      return { data: null, message: "Approval id is required" };
    }
    const data = await this.inbox.decide({
      actor: req.user!,
      id,
      kind: body.kind,
      decision: body.decision,
      reason: body.reason,
      expectedVersion: body.expectedVersion,
      workOrderId: body.workOrderId,
      idempotencyKey
    });
    return { data, message: "Approval decision recorded" };
  }

  @Post("approvals/inbox/bulk-approve")
  @Roles(...DECIDE_ROLES)
  @Permissions("approvals.decide", "access.approvalscontroller.bulkapprove")
  async bulkApprove(
    @Req() req: AuthedRequest,
    @Body() body: BulkApproveDto,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    const data = await this.inbox.bulkApprove({ actor: req.user!, items: body.items, idempotencyKey });
    return { data, message: "Bulk approval finished" };
  }

  /** Phase 10 integration surface — documents GATE_OVERRIDE process wiring without fleet engine. */
  @Get("approvals/hooks/gate-override")
  @Roles(...MANAGE_ROLES)
  @Permissions("approvals.rule.manage", "access.approvalscontroller.gatehook")
  async gateHook() {
    return {
      data: {
        ...gateOverrideApprovalHook(),
        processTypes: Object.values(ApprovalProcessType),
        note: "Fleet Gate must call ApprovalsService.ensureApprovalRequired with GATE_OVERRIDE"
      },
      message: "Gate override approval hook metadata"
    };
  }

  @Get("approvals/:id")
  @Roles(...READ_ROLES)
  @Permissions("approvals.view", "access.approvalscontroller.getrequest")
  async getRequest(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.approvals.getRequest(id, req.user!);
    return { data, message: "Approval request fetched" };
  }

  @Post("approvals/:id/decide")
  @Roles(...DECIDE_ROLES)
  @Permissions("approvals.decide", "access.approvalscontroller.decide")
  async decide(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: DecideApprovalDto,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    const data = await this.inbox.decide({
      actor: req.user!,
      id,
      kind: "approval",
      decision: body.decision,
      reason: body.reason,
      expectedVersion: body.expectedVersion,
      idempotencyKey
    });
    return { data, message: "Approval decision recorded" };
  }

  @Post("approvals/:id/emergency-override")
  @Roles(...DECIDE_ROLES)
  @Permissions("approvals.override.emergency", "access.approvalscontroller.emergencyoverride")
  async emergencyOverride(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: EmergencyOverrideDto
  ) {
    const data = await this.approvals.applyEmergencyOverride({
      actor: req.user!,
      approvalRequestId: id,
      reason: body.reason
    });
    return { data, message: "Emergency override recorded; post-review still required" };
  }

  @Post("approvals/:id/escalate")
  @Roles(...MANAGE_ROLES)
  @Permissions("approvals.rule.manage", "access.approvalscontroller.escalate")
  async escalate(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.approvals.escalateOverdueSteps(req.user!, id);
    return { data, message: "Escalation processed" };
  }

  @Get("admin/approvals/rules")
  @Roles(...MANAGE_ROLES)
  @Permissions("approvals.rule.manage", "access.approvalscontroller.listrules")
  async listRules(@Req() req: AuthedRequest, @Query() query: ListRulesQueryDto) {
    const data = await this.approvals.listRules(req.user!, query);
    return { data, message: "Approval rules fetched" };
  }

  @Get("admin/approvals/rules/:id")
  @Roles(...MANAGE_ROLES)
  @Permissions("approvals.rule.manage", "access.approvalscontroller.getrule")
  async getRule(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.approvals.getRule(id, req.user!);
    return { data, message: "Approval rule fetched" };
  }

  @Post("admin/approvals/rules")
  @Roles(...MANAGE_ROLES)
  @Permissions("approvals.rule.manage", "access.approvalscontroller.createrule")
  async createRule(@Req() req: AuthedRequest, @Body() body: CreateApprovalRuleDto) {
    const data = await this.approvals.createRule(body, req.user!);
    return { data, message: "Approval rule created" };
  }

  @Post("admin/approvals/rules/:id/version")
  @Roles(...MANAGE_ROLES)
  @Permissions("approvals.rule.manage", "access.approvalscontroller.versionrule")
  async versionRule(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: CreateApprovalRuleDto
  ) {
    const data = await this.approvals.updateRuleVersion(id, body, req.user!);
    return { data, message: "Approval rule version created" };
  }

  @Patch("admin/approvals/rules/:id/deactivate")
  @Roles(...MANAGE_ROLES)
  @Permissions("approvals.rule.manage", "access.approvalscontroller.deactivate")
  async deactivate(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.approvals.deactivateRule(id, req.user!);
    return { data, message: "Approval rule deactivated" };
  }

  @Post("admin/approvals/rules/preview")
  @Roles(...MANAGE_ROLES)
  @Permissions("approvals.rule.manage", "access.approvalscontroller.preview")
  async preview(@Body() body: CreateApprovalRuleDto) {
    const data = this.approvals.previewImpact(body);
    return { data, message: "Approval rule impact preview" };
  }

  @Post("admin/approvals/rules/simulate")
  @Roles(...MANAGE_ROLES)
  @Permissions("approvals.rule.manage", "access.approvalscontroller.simulate")
  async simulate(@Req() req: AuthedRequest, @Body() body: SimulateApprovalDto) {
    const data = await this.approvals.simulate(req.user!, body);
    return { data, message: "Approval simulation result (no request created)" };
  }
}
