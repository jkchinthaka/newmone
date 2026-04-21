import { IsString, Matches, MinLength } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/, {
    message: "Password must contain at least 8 characters, one uppercase letter, one number, and one special character"
  })
  newPassword!: string;
}
