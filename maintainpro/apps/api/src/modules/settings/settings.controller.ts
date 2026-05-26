import { Body, Controller, Get, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { SettingsService } from "./settings.service";

type AuthedRequest = {
  user: JwtPayload;
};

@ApiTags("Settings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("profile")
  async profile(@Req() req: AuthedRequest) {
    const data = await this.settingsService.getProfile(req.user.sub);
    return { data, message: "Profile settings fetched" };
  }

  @Patch("profile")
  async updateProfile(
    @Req() req: AuthedRequest,
    @Body()
    body: Partial<{
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      currentPassword: string;
      newPassword: string;
    }>
  ) {
    const data = await this.settingsService.updateProfile(req.user.sub, body);
    return { data, message: "Profile settings updated" };
  }

  @Get("organization")
  @Permissions("settings.view")
  async organization(@Req() req: AuthedRequest) {
    const data = await this.settingsService.getOrganization(req.user);
    return { data, message: "Organization settings fetched" };
  }

  @Patch("organization")
  @Permissions("settings.organization.manage")
  async updateOrganization(
    @Req() req: AuthedRequest,
    @Body()
    body: Partial<{
      companyName: string;
      slug: string;
      timezone: string;
      currency: string;
      logoUrl: string;
    }>
  ) {
    const data = await this.settingsService.updateOrganization(req.user, body);
    return { data, message: "Organization settings updated" };
  }

  @Get("system")
  @Permissions("settings.view")
  async system(@Req() req: AuthedRequest) {
    const data = await this.settingsService.getSystemConfiguration(req.user);
    return { data, message: "System configuration fetched" };
  }

  @Patch("system")
  @Permissions("settings.system.manage")
  async updateSystem(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    const data = await this.settingsService.updateSystemConfiguration(req.user, body);
    return { data, message: "System configuration updated" };
  }

  @Get("integrations")
  @Permissions("settings.view")
  async integrations(@Req() req: AuthedRequest) {
    const data = await this.settingsService.getIntegrations(req.user);
    return { data, message: "Integration settings fetched" };
  }

  @Patch("integrations")
  @Permissions("settings.system.manage")
  async updateIntegrations(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    const data = await this.settingsService.updateIntegrations(req.user, body);
    return { data, message: "Integration settings updated" };
  }

  @Get("feature-toggles")
  @Permissions("settings.view")
  async featureToggles(@Req() req: AuthedRequest) {
    const data = await this.settingsService.getFeatureToggles(req.user);
    return { data, message: "Feature toggles fetched" };
  }

  @Patch("feature-toggles")
  @Permissions("settings.system.manage")
  async updateFeatureToggles(@Req() req: AuthedRequest, @Body() body: Record<string, boolean>) {
    const data = await this.settingsService.updateFeatureToggles(req.user, body);
    return { data, message: "Feature toggles updated" };
  }

  @Get("automation-rules")
  @Permissions("settings.view")
  async automationRules(@Req() req: AuthedRequest) {
    const data = await this.settingsService.getAutomationRules(req.user);
    return { data, message: "Automation rules fetched" };
  }

  @Patch("automation-rules")
  @Permissions("settings.system.manage")
  async updateAutomationRules(
    @Req() req: AuthedRequest,
    @Body() body: { rules: Array<Record<string, unknown>> }
  ) {
    const data = await this.settingsService.updateAutomationRules(req.user, body.rules ?? []);
    return { data, message: "Automation rules updated" };
  }

  @Get("digest-schedules")
  @Permissions("settings.view")
  async digestSchedules(@Req() req: AuthedRequest) {
    const data = await this.settingsService.getDigestSchedules(req.user);
    return { data, message: "Digest schedules fetched" };
  }

  @Patch("digest-schedules")
  @Permissions("settings.system.manage")
  async updateDigestSchedules(
    @Req() req: AuthedRequest,
    @Body() body: { schedules: Array<Record<string, unknown>> }
  ) {
    const data = await this.settingsService.updateDigestSchedules(req.user, body.schedules ?? []);
    return { data, message: "Digest schedules updated" };
  }

  @Get("audit-logs")
  @Permissions("audit.view")
  async auditLogs(
    @Req() req: AuthedRequest,
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string,
    @Query("entity") entity?: string,
    @Query("module") module?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const page = Number(pageRaw ?? 1);
    const pageSize = Number(pageSizeRaw ?? 20);
    const data = await this.settingsService.getAuditLogs(req.user, {
      page,
      pageSize,
      entity,
      module,
      from,
      to
    });

    return {
      data: data.items,
      message: "Audit logs fetched",
      meta: data.pagination
    };
  }
}
