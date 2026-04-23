import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { CleaningFrequencyUnit, CleaningShift } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

export class ChecklistTemplateItemDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class CreateCleaningLocationDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  area!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  building?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  floor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: "Cron expression for recurring schedule" })
  @IsOptional()
  @IsString()
  scheduleCron?: string;

  @ApiPropertyOptional({ description: "Shift window e.g. 06:00-14:00" })
  @IsOptional()
  @IsString()
  shiftWindow?: string;

  @ApiPropertyOptional({ description: "How many cleanings are expected per period", default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  cleaningFrequency?: number;

  @ApiPropertyOptional({ enum: CleaningFrequencyUnit, default: CleaningFrequencyUnit.PER_DAY })
  @IsOptional()
  @IsEnum(CleaningFrequencyUnit)
  cleaningFrequencyUnit?: CleaningFrequencyUnit;

  @ApiPropertyOptional({ enum: CleaningShift, default: CleaningShift.MORNING })
  @IsOptional()
  @IsEnum(CleaningShift)
  shiftAssignment?: CleaningShift;

  @ApiPropertyOptional({ description: "Assigned cleaner user id" })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  assignedCleanerId?: string;

  @ApiPropertyOptional({ description: "Location latitude for geofence" })
  @IsOptional()
  @IsLatitude()
  geoLatitude?: number;

  @ApiPropertyOptional({ description: "Location longitude for geofence" })
  @IsOptional()
  @IsLongitude()
  geoLongitude?: number;

  @ApiPropertyOptional({ description: "Allowed scan radius around location in meters", default: 150 })
  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(5000)
  geoRadiusMeters?: number;

  @ApiPropertyOptional({ description: "Require a stable device identifier while scanning", default: false })
  @IsOptional()
  @IsBoolean()
  requireDeviceValidation?: boolean;

  @ApiPropertyOptional({ description: "Require photo evidence on visit submission", default: false })
  @IsOptional()
  @IsBoolean()
  requirePhotoEvidence?: boolean;

  @ApiPropertyOptional({
    type: [ChecklistTemplateItemDto],
    description: "Initial checklist items for this location"
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistTemplateItemDto)
  checklistItems?: ChecklistTemplateItemDto[];
}

export class UpdateCleaningLocationDto extends PartialType(CreateCleaningLocationDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
