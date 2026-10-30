import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { CopilotContextQueryDto } from "./dto/copilot-query.dto";
import { PredictiveAiService, type CopilotActor } from "./predictive-ai.service";

type AuthedRequest = Request & {
  user?: JwtPayload;
};

/**
 * The AI Copilot routes (copilot chat, context, conversations, logs, predictive logs and the
 * create/schedule/assign/report actions) were removed: they read and changed data without a
 * tenant filter or permission check. PredictiveAiModule is also no longer registered in
 * AppModule, so no route here is served; this class is kept for the guard unit test.
 */
@ApiTags("Predictive AI")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller(["predictive-ai", "ai"])
export class PredictiveAiController {
  @Inject(PredictiveAiService)
  private readonly predictiveAiService!: PredictiveAiService;

  @Get("field-insights")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "ASSET_MANAGER",
    "SUPERVISOR",
    "MANAGER",
    "TECHNICIAN",
    "MECHANIC",
    "DRIVER"
  )
  @Permissions("predictive_insights.view")
  async fieldInsights(
    @Req() req: AuthedRequest,
    @Query() query: CopilotContextQueryDto,
    @Query("limit") limitRaw?: string
  ) {
    const data = await this.predictiveAiService.getFieldInsights(
      this.getActor(req),
      query.focusArea,
      query.mode,
      limitRaw
    );

    return { data, message: "Field insights fetched" };
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
