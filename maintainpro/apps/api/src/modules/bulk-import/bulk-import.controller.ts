import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { memoryStorage } from "multer";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { rowsToCsv } from "../../common/utils/audit-trail.util";
import type { JwtPayload } from "../auth/auth.types";

import { BulkImportAuthService } from "./bulk-import-auth.service";
import { CommitBulkImportDto, PreviewBulkImportBodyDto } from "./dto/bulk-import.dto";
import { BULK_IMPORT_MAX_BYTES } from "./bulk-import.constants";
import { BulkImportService } from "./bulk-import.service";

type AuthedRequest = { user: JwtPayload };

/**
 * Generic master-data bulk import framework — V1 SUPER_ADMIN only.
 * Every handler independently re-verifies the actor's DB role (not just the
 * JWT claim) via BulkImportAuthService, on both preview and commit.
 * See docs/BULK_IMPORT_ARCHITECTURE.md.
 */
@ApiTags("Bulk Import")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("bulk-import")
export class BulkImportController {
  constructor(
    @Inject(BulkImportService) private readonly bulkImportService: BulkImportService,
    @Inject(BulkImportAuthService) private readonly authService: BulkImportAuthService
  ) {}

  @Get()
  @Roles("SUPER_ADMIN")
  async history(
    @Req() req: AuthedRequest,
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string,
    @Query("entity") entity?: string
  ) {
    await this.authService.assertSuperAdmin(req.user?.sub);
    const data = await this.bulkImportService.listHistory(req.user, {
      page: Number(pageRaw ?? 1),
      pageSize: Number(pageSizeRaw ?? 20),
      entity
    });
    return { data: data.items, message: "Bulk import history fetched", meta: data.pagination };
  }

  @Get(":entity/template")
  @Roles("SUPER_ADMIN")
  async template(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Param("entity") entity: string,
    @Query("format") formatRaw?: string
  ) {
    await this.authService.assertSuperAdmin(req.user?.sub);
    const format = formatRaw === "xlsx" ? "xlsx" : "csv";
    const file = await this.bulkImportService.getTemplate(entity, format);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Post(":entity/preview")
  @Roles("SUPER_ADMIN")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: BULK_IMPORT_MAX_BYTES } }))
  async preview(
    @Req() req: AuthedRequest,
    @Param("entity") entity: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: PreviewBulkImportBodyDto
  ) {
    await this.authService.assertSuperAdmin(req.user?.sub);
    const data = await this.bulkImportService.preview(entity, req.user, body.mode, file);
    return { data, message: data.blocked ? "Preview generated — no rows are ready to import" : "Preview generated" };
  }

  @Get(":entity/:importId/errors")
  @Roles("SUPER_ADMIN")
  async errors(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Param("entity") entity: string,
    @Param("importId") importId: string
  ) {
    await this.authService.assertSuperAdmin(req.user?.sub);
    const rows = await this.bulkImportService.getErrorReportRows(entity, importId, req.user);
    const csv = rowsToCsv(["rowNumber", "naturalKey", "field", "inputValue", "errorCode", "message"], rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="bulk-import-${importId}-errors.csv"`);
    res.send(csv);
  }

  @Get(":entity/:importId")
  @Roles("SUPER_ADMIN")
  async getRun(@Req() req: AuthedRequest, @Param("entity") entity: string, @Param("importId") importId: string) {
    await this.authService.assertSuperAdmin(req.user?.sub);
    const data = await this.bulkImportService.getRun(entity, importId, req.user);
    return { data, message: "Import run fetched" };
  }

  @Post(":entity/:importId/commit")
  @Roles("SUPER_ADMIN")
  async commit(
    @Req() req: AuthedRequest,
    @Param("entity") entity: string,
    @Param("importId") importId: string,
    @Body() body: CommitBulkImportDto
  ) {
    await this.authService.assertSuperAdmin(req.user?.sub);
    const data = await this.bulkImportService.commit(entity, importId, req.user, body.confirmed);
    return { data, message: data.message };
  }
}
