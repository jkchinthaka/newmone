import { Body, Controller, Get, Inject, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { memoryStorage } from "multer";

import { Roles } from "../../common/decorators/roles.decorator";
import { TenantScoped } from "../../common/decorators/tenant-scope.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { AssetRegisterImportService } from "./asset-register-import.service";
import { AssetsService } from "./assets.service";

type AuthedRequest = { user: JwtPayload };
type RowsUpload = { buffer?: Buffer; size?: number } | undefined;

/** The rows file the browser builds from the Excel sheet (JSON). Up to 2,000 assets ≈ 2 MB. */
const ROWS_FILE_MAX_BYTES = 6 * 1024 * 1024;

function rowsFromUpload(file: RowsUpload, body: { rows?: unknown }): unknown {
  if (file?.buffer?.length) {
    try {
      return JSON.parse(file.buffer.toString("utf8"));
    } catch {
      return null;
    }
  }
  return typeof body?.rows === "string" ? JSON.parse(body.rows) : body?.rows;
}

const flag = (value: unknown) => value === true || value === "true";

/** Add many assets from Excel (Admin, Super Admin): template, preview, save in parts, QR labels. */
@ApiTags("Asset register import")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles("SUPER_ADMIN", "ADMIN")
@TenantScoped()
@Controller("admin/asset-register")
export class AssetRegisterImportController {
  constructor(
    @Inject(AssetRegisterImportService) private readonly imports: AssetRegisterImportService,
    @Inject(AssetsService) private readonly assets: AssetsService
  ) {}

  @Get("template.xlsx")
  async template(@Req() req: AuthedRequest, @Res() res: Response) {
    const buffer = await this.imports.template(req.user);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"asset-register-template.xlsx\"");
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  }

  @Post("preview")
  @UseInterceptors(FileInterceptor("rows", { storage: memoryStorage(), limits: { fileSize: ROWS_FILE_MAX_BYTES } }))
  async preview(@Req() req: AuthedRequest, @UploadedFile() file: RowsUpload, @Body() body: { rows?: unknown; updateExisting?: unknown }) {
    const data = await this.imports.preview(req.user, rowsFromUpload(file, body), { updateExisting: flag(body?.updateExisting) });
    return { data, message: "Asset file checked" };
  }

  @Post("save")
  @UseInterceptors(FileInterceptor("rows", { storage: memoryStorage(), limits: { fileSize: ROWS_FILE_MAX_BYTES } }))
  async save(@Req() req: AuthedRequest, @UploadedFile() file: RowsUpload, @Body() body: { rows?: unknown; updateExisting?: unknown }) {
    const data = await this.imports.save(req.user, rowsFromUpload(file, body), { updateExisting: flag(body?.updateExisting) });
    return { data, message: "Assets saved" };
  }

  @Post("qr-labels")
  async qrLabels(@Req() req: AuthedRequest, @Body() body: { ids?: unknown }) {
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [];
    const data = await this.assets.qrLabels(req.user.tenantId, ids);
    return { data, message: "QR labels" };
  }
}
