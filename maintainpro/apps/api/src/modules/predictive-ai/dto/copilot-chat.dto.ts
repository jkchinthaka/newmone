import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const COPILOT_MODES = ["CHAT"] as const;
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
}