import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  assertCommonEngineReuse,
  domainsForAssetCategory,
  getDomainProfile,
  MAINTENANCE_DOMAIN_PROFILES,
  type MaintenanceDomainKey
} from "./domain-profiles";

@ApiTags("Domain Coverage")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("domain-coverage")
export class DomainCoverageController {
  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "VIEWER")
  list() {
    return {
      data: MAINTENANCE_DOMAIN_PROFILES.map((p) => ({
        ...p,
        engine: assertCommonEngineReuse(p)
      })),
      message: "Maintenance domain profiles"
    };
  }

  @Get("by-asset-category/:category")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "VIEWER")
  byCategory(@Param("category") category: string) {
    return {
      data: domainsForAssetCategory(category),
      message: "Domains for asset category"
    };
  }

  @Get(":key")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "VIEWER")
  one(@Param("key") key: string) {
    const profile = getDomainProfile(key as MaintenanceDomainKey);
    return {
      data: profile ? { ...profile, engine: assertCommonEngineReuse(profile) } : null,
      message: profile ? "Domain profile" : "Unknown domain key"
    };
  }
}
