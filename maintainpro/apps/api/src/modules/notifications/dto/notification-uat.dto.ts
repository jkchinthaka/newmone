import { IsIn, IsObject, IsOptional, IsString, MinLength } from "class-validator";

import { NOTIFICATION_UAT_TEMPLATE_KEYS } from "../notification-uat.mapper";

export class NotificationUatEmailTestDto {
  @IsString()
  @MinLength(3)
  recipient!: string;

  @IsString()
  @IsIn([...NOTIFICATION_UAT_TEMPLATE_KEYS])
  templateKey!: (typeof NOTIFICATION_UAT_TEMPLATE_KEYS)[number];

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}

export class NotificationUatSmsTestDto {
  @IsString()
  @MinLength(7)
  recipient!: string;

  @IsString()
  @IsIn([...NOTIFICATION_UAT_TEMPLATE_KEYS])
  templateKey!: (typeof NOTIFICATION_UAT_TEMPLATE_KEYS)[number];

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}
