import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import type { JwtPayload } from "../auth/auth.types";
import { EnterpriseGovernanceService } from "./enterprise-governance.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Enterprise Governance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class EnterpriseGovernanceController {
  constructor(private readonly gov: EnterpriseGovernanceService) {}

  @Get("search")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN", "VIEWER", "DRIVER", "AUDITOR")
  @Permissions("assets.view")
  async search(@Req() req: AuthedRequest, @Query("q") q = "", @Query("limit") limit?: string) {
    const data = await this.gov.globalSearch(req.user, q, limit ? Number(limit) : 20);
    return { data, message: "Global search" };
  }

  @Get("sod-policies")
  @Roles("SUPER_ADMIN", "ADMIN", "AUDITOR")
  @Permissions("admin.organization.manage")
  async listSod(@Req() req: AuthedRequest) {
    return { data: await this.gov.listSodPolicies(req.user), message: "SoD policies" };
  }

  @Post("sod-policies")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.organization.manage")
  async upsertSod(
    @Req() req: AuthedRequest,
    @Body()
    body: { code: string; name: string; transactionType: string; ruleJson: string; active?: boolean }
  ) {
    return { data: await this.gov.upsertSodPolicy(req.user, body), message: "SoD policy saved" };
  }

  @Post("sod-policies/evaluate")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  @Permissions("admin.organization.manage")
  async evaluateSod(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      transactionType: string;
      subject: Record<string, string | null | undefined>;
    }
  ) {
    await this.gov.assertSoD(req.user.tenantId!, body.transactionType, {
      actorId: req.user.sub,
      subject: body.subject
    });
    return { data: { allowed: true }, message: "SoD check passed" };
  }

  @Post("meter-corrections")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN")
  @Permissions("assets.manage")
  async requestMeterCorrection(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      meterId: string;
      readingId?: string;
      originalValue: number;
      correctedValue: number;
      reason: string;
    }
  ) {
    return {
      data: await this.gov.requestMeterCorrection(req.user, body),
      message: "Meter correction requested"
    };
  }

  @Post("meter-corrections/:id/decision")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  @Permissions("assets.manage")
  async decideMeterCorrection(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { approve: boolean }
  ) {
    return {
      data: await this.gov.approveMeterCorrection(req.user, id, !!body.approve),
      message: body.approve ? "Meter correction approved" : "Meter correction rejected"
    };
  }

  @Post("temporary-repairs")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN")
  @Permissions("work_orders.manage")
  async temporaryRepair(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      workOrderId: string;
      reason: string;
      temporaryAction: string;
      risk?: string;
      expiryAt: string;
      createFollowUp?: boolean;
    }
  ) {
    return {
      data: await this.gov.recordTemporaryRepair(req.user, body),
      message: "Temporary repair recorded"
    };
  }

  @Get("custom-fields")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN", "VIEWER", "AUDITOR")
  @Permissions("admin.organization.manage")
  async listFields(@Req() req: AuthedRequest, @Query("entityType") entityType?: string) {
    return { data: await this.gov.listCustomFields(req.user, entityType), message: "Custom fields" };
  }

  @Post("custom-fields")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.organization.manage")
  async upsertField(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      entityType: string;
      key: string;
      label: string;
      fieldType: string;
      required?: boolean;
      allowedValuesJson?: string;
      validationJson?: string;
      sortOrder?: number;
      active?: boolean;
    }
  ) {
    return { data: await this.gov.upsertCustomField(req.user, body), message: "Custom field saved" };
  }

  @Post("approval-delegations")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  @Permissions("approvals.rule.manage")
  async createDelegation(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      delegateId: string;
      reason: string;
      startsAt: string;
      endsAt: string;
      scopeJson?: string;
    }
  ) {
    return {
      data: await this.gov.createDelegation(req.user, body),
      message: "Delegation created"
    };
  }

  @Post("service-api-keys")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.organization.manage")
  async issueKey(
    @Req() req: AuthedRequest,
    @Body() body: { name: string; scopes?: string[]; expiresAt?: string }
  ) {
    return { data: await this.gov.issueApiKey(req.user, body), message: "API key issued" };
  }

  @Post("service-api-keys/:id/revoke")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.organization.manage")
  async revokeKey(@Req() req: AuthedRequest, @Param("id") id: string) {
    return { data: await this.gov.revokeApiKey(req.user, id), message: "API key revoked" };
  }

  @Post("outbound-webhooks")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.organization.manage")
  async registerWebhook(
    @Req() req: AuthedRequest,
    @Body() body: { name: string; url: string; secret: string; events: string[] }
  ) {
    return { data: await this.gov.registerWebhook(req.user, body), message: "Webhook registered" };
  }

  @Post("outbound-webhooks/retry-failed")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.organization.manage")
  async retryWebhooks(@Req() req: AuthedRequest) {
    return {
      data: await this.gov.retryFailedDeliveries(req.user),
      message: "Failed webhook deliveries retried"
    };
  }
}
