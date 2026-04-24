import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import {
  ENTITLEMENT_METADATA_KEY,
  type EntitlementRequirement
} from "./entitlement.decorator";
import { EntitlementsService } from "./entitlements.service";

type EntitlementRequest = {
  user?: {
    tenantId?: string | null;
  };
  tenantId?: string | null;
};

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(EntitlementsService)
    private readonly entitlementsService: EntitlementsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<
      EntitlementRequirement | undefined
    >(ENTITLEMENT_METADATA_KEY, [context.getHandler(), context.getClass()]);

    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<EntitlementRequest>();
    const tenantId = request.user?.tenantId ?? request.tenantId ?? null;

    if (!tenantId) {
      throw new ForbiddenException("Tenant context is required for this action");
    }

    const result = await this.entitlementsService.assertEntitlement(
      tenantId,
      requirement.key,
      requirement.quantity
    );

    if (!result.allowed) {
      const details =
        typeof result.limit === "number"
          ? ` (${result.used ?? 0}/${result.limit})`
          : "";
      throw new ForbiddenException(
        `Entitlement '${requirement.key}' is not available${details}`
      );
    }

    return true;
  }
}
