import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength
} from "class-validator";
import { ErpAccessChecklistStatus, ErpImportType, ErpReconciliationMismatchStatus } from "@prisma/client";

export class CreateErpMappingDto {
  @IsOptional()
  @IsString()
  sourceSystem?: string;

  @IsString()
  @IsNotEmpty()
  sourceField!: string;

  @IsString()
  @IsNotEmpty()
  targetModel!: string;

  @IsString()
  @IsNotEmpty()
  targetField!: string;

  @IsOptional()
  @IsString()
  transformRule?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateErpMappingDto {
  @IsOptional()
  @IsString()
  transformRule?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateImportBatchDto {
  @IsEnum(ErpImportType)
  importType!: ErpImportType;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsString()
  @MinLength(1)
  csvContent!: string;
}

export class ImportActionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReconciliationActionDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  correctedValue?: string;
}

export class UpdateAccessChecklistDto {
  @IsEnum(ErpAccessChecklistStatus)
  status!: ErpAccessChecklistStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ErpListQueryDto {
  @IsOptional()
  @IsString()
  reportType?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class MockSyncDto {
  @IsOptional()
  @IsArray()
  entityTypes?: string[];
}
