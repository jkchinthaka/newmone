import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import {
  DeliveryChecklistCategory,
  DeliveryChecklistPriority,
  DeliveryItemStatus,
  DeliveryReadinessVerdict
} from "@prisma/client";

export class DeliveryListQueryDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() owner?: string;
  @IsOptional() @IsString() requiredForDelivery?: string;
  @IsOptional() @IsString() blocker?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

export class CreateDeliveryChecklistDto {
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsEnum(DeliveryChecklistCategory) category!: DeliveryChecklistCategory;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsEnum(DeliveryChecklistPriority) priority?: DeliveryChecklistPriority;
  @IsOptional() @IsBoolean() requiredForDelivery?: boolean;
}

export class UpdateDeliveryChecklistDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsEnum(DeliveryItemStatus) status?: DeliveryItemStatus;
  @IsOptional() @IsEnum(DeliveryChecklistPriority) priority?: DeliveryChecklistPriority;
  @IsOptional() @IsString() ownerUserId?: string;
  @IsOptional() @IsString() @MaxLength(4000) evidence?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}

export class CreateDeliveryItemDto {
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsEnum(DeliveryChecklistCategory) category!: DeliveryChecklistCategory;
  @IsOptional() @IsBoolean() requiredForDelivery?: boolean;
  @IsOptional() @IsBoolean() blocker?: boolean;
  @IsOptional() @IsBoolean() signOffRequired?: boolean;
}

export class UpdateDeliveryItemDto {
  @IsOptional() @IsEnum(DeliveryItemStatus) status?: DeliveryItemStatus;
  @IsOptional() @IsString() @MaxLength(4000) evidence?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsString() testedRole?: string;
  @IsOptional() @IsString() testedEnvironment?: string;
  @IsOptional() @IsString() deviceSize?: string;
  @IsOptional() @IsInt() @Min(0) responseTimeMs?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) usabilityRating?: number;
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class DeliveryAcceptRiskDto {
  @IsString() @MinLength(10) @MaxLength(2000) reason!: string;
}

export class DeliverySignOffDto {
  @IsOptional() @IsEnum(DeliveryReadinessVerdict) readinessVerdict?: DeliveryReadinessVerdict;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsString() @MaxLength(4000) acceptedRisks?: string;
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class DeliveryCompleteItemDto {
  @IsOptional() @IsString() @MaxLength(4000) evidence?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsString() testedRole?: string;
  @IsOptional() @IsString() testedEnvironment?: string;
  @IsOptional() @IsString() deviceSize?: string;
  @IsOptional() @IsInt() @Min(0) responseTimeMs?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) usabilityRating?: number;
}

export class DeliveryFailItemDto {
  @IsString() @MinLength(10) @MaxLength(2000) reason!: string;
  @IsOptional() @IsBoolean() blocker?: boolean;
  @IsOptional() @IsString() @MaxLength(4000) evidence?: string;
}
