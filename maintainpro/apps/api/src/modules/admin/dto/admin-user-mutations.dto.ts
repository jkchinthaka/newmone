import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

/** Same policy as ResetPasswordDto (apps/api/src/modules/auth/dto/reset-password.dto.ts) — reused, not reinvented. */
const PASSWORD_POLICY = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const PASSWORD_POLICY_MESSAGE =
  "Password must contain at least 8 characters, one uppercase letter, one number, and one special character";

export class CreateAdminUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(36)
  roleId!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(36)
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(36)
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  designation?: string;

  @ApiPropertyOptional({ description: "Optional explicit password. When omitted, a random temporary password is generated and mustChangePassword is forced true." })
  @IsOptional()
  @IsString()
  @Matches(PASSWORD_POLICY, { message: PASSWORD_POLICY_MESSAGE })
  password?: string;
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(36)
  roleId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(36)
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(36)
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  designation?: string;
}

export class SetAdminUserPasswordDto {
  @ApiPropertyOptional({ description: "Explicit new password. Omit to generate a random temporary password." })
  @IsOptional()
  @IsString()
  @Matches(PASSWORD_POLICY, { message: PASSWORD_POLICY_MESSAGE })
  newPassword?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}

export class UpdateRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionIds!: string[];
}
