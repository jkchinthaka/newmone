import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

import { PASSWORD_STRENGTH_MESSAGE, PASSWORD_STRENGTH_PATTERN } from "../../auth/dto/password-strength";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  /** Changing the email requires currentPassword. */
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  @Matches(PASSWORD_STRENGTH_PATTERN, { message: PASSWORD_STRENGTH_MESSAGE })
  newPassword?: string;
}
