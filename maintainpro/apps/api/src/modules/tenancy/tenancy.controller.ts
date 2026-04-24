import { Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

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
  async switchTenant(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    const data = await this.tenancyService.switchTenant(req.user.sub, id);
    return {
      data,
      message: "Tenant switched"
    };
  }
}
