import { Controller, ForbiddenException, Get, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { EntitlementsService } from "./entitlements.service";

type EntitlementsRequest = {
  user: {
    tenantId?: string | null;
  };
  tenantId?: string | null;
};

@ApiTags("Entitlements")
@ApiBearerAuth()
@Controller("entitlements")
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get("me")
  async me(@Req() req: EntitlementsRequest) {
    const tenantId = req.user.tenantId ?? req.tenantId ?? null;

    if (!tenantId) {
      throw new ForbiddenException("No active tenant selected");
    }

    const data = await this.entitlementsService.getUsageSnapshot(tenantId);

    return {
      data,
      message: "Entitlements fetched"
    };
  }
}
