import { IsArray, IsBoolean, IsEmail, IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

import { WORKFORCE_AVAILABILITY_STATUSES } from "../../../common/utils/workforce-availability";

export class CreateWorkforceEmployeeDto {
  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  employeeNo?: string;

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
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  dailyCapacityHours?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  canLogin?: boolean;

  @IsOptional()
  @IsBoolean()
  canReceiveWorkOrders?: boolean;

  /** Explicit operator choice. Omitted uses the People creation rule. Blank is rejected. */
  @IsOptional()
  @IsString()
  @IsIn([...WORKFORCE_AVAILABILITY_STATUSES])
  availabilityStatus?: string;
}

export class UpdateWorkforceEmployeeDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  employeeNo?: string;

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
  departmentId?: string | null;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  dailyCapacityHours?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  canLogin?: boolean;

  @IsOptional()
  @IsBoolean()
  canReceiveWorkOrders?: boolean;

  /** Explicit operator choice. Omitted uses the People creation rule. Blank is rejected. */
  @IsOptional()
  @IsString()
  @IsIn([...WORKFORCE_AVAILABILITY_STATUSES])
  availabilityStatus?: string;
}
