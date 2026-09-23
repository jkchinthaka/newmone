import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Priority, RequestRejectionReasonType } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

function toOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const n = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(n)) return true;
    if (["false", "0", "no"].includes(n)) return false;
  }
  return undefined;
}

export const REPORTED_URGENCY_VALUES = ["NORMAL", "URGENT", "VERY_URGENT"] as const;
export type ReportedUrgency = (typeof REPORTED_URGENCY_VALUES)[number];

export const SAFETY_IMPACT_VALUES = ["NO", "YES", "NOT_SURE"] as const;
export type SafetyImpact = (typeof SAFETY_IMPACT_VALUES)[number];

export const PRODUCTION_IMPACT_VALUES = ["NONE", "REDUCED", "STOPPED", "NOT_SURE"] as const;
export type ProductionImpact = (typeof PRODUCTION_IMPACT_VALUES)[number];

export class MaintenanceRequestListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  functionalLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  domainId?: string;

  @ApiPropertyOptional({ description: "MACHINERY | SERVICE | VEHICLE" })
  @IsOptional()
  @IsString()
  jobDomain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reportedById?: string;

  @ApiPropertyOptional({ description: "Only requests owned by the caller" })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  mine?: boolean;

  @ApiPropertyOptional({ description: "Supervisor triage queue (active statuses)" })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  triageQueue?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class CreateMaintenanceRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  functionalLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  domainId?: string;

  @ApiPropertyOptional({
    description: "When true, requester does not know the canonical target (Not Sure)"
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  targetUnresolved?: boolean;

  @ApiPropertyOptional({ description: "Approximate area/location when target is unresolved" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  approximateLocation?: string;

  @ApiPropertyOptional({ description: "MACHINERY | SERVICE | VEHICLE — ignored unless triage-confirmed" })
  @IsOptional()
  @IsString()
  jobDomain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  problemCategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  problemCategoryLabel?: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional({
    enum: REPORTED_URGENCY_VALUES,
    description: "Requester urgency — not the official maintenance priority"
  })
  @IsOptional()
  @IsIn([...REPORTED_URGENCY_VALUES])
  reportedUrgency?: ReportedUrgency;

  @ApiPropertyOptional({ enum: SAFETY_IMPACT_VALUES })
  @IsOptional()
  @IsIn([...SAFETY_IMPACT_VALUES])
  safetyImpact?: SafetyImpact;

  @ApiPropertyOptional({ enum: PRODUCTION_IMPACT_VALUES })
  @IsOptional()
  @IsIn([...PRODUCTION_IMPACT_VALUES])
  productionImpact?: ProductionImpact;

  /** @deprecated Prefer reportedUrgency — ignored for official priority authorship */
  @ApiPropertyOptional({ enum: Priority, deprecated: true })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  affectsOperation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  businessImpact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isEmergency?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  failureNoticedAt?: string;

  @ApiPropertyOptional({ description: "Client idempotency key for offline/PWA retries" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  evidenceIds?: string[];
}

export class TriageMaintenanceRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  functionalLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  domainId?: string;

  @ApiPropertyOptional({ description: "MACHINERY | SERVICE | VEHICLE" })
  @IsOptional()
  @IsString()
  jobDomain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  targetUnresolved?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  problemCategoryId?: string;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isEmergency?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  triageNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  publicUpdateNote?: string;

  @ApiPropertyOptional({
    description: "Required when changing official priority in a material way"
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RejectMaintenanceRequestDto {
  @ApiProperty({ enum: RequestRejectionReasonType })
  @IsEnum(RequestRejectionReasonType)
  reasonType!: RequestRejectionReasonType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason?: string;
}

export class CancelMaintenanceRequestDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class MarkDuplicateDto {
  @ApiProperty()
  @IsString()
  canonicalRequestId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class ConvertToWorkOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class RequestInformationDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  question!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  publicNote?: string;
}

export class RequesterRespondDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  response!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  evidenceIds?: string[];
}

export class ResumeReviewDto {
  @ApiPropertyOptional({
    description: "Internal resume note only — not a substitute for requester response"
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
