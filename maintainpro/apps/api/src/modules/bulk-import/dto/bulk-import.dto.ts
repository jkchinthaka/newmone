import { ApiPropertyOptional } from "@nestjs/swagger";
import { BulkImportMode } from "@prisma/client";
import { IsBoolean, IsEnum, IsOptional } from "class-validator";

export class PreviewBulkImportBodyDto {
  @ApiPropertyOptional({ enum: BulkImportMode, default: BulkImportMode.CREATE_NEW_SKIP_EXISTING })
  @IsOptional()
  @IsEnum(BulkImportMode)
  mode?: BulkImportMode;
}

export class CommitBulkImportDto {
  @ApiPropertyOptional({
    description: "Must be explicitly true to commit. Server-side state (rows, actions, tenant, actor) is always re-verified — this flag only records the operator's confirmation click."
  })
  @IsBoolean()
  confirmed!: boolean;
}
