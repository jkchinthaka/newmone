import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { FloorPlansService } from "./floor-plans.service";

type AuthedRequest = { user: JwtPayload };
const READ = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "SUPERVISOR", "MECHANIC", "TECHNICIAN", "VIEWER"] as const;
const MANAGE = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER"] as const;

@ApiTags("Floor plans")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("floor-plans")
export class FloorPlansController {
  constructor(private readonly service: FloorPlansService) {}

  @Get()
  @Roles(...READ)
  async list(@Req() req: AuthedRequest, @Query("q") q?: string) {
    return { data: await this.service.list(req.user?.tenantId ?? null, q), message: "Floor plans fetched" };
  }

  @Get(":id")
  @Roles(...READ)
  async get(@Req() req: AuthedRequest, @Param("id") id: string) {
    return { data: await this.service.get(req.user?.tenantId ?? null, id), message: "Floor plan fetched" };
  }

  @Post()
  @Roles(...MANAGE)
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } }))
  async create(@Req() req: AuthedRequest, @Body() body: { name?: string; siteId?: string }, @UploadedFile() file?: Express.Multer.File) {
    return { data: await this.service.create(req.user?.tenantId ?? null, body, file), message: "Floor plan created" };
  }

  @Patch(":id")
  @Roles(...MANAGE)
  async rename(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { name: string }) {
    return { data: await this.service.rename(req.user?.tenantId ?? null, id, body.name), message: "Floor plan renamed" };
  }

  @Delete(":id")
  @Roles(...MANAGE)
  async remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return { data: await this.service.remove(req.user?.tenantId ?? null, id), message: "Floor plan removed" };
  }

  @Post(":id/pins")
  @Roles(...MANAGE)
  async setPin(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { assetId?: string; x?: number; y?: number }) {
    return { data: await this.service.setPin(req.user?.tenantId ?? null, id, body), message: "Pin saved" };
  }

  @Delete(":id/pins/:pinId")
  @Roles(...MANAGE)
  async removePin(@Req() req: AuthedRequest, @Param("id") id: string, @Param("pinId") pinId: string) {
    return { data: await this.service.removePin(req.user?.tenantId ?? null, id, pinId), message: "Pin removed" };
  }
}
