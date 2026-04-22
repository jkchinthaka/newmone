import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { AssetCategory, AssetCondition, AssetStatus } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

const assetSortFields = [
  "createdAt",
  "updatedAt",
  "name",
  "assetTag",
  "category",
  "location",
  "status",
  "condition",
  "nextServiceDate",
  "purchaseDate"
] as const;

function toOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}

export class AssetListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: AssetCategory })
  @IsOptional()
  @IsEnum(AssetCategory)
  category?: AssetCategory;

  @ApiPropertyOptional({ enum: AssetStatus })
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @ApiPropertyOptional({ enum: AssetCondition })
  @IsOptional()
  @IsEnum(AssetCondition)
  condition?: AssetCondition;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional({ description: "Return archived items together with active items" })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  includeArchived?: boolean;

  @ApiPropertyOptional({ description: "Only return archived items" })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  archivedOnly?: boolean;

  @ApiPropertyOptional({ enum: assetSortFields })
  @IsOptional()
  @IsIn(assetSortFields)
  sortBy?: (typeof assetSortFields)[number];

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";

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

export class CreateAssetDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  assetTag!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ enum: AssetCategory })
  @IsEnum(AssetCategory)
  category!: AssetCategory;

  @ApiPropertyOptional({ enum: AssetCondition })
  @IsOptional()
  @IsEnum(AssetCondition)
  condition?: AssetCondition;

  @ApiPropertyOptional({ enum: AssetStatus })
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  purchasePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  supplier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  ownerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  meterReading?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  lastServiceDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextServiceDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  warrantyExpiry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  disposalDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  disposalReason?: string;
}

export class UpdateAssetDto extends PartialType(CreateAssetDto) {}

export class AssetTagValidationQueryDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  assetTag!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  excludeId?: string;
}

export class UpdateAssetStatusDto {
  @ApiProperty({ enum: AssetStatus })
  @IsEnum(AssetStatus)
  status!: AssetStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  disposalDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  disposalReason?: string;
}

export class BulkAssetActionDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(250)
  @IsString({ each: true })
  ids!: string[];

  @ApiProperty({ enum: ["UPDATE_STATUS", "ARCHIVE", "RESTORE", "ASSIGN_LOCATION", "ASSIGN_CATEGORY"] })
  @IsIn(["UPDATE_STATUS", "ARCHIVE", "RESTORE", "ASSIGN_LOCATION", "ASSIGN_CATEGORY"])
  action!: "UPDATE_STATUS" | "ARCHIVE" | "RESTORE" | "ASSIGN_LOCATION" | "ASSIGN_CATEGORY";

  @ApiPropertyOptional({ enum: AssetStatus })
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  disposalReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @ApiPropertyOptional({ enum: AssetCategory })
  @IsOptional()
  @IsEnum(AssetCategory)
  category?: AssetCategory;
}

export class BulkImportAssetItemDto extends CreateAssetDto {}

export class BulkImportAssetsDto {
  @ApiProperty({ type: [BulkImportAssetItemDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @Type(() => BulkImportAssetItemDto)
  items!: BulkImportAssetItemDto[];
}

export class AssetExportQueryDto extends AssetListQueryDto {
  @ApiPropertyOptional({ enum: ["csv", "xlsx", "pdf"] })
  @IsOptional()
  @IsIn(["csv", "xlsx", "pdf"])
  format?: "csv" | "xlsx" | "pdf";

  @ApiPropertyOptional({ description: "Comma separated asset ids" })
  @IsOptional()
  @IsString()
  ids?: string;

  @ApiPropertyOptional({ description: "Comma separated visible columns" })
  @IsOptional()
  @IsString()
  visibleColumns?: string;
}

export class QrCodeDownloadQueryDto {
  @ApiPropertyOptional({ enum: ["png", "svg"], default: "png" })
  @IsOptional()
  @IsIn(["png", "svg"])
  format?: "png" | "svg";
}