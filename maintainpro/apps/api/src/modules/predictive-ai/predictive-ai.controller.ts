import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CopilotChatDto } from "./dto/copilot-chat.dto";
import { PredictiveAiService } from "./predictive-ai.service";

@ApiTags("Predictive AI")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("predictive-ai")
export class PredictiveAiController {
  @Inject(PredictiveAiService)
  private readonly predictiveAiService!: PredictiveAiService;

  @Post("copilot")
  async copilot(@Body() dto: CopilotChatDto) {
    const data = await this.predictiveAiService.copilotChat(dto);
    return { data, message: "AI assistant response generated" };
  }

  @Get("logs")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "SUPERVISOR")
  async logs() {
    const data = await this.predictiveAiService.logs();
    return { data, message: "Predictive logs fetched" };
  }
}