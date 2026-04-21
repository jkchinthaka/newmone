import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PredictiveAiService } from "./predictive-ai.service";

@ApiTags("Predictive AI")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("predictive-ai")
export class PredictiveAiController {
  constructor(private readonly predictiveAiService: PredictiveAiService) {}

  @Get("logs")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "SUPERVISOR")
  async logs() {
    const data = await this.predictiveAiService.logs();
    return { data, message: "Predictive logs fetched" };
  }
}