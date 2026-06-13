import { TenantMembershipRole } from "@prisma/client";
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class CreateAdminInvitationDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsEnum(TenantMembershipRole)
  membershipRole?: TenantMembershipRole;

  /** Required for SUPER_ADMIN when no active tenant context is set. Ignored for ADMIN. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  tenantId?: string;
}
