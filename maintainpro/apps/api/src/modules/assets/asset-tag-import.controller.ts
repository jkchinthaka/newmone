import { Body, Controller, Get, Inject, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { memoryStorage } from "multer";

import { Roles } from "../../common/decorators/roles.decorator";
import { TenantScoped } from "../../common/decorators/tenant-scope.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { AssetTagImportService } from "./asset-tag-import.service";

type AuthedRequest = { user?: JwtPayload };

@ApiTags("Asset tags")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles("SUPER_ADMIN", "ADMIN")
@TenantScoped()
@Controller("admin/asset-tags")
export class AssetTagImportController {
  constructor(@Inject(AssetTagImportService) private readonly assetTagImportService: AssetTagImportService) {}

  @Get("template.csv")
  templateCsv(@Res() res: Response) {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"asset-tag-template.csv\"");
    res.send(this.assetTagImportService.templateCsv());
  }

  @Get("template.xlsx")
  async templateXlsx(@Res() res: Response) {
    const buffer = await this.assetTagImportService.templateXlsx();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"asset-tag-template.xlsx\"");
    res.send(buffer);
  }

  @Post("preview")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage() }))
  async preview(@Req() req: AuthedRequest, @UploadedFile() file?: { originalname?: string; buffer: Buffer }) {
    if (!file?.buffer) return { data: [], message: "Choose a CSV or XLSX file." };
    const data = await this.assetTagImportService.preview(req.user?.tenantId ?? null, file);
    return { data, message: "Asset tag preview ready" };
  }

  @Post("apply")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage() }))
  async apply(
    @Req() req: AuthedRequest,
    @UploadedFile() file?: { originalname?: string; buffer: Buffer },
    @Body() body?: { allowReplace?: string | boolean; replaceReason?: string }
  ) {
    if (!file?.buffer) return { data: { applied: [], invalid: [] }, message: "Choose a CSV or XLSX file." };
    const data = await this.assetTagImportService.apply(req.user?.tenantId ?? null, req.user?.sub ?? "", file, {
      allowReplace: body?.allowReplace === true || body?.allowReplace === "true",
      replaceReason: body?.replaceReason,
      actorEmail: req.user?.sub
    });
    return { data, message: "Asset tags applied" };
  }
}
