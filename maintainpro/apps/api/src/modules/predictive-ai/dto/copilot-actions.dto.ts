import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Priority } from "@prisma/client";
import { IsIn, IsISO8601, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export const WORK_ORDER_TYPES = [
  "PREVENTIVE",
  "CORRECTIVE",
  "EMERGENCY",
  "INSPECTION",
  "INSTALLATION"
] as const;

export const MAINTENANCE_TYPES = ["PREVENTIVE", "PREDICTIVE", "CORRECTIVE", "INSPECTION"] as const;

export const MAINTENANCE_FREQUENCIES = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "BIANNUAL",
  "ANNUAL",
  "MILEAGE_BASED",
  "CUSTOM"
] as const;

export const COPILOT_REPORT_TYPES = [
  "DASHBOARD",
  "MAINTENANCE_COST",
  "FLEET_EFFICIENCY",
  "DOWNTIME",
  "WORK_ORDERS",
  "INVENTORY",
  "UTILITIES"
] as const;

export type CopilotReportType = (typeof COPILOT_REPORT_TYPES)[number];

export class CreateWorkOrderActionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(140)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(1_000)
  description!: string;

  @ApiPropertyOptional({ enum: Priority, default: Priority.MEDIUM })
  @IsOptional()
  @IsIn(Object.values(Priority))
  priority?: Priority;

  @ApiPropertyOptional({ enum: WORK_ORDER_TYPES, default: "CORRECTIVE" })
  @IsOptional()
  @IsIn(WORK_ORDER_TYPES)
  type?: (typeof WORK_ORDER_TYPES)[number];

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
  @IsISO8601()
  dueDate?: string;
}

export class ScheduleMaintenanceActionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(140)
  name!: string;

  @ApiPropertyOptional({ enum: MAINTENANCE_TYPES, default: "PREVENTIVE" })
  @IsOptional()
  @IsIn(MAINTENANCE_TYPES)
  type?: (typeof MAINTENANCE_TYPES)[number];

  @ApiPropertyOptional({ enum: MAINTENANCE_FREQUENCIES, default: "MONTHLY" })
  @IsOptional()
  @IsIn(MAINTENANCE_FREQUENCIES)
  frequency?: (typeof MAINTENANCE_FREQUENCIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

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
  @IsISO8601()
  nextDueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  intervalDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  intervalMileage?: number;
}

export class AssignTechnicianActionDto {
  @ApiProperty()
  @IsString()
  workOrderId!: string;

  @ApiProperty()
  @IsString()
  technicianId!: string;
}

export class GenerateReportActionDto {
  @ApiProperty({ enum: COPILOT_REPORT_TYPES })
  @IsIn(COPILOT_REPORT_TYPES)
  reportType!: CopilotReportType;
}
