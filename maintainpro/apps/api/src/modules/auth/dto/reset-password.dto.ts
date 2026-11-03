import { IsString, Matches, MinLength } from "class-validator";

import { PASSWORD_STRENGTH_MESSAGE, PASSWORD_STRENGTH_PATTERN } from "./password-strength";

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_STRENGTH_PATTERN, { message: PASSWORD_STRENGTH_MESSAGE })
  newPassword!: string;
}
