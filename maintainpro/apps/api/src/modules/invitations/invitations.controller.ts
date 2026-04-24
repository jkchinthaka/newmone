import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { EntitlementGuard } from "../entitlements/entitlement.guard";
import { RequireEntitlement } from "../entitlements/entitlement.decorator";
import { CreateTenantInvitationDto } from "./dto/create-tenant-invitation.dto";
import { InvitationsService } from "./invitations.service";

type InvitationsRequest = {
  user: {
    sub: string;
  };
};

@ApiTags("Invitations")
@ApiBearerAuth()
@Controller("tenants/:id/invitations")
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async listInvitations(@Req() req: InvitationsRequest, @Param("id") tenantId: string) {
    const data = await this.invitationsService.listInvitations(req.user.sub, tenantId);
    return {
      data,
      message: "Invitations fetched"
    };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  @RequireEntitlement("users.max", 1)
  @UseGuards(EntitlementGuard)
  async createInvitation(
    @Req() req: InvitationsRequest,
    @Param("id") tenantId: string,
    @Body() dto: CreateTenantInvitationDto
  ) {
    const data = await this.invitationsService.createInvitation(req.user.sub, tenantId, dto);
    return {
      data,
      message: "Invitation created"
    };
  }
}
