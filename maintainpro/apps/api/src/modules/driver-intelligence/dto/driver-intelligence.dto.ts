import { ApiPropertyOptional } from "@nestjs/swagger";
import { DriverTrainingStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export const DRIVER_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type DriverRiskLevel = (typeof DRIVER_RISK_LEVELS)[number];

const DRIVER_INTELLIGENCE_SORT_FIELDS = ["score", "riskLevel", "name", "eligibility"] as const;
const RANKING_PERIODS = ["monthly", "annual", "custom"] as const;

export class IntelligenceFiltersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

export class DriverIntelligenceListQueryDto extends IntelligenceFiltersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: DRIVER_RISK_LEVELS })
  @IsOptional()
  @IsIn(DRIVER_RISK_LEVELS)
  riskLevel?: DriverRiskLevel;

  @ApiPropertyOptional({ enum: DRIVER_INTELLIGENCE_SORT_FIELDS })
  @IsOptional()
  @IsIn(DRIVER_INTELLIGENCE_SORT_FIELDS)
  sortBy?: (typeof DRIVER_INTELLIGENCE_SORT_FIELDS)[number];

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDirection?: "asc" | "desc";

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
  @Max(100)
  pageSize?: number;
}

export class BestDriversQueryDto extends IntelligenceFiltersDto {
  @ApiPropertyOptional({ enum: RANKING_PERIODS, default: "monthly" })
  @IsOptional()
  @IsIn(RANKING_PERIODS)
  period?: (typeof RANKING_PERIODS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2024)
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class UpdateDriverIntelligenceInputsDto {
  @ApiPropertyOptional({ enum: DriverTrainingStatus })
  @IsOptional()
  @IsEnum(DriverTrainingStatus)
  trainingStatus?: DriverTrainingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  trainingCompletedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  trainingExpiry?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  supervisorReviewScore?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  pendingDisciplinaryIssues?: number;
}