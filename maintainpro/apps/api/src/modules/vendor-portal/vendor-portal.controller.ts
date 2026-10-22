import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import type { JwtPayload } from "../auth/auth.types";
import { VendorPortalService } from "./vendor-portal.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Vendor Portal")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("vendor-portal")
export class VendorPortalController {
  constructor(private readonly portal: VendorPortalService) {}

  @Post("access")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  @Permissions("vendor.manage")
  async grant(@Req() req: AuthedRequest, @Body() body: { supplierId?: string; userId?: string }) {
    if (!body.supplierId || !body.userId) {
      throw new BadRequestException("supplierId and userId are required");
    }
    const data = await this.portal.grantAccess(req.user, {
      supplierId: body.supplierId,
      userId: body.userId
    });
    return { data, message: "Vendor portal access granted" };
  }

  @Get("jobs")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VENDOR", "TECHNICIAN", "VIEWER")
  @Permissions("vendor.portal")
  async listJobs(@Req() req: AuthedRequest) {
    const data = await this.portal.listAssignedJobs(req.user);
    return { data, message: "Assigned vendor jobs" };
  }

  @Get("jobs/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VENDOR", "TECHNICIAN", "VIEWER")
  @Permissions("vendor.portal")
  async getJob(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.portal.getAssignedJob(req.user, id);
    return { data, message: "Vendor job" };
  }

  @Post("jobs/:id/quotations")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VENDOR")
  @Permissions("vendor.portal")
  async quote(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    if (!body.quotationNo || body.quotedAmount == null) {
      throw new BadRequestException("quotationNo and quotedAmount required");
    }
    const data = await this.portal.uploadQuotation(req.user, id, {
      quotationNo: String(body.quotationNo),
      quotedAmount: Number(body.quotedAmount),
      currency: body.currency ? String(body.currency) : undefined,
      validityDate: body.validityDate ? String(body.validityDate) : undefined
    });
    return { data, message: "Quotation submitted" };
  }

  @Patch("jobs/:id/progress")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VENDOR")
  @Permissions("vendor.portal")
  async progress(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { status?: string; note?: string }
  ) {
    if (!body.status) throw new BadRequestException("status required");
    const data = await this.portal.updateProgress(req.user, id, {
      status: body.status,
      note: body.note
    });
    return { data, message: "Progress updated" };
  }
}
