import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";

export class StartCleaningVisitDto {
  @ApiProperty({ description: "QR code value scanned at the location" })
  @IsString()
  @MinLength(4)
  qrCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  beforePhotos?: string[];
}

export class ChecklistItemSubmissionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  label!: string;

  @ApiProperty()
  @IsBoolean()
  checked!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class SubmitCleaningVisitDto {
  @ApiProperty({ type: [ChecklistItemSubmissionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemSubmissionDto)
  checklist!: ChecklistItemSubmissionDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  afterPhotos?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class SignOffVisitDto {
  @ApiProperty({ description: "true=approve, false=reject" })
  @IsBoolean()
  approve!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ description: "Required when rejecting" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
