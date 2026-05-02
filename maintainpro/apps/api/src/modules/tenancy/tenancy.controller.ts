import { Controller, Get, Param, Post, Req, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { TenancyService } from "./tenancy.service";

type AuthenticatedRequest = {
  user: {
    sub: string;
    tenantId?: string | null;
  };
};

@ApiTags("Tenancy")
@ApiBearerAuth()
@Controller("tenants")
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Get("me")
  async me(@Req() req: AuthenticatedRequest) {
    const data = await this.tenancyService.getMyTenants(req.user.sub, req.user.tenantId ?? null);
    return {
      data,
      message: "Tenant context fetched"
    };
  }

  @Post(":id/switch")
  async switchTenant(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response
  ) {
    const data = await this.tenancyService.switchTenant(req.user.sub, id);
    this.setAccessCookie(res, data.accessToken);
    return {
      data,
      message: "Tenant switched"
    };
  }

  private setAccessCookie(res: Response, accessToken: string): void {
    res.cookie("maintainpro_access", accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 15 * 60 * 1000
    });
  }
}
