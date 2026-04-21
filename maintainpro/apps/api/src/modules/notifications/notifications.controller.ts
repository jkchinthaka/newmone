import { Body, Controller, Get, Param, Patch, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";

@ApiTags("Notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(@Req() req: { user: { sub: string } }) {
    const data = await this.notificationsService.findAll(req.user.sub);
    return { data, message: "Notifications fetched" };
  }

  @Patch(":id/read")
  async markRead(@Param("id") id: string) {
    const data = await this.notificationsService.markRead(id);
    return { data, message: "Notification marked as read" };
  }

  @Patch("mark-all-read")
  async markAllRead(@Req() req: { user: { sub: string } }) {
    const data = await this.notificationsService.markAllRead(req.user.sub);
    return { data, message: "All notifications marked as read" };
  }

  @Get("preferences")
  async preferences(@Req() req: { user: { sub: string } }) {
    const data = this.notificationsService.getPreferences(req.user.sub);
    return { data, message: "Notification preferences fetched" };
  }

  @Patch("preferences")
  async updatePreferences(
    @Req() req: { user: { sub: string } },
    @Body() body: Partial<{ inApp: boolean; email: boolean; sms: boolean; whatsapp: boolean; push: boolean }>
  ) {
    const data = this.notificationsService.updatePreferences(req.user.sub, body);
    return { data, message: "Notification preferences updated" };
  }
}
