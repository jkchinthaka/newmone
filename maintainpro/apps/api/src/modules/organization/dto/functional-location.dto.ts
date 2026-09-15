import { IsBoolean, IsEnum, IsMongoId, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { FunctionalLocationType } from "@prisma/client";

export class CreateFunctionalLocationDto {
  @IsMongoId()
  siteId!: string;

  @IsOptional()
  @IsMongoId()
  parentId?: string | null;

  @IsOptional()
  @IsMongoId()
  departmentId?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(96)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsEnum(FunctionalLocationType)
  type!: FunctionalLocationType;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateFunctionalLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(96)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(FunctionalLocationType)
  type?: FunctionalLocationType;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsMongoId()
  departmentId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class MoveFunctionalLocationDto {
  @IsOptional()
  @IsMongoId()
  parentId?: string | null;

  @IsOptional()
  @IsMongoId()
  siteId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
