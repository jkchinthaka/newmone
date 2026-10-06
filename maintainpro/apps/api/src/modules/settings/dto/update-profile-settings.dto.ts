import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

import { IsNotBlank } from "../../../common/validation/not-blank";

/**
 * PATCH /settings/profile. Previously the body was an untyped Partial<...>, so no
 * validation ran and " " was trimmed and stored as an empty first name (QA whitespace defect).
 */
export class UpdateProfileSettingsDto {
  @IsOptional()
  @IsString()
  @IsNotBlank({ message: "First name is required" })
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotBlank({ message: "Last name is required" })
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  newPassword?: string;
}
