import { Controller, Get, Inject, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { Roles } from "../../common/decorators/roles.decorator";
import { TenantScoped } from "../../common/decorators/tenant-scope.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import type { JwtPayload } from "../auth/auth.types";
import { ProofPhotoService } from "./proof-photo.service";

/** Opens a proof photo (fuel receipt, meter photo, GRN) of the caller's own company. */
@ApiTags("Proof photos")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@TenantScoped()
@Controller("proof-photos")
export class ProofPhotoController {
  constructor(@Inject(ProofPhotoService) private readonly photos: ProofPhotoService) {}

  @Get()
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "OPERATIONS_MANAGER",
    "SUPERVISOR",
    "ASSET_MANAGER",
    "FLEET_MANAGER",
    "INVENTORY_KEEPER",
    "FINANCE",
    "TECHNICIAN",
    "MECHANIC",
    "DRIVER"
  )
  async open(@Req() req: { user: JwtPayload }, @Query("key") key: string, @Res() res: Response) {
    const photo = await this.photos.read(requireTenantId(req.user.tenantId), String(key ?? ""));
    res.setHeader("Content-Type", photo.contentType);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(photo.bytes);
  }
}
