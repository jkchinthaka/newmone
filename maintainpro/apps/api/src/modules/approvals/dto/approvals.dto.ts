import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import {
  ApprovalDecisionOutcome,
  ApprovalProcessType,
  ApprovalRequestStatus,
  ApprovalTrigger,
  RoleName
} from "@prisma/client";

export class ApprovalRuleLevelDto {
  @IsInt()
  @Min(1)
  level!: number;

  @IsOptional()
  @IsEnum(RoleName)
  approverRole?: RoleName;

  @IsOptional()
  @IsString()
  approverUserId?: string;

  @IsOptional()
  @IsString()
  backupUserId?: string;
}

export class CreateApprovalRuleDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(ApprovalProcessType)
  processType!: ApprovalProcessType;

  @IsEnum(ApprovalTrigger)
  trigger!: ApprovalTrigger;

  @IsOptional()
  conditions?: unknown;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  domainId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  priorityScope?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  workTypeScope?: string[];

  @IsOptional()
  @IsNumber()
  amountThreshold?: number;

  @IsOptional()
  @IsString()
  amountField?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  slaHours?: number;

  @IsOptional()
  @IsBoolean()
  escalateToBackup?: boolean;

  @IsOptional()
  @IsBoolean()
  emergencyOverrideAllowed?: boolean;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApprovalRuleLevelDto)
  levels!: ApprovalRuleLevelDto[];
}

export class SimulateApprovalDto {
  @IsEnum(ApprovalProcessType)
  processType!: ApprovalProcessType;

  @IsOptional()
  @IsEnum(ApprovalTrigger)
  trigger?: ApprovalTrigger;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsNumber()
  estimatedCost?: number;

  @IsOptional()
  @IsNumber()
  actualCost?: number;

  @IsOptional()
  @IsString()
  executionType?: string;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  domainId?: string;

  @IsOptional()
  @IsString()
  workType?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;
}

export class DecideApprovalDto {
  @IsEnum(ApprovalDecisionOutcome)
  decision!: ApprovalDecisionOutcome;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class EmergencyOverrideDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class ApprovalInboxQueryDto {
  @IsOptional()
  @IsEnum(ApprovalRequestStatus)
  status?: ApprovalRequestStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class ListRulesQueryDto {
  @IsOptional()
  @IsEnum(ApprovalProcessType)
  processType?: ApprovalProcessType;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  activeOnly?: boolean;
}
