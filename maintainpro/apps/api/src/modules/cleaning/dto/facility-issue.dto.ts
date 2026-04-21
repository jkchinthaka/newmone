import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IssueSeverity, FacilityIssueStatus } from "@prisma/client";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
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
}
