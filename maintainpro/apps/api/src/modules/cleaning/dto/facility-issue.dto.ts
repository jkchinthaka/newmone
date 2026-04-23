import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IssueSeverity, FacilityIssueStatus } from "@prisma/client";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

export class CreateFacilityIssueDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  description!: string;

  @ApiPropertyOptional({ enum: IssueSeverity })
  @IsOptional()
  @IsEnum(IssueSeverity)
  severity?: IssueSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  photos?: string[];

  @ApiPropertyOptional({ description: "Assign issue to a staff member" })
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional({ description: "SLA target in hours from creation", default: 24 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  slaHours?: number;
}

export class UpdateFacilityIssueDto {
  @ApiPropertyOptional({ enum: FacilityIssueStatus })
  @IsOptional()
  @IsEnum(FacilityIssueStatus)
  status?: FacilityIssueStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolution?: string;

  @ApiPropertyOptional({ description: "Assign issue to a staff member" })
  @IsOptional()
  @IsString()
  assignedToId?: string;
}
