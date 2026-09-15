import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { AssetAttributeDataType, AssetCategory } from "@prisma/client";
import { Transform, Type } from "class-transformer";

function toOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const n = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(n)) return true;
    if (["false", "0", "no"].includes(n)) return false;
  }
  return undefined;
}

export class TaxonomyListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  includeInactive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  domainId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  typeMasterId?: string;
}

export class CreateAssetDomainDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateAssetDomainDto extends PartialType(CreateAssetDomainDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateAssetCategoryMasterDto {
  @ApiProperty()
  @IsString()
  domainId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: AssetCategory })
  @IsOptional()
  @IsEnum(AssetCategory)
  legacyEnum?: AssetCategory;
}

export class UpdateAssetCategoryMasterDto extends PartialType(CreateAssetCategoryMasterDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateAssetTypeMasterDto {
  @ApiProperty()
  @IsString()
  categoryId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateAssetTypeMasterDto extends PartialType(CreateAssetTypeMasterDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateAttributeDefinitionDto {
  @ApiProperty()
  @IsString()
  typeMasterId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  key!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @ApiProperty({ enum: AssetAttributeDataType })
  @IsEnum(AssetAttributeDataType)
  dataType!: AssetAttributeDataType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  options?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateAttributeDefinitionDto extends PartialType(CreateAttributeDefinitionDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
