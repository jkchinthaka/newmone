import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from "class-validator";

import {
  COPILOT_FOCUS_AREAS,
  type CopilotFocusArea,
  COPILOT_MODES,
  type CopilotMode
} from "./copilot-chat.dto";

export class CopilotContextQueryDto {
  @ApiPropertyOptional({ enum: COPILOT_FOCUS_AREAS })
  @IsOptional()
  @IsIn(COPILOT_FOCUS_AREAS)
  focusArea?: CopilotFocusArea;

  @ApiPropertyOptional({ enum: COPILOT_MODES })
  @IsOptional()
  @IsIn(COPILOT_MODES)
  mode?: CopilotMode;
}

export class CopilotCreateConversationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ enum: COPILOT_FOCUS_AREAS, default: "GENERAL" })
  @IsOptional()
  @IsIn(COPILOT_FOCUS_AREAS)
  focusArea?: CopilotFocusArea;

  @ApiPropertyOptional({ enum: COPILOT_MODES, default: "CHAT" })
  @IsOptional()
  @IsIn(COPILOT_MODES)
  mode?: CopilotMode;
}

export class CopilotLogsQueryDto {
  @ApiPropertyOptional({ enum: COPILOT_FOCUS_AREAS })
  @IsOptional()
  @IsIn(COPILOT_FOCUS_AREAS)
  focusArea?: CopilotFocusArea;

  @ApiPropertyOptional({ enum: COPILOT_MODES })
  @IsOptional()
  @IsIn(COPILOT_MODES)
  mode?: CopilotMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: "ISO date time lower bound" })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: "ISO date time upper bound" })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  limit?: string;
}
