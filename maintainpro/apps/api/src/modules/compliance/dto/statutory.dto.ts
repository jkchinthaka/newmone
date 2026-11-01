import { Type } from "class-transformer";
import { IsDate, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from "class-validator";

export class CreateStatutoryCertificateDto {
  @IsString()
  @MaxLength(36)
  assetId!: string;

  @IsString()
  @MaxLength(64)
  typeKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  issuedAt?: Date;

  @Type(() => Date)
  @IsDate()
  expiresAt!: Date;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  reminderDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  providerName?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  certificateUrl?: string;
}

export class RenewStatutoryCertificateDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  issuedAt?: Date;

  @Type(() => Date)
  @IsDate()
  expiresAt!: Date;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  providerName?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  certificateUrl?: string;
}
