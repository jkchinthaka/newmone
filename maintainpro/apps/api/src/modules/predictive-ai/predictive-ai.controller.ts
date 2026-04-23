import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import {
  AssignTechnicianActionDto,
  CreateWorkOrderActionDto,
  GenerateReportActionDto,
  ScheduleMaintenanceActionDto
} from "./dto/copilot-actions.dto";
import { CopilotChatDto } from "./dto/copilot-chat.dto";
import {
  CopilotContextQueryDto,
  CopilotCreateConversationDto,
  CopilotLogsQueryDto
} from "./dto/copilot-query.dto";
import { PredictiveAiService, type CopilotActor } from "./predictive-ai.service";

type AuthedRequest = Request & {
  user?: JwtPayload;
};

@ApiTags("Predictive AI")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller(["predictive-ai", "ai"])
export class PredictiveAiController {
  @Inject(PredictiveAiService)
  private readonly predictiveAiService!: PredictiveAiService;

  @Post("copilot")
  async copilot(@Req() req: AuthedRequest, @Body() dto: CopilotChatDto) {
    const data = await this.predictiveAiService.copilotChat(dto, this.getActor(req));
    return { data, message: "AI copilot response generated" };
  }

  @Get("context")
  async context(@Req() req: AuthedRequest, @Query() query: CopilotContextQueryDto) {
    const data = await this.predictiveAiService.getCopilotContext(
      this.getActor(req),
      query.focusArea,
      query.mode
    );

    return { data, message: "Copilot context fetched" };
  }

  @Get("conversations")
  async conversations(
    @Req() req: AuthedRequest,
    @Query("limit") limitRaw?: string,
    @Query("userId") userId?: string
  ) {
    const data = await this.predictiveAiService.listConversations(this.getActor(req), {
      limit: limitRaw,
      userId
    });

    return { data, message: "Copilot conversations fetched" };
  }

  @Post("conversations")
  async createConversation(@Req() req: AuthedRequest, @Body() dto: CopilotCreateConversationDto) {
    const data = await this.predictiveAiService.createConversation(this.getActor(req), dto);
    return { data, message: "Copilot conversation created" };
  }

  @Get("conversations/:id")
  async conversation(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Query("limit") limitRaw?: string
  ) {
    const data = await this.predictiveAiService.getConversation(this.getActor(req), id, limitRaw);
    return { data, message: "Copilot conversation fetched" };
  }

  @Get("conversations/:id/messages")
  async conversationMessages(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Query("limit") limitRaw?: string
  ) {
    const data = await this.predictiveAiService.getConversationMessages(
      this.getActor(req),
      id,
      limitRaw
    );

    return { data, message: "Copilot conversation messages fetched" };
  }

  @Get("logs")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "SUPERVISOR", "MANAGER", "TECHNICIAN")
  async logs(@Req() req: AuthedRequest, @Query() query: CopilotLogsQueryDto) {
    const data = await this.predictiveAiService.logs(this.getActor(req), query);
    return { data, message: "Copilot logs fetched" };
  }

  @Get("predictive-logs")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "SUPERVISOR")
  async predictiveLogs() {
    const data = await this.predictiveAiService.predictiveLogs();
    return { data, message: "Predictive maintenance logs fetched" };
  }

  @Post("actions/create-work-order")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER")
  async createWorkOrderAction(
    @Req() req: AuthedRequest,
    @Body() dto: CreateWorkOrderActionDto
  ) {
    const data = await this.predictiveAiService.createWorkOrderAction(this.getActor(req), dto);
    return { data, message: "AI action completed: work order created" };
  }

  @Post("actions/schedule-maintenance")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER")
  async scheduleMaintenanceAction(
    @Req() req: AuthedRequest,
    @Body() dto: ScheduleMaintenanceActionDto
  ) {
    const data = await this.predictiveAiService.scheduleMaintenanceAction(this.getActor(req), dto);
    return { data, message: "AI action completed: maintenance scheduled" };
  }

  @Post("actions/assign-technician")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER")
  async assignTechnicianAction(
    @Req() req: AuthedRequest,
    @Body() dto: AssignTechnicianActionDto
  ) {
    const data = await this.predictiveAiService.assignTechnicianAction(this.getActor(req), dto);
    return { data, message: "AI action completed: technician assigned" };
  }

  @Post("actions/generate-report")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR", "MANAGER")
  async generateReportAction(
    @Req() req: AuthedRequest,
    @Body() dto: GenerateReportActionDto
  ) {
    const data = await this.predictiveAiService.generateReportAction(this.getActor(req), dto);
    return { data, message: "AI action completed: report generated" };
  }

  private getActor(req: AuthedRequest): CopilotActor | null {
    if (!req.user) {
      return null;
    }

    return {
      sub: req.user.sub,
      role: req.user.role,
      email: req.user.email,
      tenantId: req.user.tenantId ?? null
    };
  }
}
