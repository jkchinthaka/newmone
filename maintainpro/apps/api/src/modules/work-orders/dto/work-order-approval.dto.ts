import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ApproveWorkOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RejectWorkOrderDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class SubmitWorkOrderForApprovalDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
