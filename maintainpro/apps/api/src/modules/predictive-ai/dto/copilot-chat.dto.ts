import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const COPILOT_MODES = ["CHAT", "ANALYZE", "PREDICT", "RECOMMEND"] as const;
export type CopilotMode = (typeof COPILOT_MODES)[number];

export const COPILOT_FOCUS_AREAS = [
  "GENERAL",
  "MAINTENANCE",
  "FLEET",
  "CLEANING",
  "INVENTORY",
  "UTILITIES"
] as const;
export type CopilotFocusArea = (typeof COPILOT_FOCUS_AREAS)[number];

export class CopilotChatDto {
  @ApiProperty({ description: "Prompt sent to the MaintainPro AI assistant" })
  @IsString()
  @MaxLength(4000)
  message!: string;

  @ApiPropertyOptional({ description: "Conversation id returned by the upstream assistant" })
  @IsOptional()
  @IsString()
  conversationId?: string | null;

  @ApiPropertyOptional({ description: "Optional title when starting a new conversation" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  conversationTitle?: string;

  @ApiPropertyOptional({ enum: COPILOT_MODES, default: "CHAT" })
  @IsOptional()
  @IsIn(COPILOT_MODES)
  mode?: CopilotMode;

  @ApiPropertyOptional({ enum: COPILOT_FOCUS_AREAS, default: "GENERAL" })
  @IsOptional()
  @IsIn(COPILOT_FOCUS_AREAS)
  focusArea?: CopilotFocusArea;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  markdown?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: "Hint for clients that want streaming-style rendering"
  })
  @IsOptional()
  @IsBoolean()
  stream?: boolean;
}