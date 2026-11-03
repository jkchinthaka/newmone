import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Matches,
  MinLength
} from "class-validator";

import { PASSWORD_STRENGTH_MESSAGE, PASSWORD_STRENGTH_PATTERN } from "../../auth/dto/password-strength";

export enum InviteMethod {
  INVITE_EMAIL = "INVITE_EMAIL",
  TEMP_PASSWORD = "TEMP_PASSWORD",
  COPY_LINK = "COPY_LINK",
  /** The admin types the first password; the person must replace it at first sign-in. */
  SET_PASSWORD = "SET_PASSWORD"
}

export class PeopleListQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  loginStatus?: string;

  @IsOptional()
  @IsString()
  inviteStatus?: string;

  @IsOptional()
  @IsString()
  technicianOnly?: string;
}

export class CreatePersonDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  employeeNo?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsString()
  designation!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  isTechnician?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  workCategories?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  dailyCapacityHours?: number;

  @IsOptional()
  @IsString()
  shift?: string;

  @IsOptional()
  @IsBoolean()
  canReceiveWorkOrders?: boolean;

  @IsOptional()
  @IsString()
  availabilityStatus?: string;

  @IsOptional()
  @IsBoolean()
  canLogin?: boolean;

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsString()
  branchScope?: string;

  @IsOptional()
  @IsEnum(InviteMethod)
  inviteMethod?: InviteMethod;

  /** Required when inviteMethod is SET_PASSWORD. Never stored or logged in clear text. */
  @IsOptional()
  @IsString()
  @Matches(PASSWORD_STRENGTH_PATTERN, { message: PASSWORD_STRENGTH_MESSAGE })
  initialPassword?: string;
}

export class UpdatePersonDto {
  @IsOptional()
  @IsString()
  employeeNo?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  workCategories?: string[];

  @IsOptional()
  @IsNumber()
  dailyCapacityHours?: number;

  @IsOptional()
  @IsString()
  shift?: string;

  @IsOptional()
  @IsBoolean()
  canReceiveWorkOrders?: boolean;

  @IsOptional()
  @IsString()
  availabilityStatus?: string;
}

export class UpdateTechnicianProfileDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  workCategories?: string[];

  @IsOptional()
  @IsNumber()
  dailyCapacityHours?: number;

  @IsOptional()
  @IsString()
  shift?: string;

  @IsOptional()
  @IsBoolean()
  canReceiveWorkOrders?: boolean;

  @IsOptional()
  @IsString()
  availabilityStatus?: string;

  @IsOptional()
  @IsString()
  branchName?: string;
}

export class EnableLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  roleId!: string;

  @IsOptional()
  @IsString()
  branchScope?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsEnum(InviteMethod)
  inviteMethod?: InviteMethod;

  /** Required when inviteMethod is SET_PASSWORD. Never stored or logged in clear text. */
  @IsOptional()
  @IsString()
  @Matches(PASSWORD_STRENGTH_PATTERN, { message: PASSWORD_STRENGTH_MESSAGE })
  initialPassword?: string;
}

export class AcceptInviteDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
