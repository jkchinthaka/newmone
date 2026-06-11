import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/, {
    message: "Password must contain at least 8 characters, one uppercase letter, one number, and one special character"
  })
  password!: string;

  /**
   * Tenant invitation token (see TenantInvitation.token). When provided and valid,
   * registration is allowed regardless of ALLOW_PUBLIC_REGISTRATION, and the new
   * user is attached to the inviting tenant with the invited membership role.
   */
  @IsOptional()
  @IsString()
  invitationToken?: string;
}
