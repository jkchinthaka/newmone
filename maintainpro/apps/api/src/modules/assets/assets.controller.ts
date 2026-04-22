import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
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
import { memoryStorage } from "multer";
import type { Response } from "express";

import {
  AssetTagValidationQueryDto,
  AssetExportQueryDto,
  AssetListQueryDto,
  BulkAssetActionDto,
  BulkImportAssetsDto,
  CreateAssetDto,
  QrCodeDownloadQueryDto,
  UpdateAssetDto,
  UpdateAssetStatusDto
} from "./dto/assets.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AssetsService } from "./assets.service";

interface AuthedRequest {
  user?: { sub: string; role: string; tenantId?: string | null };
}

const ASSET_READ_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "ASSET_MANAGER",
  "SUPERVISOR",
  "MECHANIC",
  "VIEWER"
] as const;

const ASSET_WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER"] as const;
const ASSET_DELETE_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

@ApiTags("Assets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("assets")
export class AssetsController {
  constructor(@Inject(AssetsService) private readonly assetsService: AssetsService) {}

  @Get("summary")
  @Roles(...ASSET_READ_ROLES)
  async summary(@Req() req: AuthedRequest, @Query() query: AssetListQueryDto) {
    const data = await this.assetsService.summary(req.user?.tenantId ?? null, query);
    return { data, message: "Asset summary fetched" };
  }

  @Get("filter-options")
  @Roles(...ASSET_READ_ROLES)
  async filterOptions(@Req() req: AuthedRequest) {
    const data = await this.assetsService.filterOptions(req.user?.tenantId ?? null);
    return { data, message: "Asset filter options fetched" };
  }

  @Get("validate-tag")
  @Roles(...ASSET_READ_ROLES)
  async validateTag(@Req() req: AuthedRequest, @Query() query: AssetTagValidationQueryDto) {
    const data = await this.assetsService.validateAssetTag(
      req.user?.tenantId ?? null,
      query.assetTag,
      query.excludeId
    );
    return { data, message: "Asset tag validation complete" };
  }

  @Get("export")
  @Roles(...ASSET_READ_ROLES)
  async export(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Query() query: AssetExportQueryDto
  ) {
    const file = await this.assetsService.exportAssets(req.user?.tenantId ?? null, query);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Get()
  @Roles(...ASSET_READ_ROLES)
  async findAll(@Req() req: AuthedRequest, @Query() query: AssetListQueryDto) {
    const result = await this.assetsService.findAll(req.user?.tenantId ?? null, query);
    return { data: result.items, meta: result.meta, message: "Assets fetched" };
  }

  @Post()
  @Roles(...ASSET_WRITE_ROLES)
  async create(@Req() req: AuthedRequest, @Body() body: CreateAssetDto) {
    const data = await this.assetsService.create(req.user?.tenantId ?? null, req.user!.sub, body);
    return { data, message: "Asset created" };
  }

  @Post("bulk-import")
  @Roles(...ASSET_WRITE_ROLES)
  async bulkImport(@Req() req: AuthedRequest, @Body() body: BulkImportAssetsDto) {
    const data = await this.assetsService.bulkImport(
      req.user?.tenantId ?? null,
      req.user!.sub,
      body.items ?? []
    );
    return { data, message: "Bulk import complete" };
  }

  @Post("bulk-action")
  @Roles(...ASSET_WRITE_ROLES)
  async bulkAction(@Req() req: AuthedRequest, @Body() body: BulkAssetActionDto) {
    const data = await this.assetsService.bulkAction(req.user?.tenantId ?? null, req.user!.sub, body);
    return { data, message: "Bulk asset action complete" };
  }

  @Get(":id")
  @Roles(...ASSET_READ_ROLES)
  async findOne(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.assetsService.findOne(id, req.user?.tenantId ?? null);
    return { data, message: "Asset fetched" };
  }

  @Patch(":id")
  @Roles(...ASSET_WRITE_ROLES)
  async update(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: UpdateAssetDto
  ) {
    const data = await this.assetsService.update(id, req.user?.tenantId ?? null, req.user!.sub, body);
    return { data, message: "Asset updated" };
  }

  @Patch(":id/status")
  @Roles(...ASSET_WRITE_ROLES)
  async updateStatus(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: UpdateAssetStatusDto
  ) {
    const data = await this.assetsService.updateStatus(
      id,
      req.user?.tenantId ?? null,
      req.user!.sub,
      body
    );
    return { data, message: "Asset status updated" };
  }

  @Delete(":id")
  @Roles(...ASSET_DELETE_ROLES)
  async remove(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Query("permanent") permanent?: string
  ) {
    const shouldDeletePermanently = ["true", "1", "yes"].includes(
      (permanent ?? "").toLowerCase()
    );
    const data = await this.assetsService.remove(
      id,
      req.user?.tenantId ?? null,
      req.user!.sub,
      shouldDeletePermanently
    );
    return {
      data,
      message: shouldDeletePermanently ? "Asset deleted" : "Asset archived"
    };
  }

  @Post(":id/restore")
  @Roles(...ASSET_WRITE_ROLES)
  async restore(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.assetsService.restore(id, req.user?.tenantId ?? null, req.user!.sub);
    return { data, message: "Asset restored" };
  }

  @Get(":id/qr-code")
  @Roles(...ASSET_READ_ROLES)
  async getQrCode(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.assetsService.getQrCode(id, req.user?.tenantId ?? null);
    return { data, message: "Asset QR fetched" };
  }

  @Get(":id/qr-code/download")
  @Roles(...ASSET_READ_ROLES)
  async downloadQr(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Query() query: QrCodeDownloadQueryDto,
    @Res() res: Response
  ) {
    const file = await this.assetsService.getQrCodeFile(
      id,
      req.user?.tenantId ?? null,
      query.format ?? "png"
    );
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Post(":id/qr-code/regenerate")
  @Roles(...ASSET_WRITE_ROLES)
  async regenerateQrCode(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.assetsService.regenerateQrCode(id, req.user?.tenantId ?? null, req.user!.sub);
    return { data, message: "Asset QR regenerated" };
  }

  @Get(":id/maintenance-history")
  @Roles(...ASSET_READ_ROLES)
  async maintenanceHistory(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.assetsService.maintenanceHistory(id, req.user?.tenantId ?? null);
    return { data, message: "Maintenance history fetched" };
  }

  @Post(":id/documents")
  @Roles(...ASSET_WRITE_ROLES)
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024
      }
    })
  )
  async uploadDocument(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    const data = await this.assetsService.uploadDocument(
      id,
      req.user?.tenantId ?? null,
      req.user!.sub,
      file
    );
    return { data, message: "Asset document uploaded" };
  }

  @Get(":id/documents/:documentId")
  @Roles(...ASSET_READ_ROLES)
  async downloadDocument(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("documentId") documentId: string,
    @Res() res: Response
  ) {
    const file = await this.assetsService.downloadDocument(
      id,
      req.user?.tenantId ?? null,
      documentId
    );
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Delete(":id/documents/:documentId")
  @Roles(...ASSET_WRITE_ROLES)
  async deleteDocument(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("documentId") documentId: string
  ) {
    const data = await this.assetsService.deleteDocument(
      id,
      req.user?.tenantId ?? null,
      req.user!.sub,
      documentId
    );
    return { data, message: "Asset document deleted" };
  }
}
