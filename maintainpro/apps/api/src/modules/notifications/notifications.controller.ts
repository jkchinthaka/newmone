import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { NotificationType } from "@prisma/client";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";

type AuthedRequest = {
  user: {
    sub: string;
  };
};

@ApiTags("Notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(
    @Req() req: AuthedRequest,
    @Query("status") status?: "ALL" | "READ" | "UNREAD",
    @Query("type") type?: string,
    @Query("priority") priority?: string,
    @Query("search") search?: string,
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string,
    @Query("includeAnalytics") includeAnalyticsRaw?: string
  ) {
    const result = await this.notificationsService.findAll(req.user.sub, {
      status,
      type,
      priority,
      search,
      page: Number(pageRaw ?? 1),
      pageSize: Number(pageSizeRaw ?? 20),
      includeAnalytics: includeAnalyticsRaw === "true"
    });

    return {
      data: {
        items: result.items,
        analytics: result.analytics,
        dailySummary: result.dailySummary
      },
      meta: result.pagination,
      message: "Notifications fetched"
    };
  }

  @Patch(":id/read")
  async markRead(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.notificationsService.markRead(req.user.sub, id);
    return { data, message: "Notification marked as read" };
  }

  @Patch("mark-all-read")
  async markAllRead(@Req() req: AuthedRequest) {
    const data = await this.notificationsService.markAllRead(req.user.sub);
    return { data, message: "All notifications marked as read" };
  }

  @Post(":id/actions")
  async actions(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body()
    body: {
      action: "ACKNOWLEDGE" | "SCHEDULE_TASK" | "CREATE_WORK_ORDER" | "ASSIGN_USER";
      payload?: Record<string, unknown>;
    }
  ) {
    const data = await this.notificationsService.runAction(req.user.sub, id, req.user.sub, body);
    return { data, message: "Notification action executed" };
  }

  @Post(":id/explain")
  async explain(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.notificationsService.explain(req.user.sub, id);
    return { data, message: "AI explanation generated" };
  }

  @Get("analytics")
  async analytics(@Req() req: AuthedRequest) {
    const data = await this.notificationsService.getNotificationAnalytics(req.user.sub);
    return { data, message: "Notification analytics fetched" };
  }

  @Get("ai-summary")
  async aiSummary(@Req() req: AuthedRequest) {
    const data = await this.notificationsService.getAiDailySummary(req.user.sub);
    return { data, message: "AI daily summary fetched" };
  }

  @Get("preferences")
  async preferences(@Req() req: AuthedRequest) {
    const data = await this.notificationsService.getPreferences(req.user.sub);
    return { data, message: "Notification preferences fetched" };
  }

  @Patch("preferences")
  async updatePreferences(
    @Req() req: AuthedRequest,
    @Body() body: Partial<{ inApp: boolean; email: boolean; sms: boolean; whatsapp: boolean; push: boolean }>
  ) {
    const data = await this.notificationsService.updatePreferences(req.user.sub, body);
    return { data, message: "Notification preferences updated" };
  }

  @Get("rules")
  async rules(@Req() req: AuthedRequest) {
    const data = await this.notificationsService.getRules(req.user.sub);
    return { data, message: "Notification rules fetched" };
  }

  @Patch("rules")
  async updateRules(
    @Req() req: AuthedRequest,
    @Body()
    body: Partial<{
      mutedTypes: NotificationType[];
      onlyCritical: boolean;
      emailOnlyOverdue: boolean;
    }>
  ) {
    const data = await this.notificationsService.updateRules(req.user.sub, body);
    return { data, message: "Notification rules updated" };
  }
}
