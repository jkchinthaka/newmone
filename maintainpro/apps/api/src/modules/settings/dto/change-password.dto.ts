import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from "class-validator";

import { PASSWORD_STRENGTH_MESSAGE, PASSWORD_STRENGTH_PATTERN } from "../../auth/dto/password-strength";

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  @Matches(PASSWORD_STRENGTH_PATTERN, { message: PASSWORD_STRENGTH_MESSAGE })
  newPassword!: string;
}
