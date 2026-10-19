import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
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
  @IsIn(["APPROVED", "REJECTED", "RETURNED"])
  decision!: "APPROVED" | "REJECTED" | "RETURNED";

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  expectedVersion?: number;
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
  @IsString()
  tab?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

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

export class InboxDecisionDto {
  @IsString()
  id!: string;

  @IsIn(["approval", "request", "part", "vendor_quotation", "vendor_invoice", "emergency"])
  kind!: "approval" | "request" | "part" | "vendor_quotation" | "vendor_invoice" | "emergency";

  @IsIn(["APPROVED", "REJECTED", "RETURNED"])
  decision!: "APPROVED" | "REJECTED" | "RETURNED";

  @IsOptional()
  @IsString()
  reason?: string;

  @IsNumber()
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  workOrderId?: string;
}

export class BulkApproveItemDto {
  @IsString()
  id!: string;

  @IsIn(["approval", "request", "part", "vendor_quotation", "vendor_invoice", "emergency"])
  kind!: "approval" | "request" | "part" | "vendor_quotation" | "vendor_invoice" | "emergency";

  @IsNumber()
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  workOrderId?: string;
}

export class BulkApproveDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkApproveItemDto)
  items!: BulkApproveItemDto[];
}
