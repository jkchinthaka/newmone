import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

const OBJECT_ID = /^([0-9a-fA-F]{24})$/;

export class CreatePurchaseOrderLineDto {
  @IsOptional()
  @IsString()
  @Matches(OBJECT_ID)
  partId?: string;

  @IsOptional()
  @IsString()
  @Matches(OBJECT_ID)
  partRequestId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  poNumber!: string;

  @IsString()
  @Matches(OBJECT_ID)
  supplierId!: string;

  @IsString()
  orderDate!: string;

  @IsOptional()
  @IsString()
  expectedDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  pettyCash?: boolean;

  @IsOptional()
  @IsBoolean()
  emergencyOverride?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  emergencyOverrideReason?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  lines!: CreatePurchaseOrderLineDto[];
}

export class ApprovePurchaseOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  emergencyOverrideReason?: string;
}

export class RejectPurchaseOrderDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class SyncPurchaseOrderDto {
  @IsOptional()
  @IsBoolean()
  forceFailure?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;

  @IsOptional()
  @IsBoolean()
  forceResync?: boolean;
}

export class RetryPurchaseOrderSyncDto {
  @IsOptional()
  @IsBoolean()
  forceFailure?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;

  @IsOptional()
  @IsBoolean()
  overrideRetryWindow?: boolean;
}

export class CreatePurchaseReceiptLineDto {
  @IsString()
  @Matches(OBJECT_ID)
  purchaseOrderLineId!: string;

  @IsNumber()
  @Min(0)
  acceptedQuantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rejectedQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}

export class CreatePurchaseReceiptDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  receiptNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  supplierDeliveryNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseReceiptLineDto)
  lines!: CreatePurchaseReceiptLineDto[];
}
