import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AssetTaxonomyService } from "./asset-taxonomy.service";
import {
  CreateAssetCategoryMasterDto,
  CreateAssetDomainDto,
  CreateAssetTypeMasterDto,
  CreateAttributeDefinitionDto,
  TaxonomyListQueryDto,
  UpdateAssetCategoryMasterDto,
  UpdateAssetDomainDto,
  UpdateAssetTypeMasterDto,
  UpdateAttributeDefinitionDto
} from "./dto/taxonomy.dto";
import type { DomainProfileDefaults } from "./domain-profiles";

interface AuthedRequest {
  user?: { sub: string; email?: string; role: string; tenantId?: string | null };
}

const READ_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "ASSET_MANAGER",
  "SUPERVISOR",
  "MECHANIC",
  "VIEWER"
] as const;

const WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER"] as const;

@ApiTags("Asset Taxonomy")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("asset-taxonomy")
export class AssetTaxonomyController {
  constructor(private readonly taxonomy: AssetTaxonomyService) {}

  @Post("seed-defaults")
  @Roles(...WRITE_ROLES)
  async seedDefaults(@Req() req: AuthedRequest) {
    const data = await this.taxonomy.seedDefaults(req.user?.tenantId ?? null, req.user);
    return { data, message: "Asset taxonomy defaults seeded" };
  }

  // ── Phase 11: Domain Profile endpoints ──────────────────────────────────────

  @Get("domain-profiles")
  @Roles(...READ_ROLES)
  async listDomainProfiles(@Req() req: AuthedRequest) {
    const data = await this.taxonomy.listDomainProfiles(req.user?.tenantId ?? null);
    return { data, message: "Domain profiles fetched" };
  }

  @Get("domain-profiles/:code")
  @Roles(...READ_ROLES)
  async getDomainProfile(@Req() req: AuthedRequest, @Param("code") code: string) {
    const data = await this.taxonomy.getDomainProfileForCode(req.user?.tenantId ?? null, code);
    return { data, message: "Domain profile fetched" };
  }

  // ── Domain CRUD ──────────────────────────────────────────────────────────────
  @Roles(...READ_ROLES)
  async listDomains(@Req() req: AuthedRequest, @Query() query: TaxonomyListQueryDto) {
    const data = await this.taxonomy.listDomains(req.user?.tenantId ?? null, query);
    return { data, message: "Asset domains fetched" };
  }

  @Post("domains")
  @Roles(...WRITE_ROLES)
  async createDomain(@Req() req: AuthedRequest, @Body() body: CreateAssetDomainDto) {
    const data = await this.taxonomy.createDomain(req.user?.tenantId ?? null, body, req.user);
    return { data, message: "Asset domain created" };
  }

  @Patch("domains/:id")
  @Roles(...WRITE_ROLES)
  async updateDomain(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: UpdateAssetDomainDto
  ) {
    const data = await this.taxonomy.updateDomain(req.user?.tenantId ?? null, id, body, req.user);
    return { data, message: "Asset domain updated" };
  }

  @Patch("domains/:id/profile")
  @Roles(...WRITE_ROLES)
  async updateDomainProfile(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Partial<DomainProfileDefaults>
  ) {
    const data = await this.taxonomy.updateDomainProfile(
      req.user?.tenantId ?? null,
      id,
      body,
      req.user
    );
    return { data, message: "Domain profile updated" };
  }

  @Post("domains/:id/deactivate")
  @Roles(...WRITE_ROLES)
  async deactivateDomain(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.taxonomy.deactivateDomain(req.user?.tenantId ?? null, id, req.user);
    return { data, message: "Asset domain deactivated" };
  }

  @Get("domains/:id/can-delete")
  @Roles(...WRITE_ROLES)
  async canDeleteDomain(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.taxonomy.assertCanHardDeleteDomain(req.user?.tenantId ?? null, id);
    return { data, message: "Domain delete check completed" };
  }

  @Get("categories")
  @Roles(...READ_ROLES)
  async listCategories(@Req() req: AuthedRequest, @Query() query: TaxonomyListQueryDto) {
    const data = await this.taxonomy.listCategories(req.user?.tenantId ?? null, query);
    return { data, message: "Asset categories fetched" };
  }

  @Post("categories")
  @Roles(...WRITE_ROLES)
  async createCategory(@Req() req: AuthedRequest, @Body() body: CreateAssetCategoryMasterDto) {
    const data = await this.taxonomy.createCategory(req.user?.tenantId ?? null, body, req.user);
    return { data, message: "Asset category created" };
  }

  @Patch("categories/:id")
  @Roles(...WRITE_ROLES)
  async updateCategory(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: UpdateAssetCategoryMasterDto
  ) {
    const data = await this.taxonomy.updateCategory(req.user?.tenantId ?? null, id, body, req.user);
    return { data, message: "Asset category updated" };
  }

  @Get("types")
  @Roles(...READ_ROLES)
  async listTypes(@Req() req: AuthedRequest, @Query() query: TaxonomyListQueryDto) {
    const data = await this.taxonomy.listTypes(req.user?.tenantId ?? null, query);
    return { data, message: "Asset types fetched" };
  }

  @Post("types")
  @Roles(...WRITE_ROLES)
  async createType(@Req() req: AuthedRequest, @Body() body: CreateAssetTypeMasterDto) {
    const data = await this.taxonomy.createType(req.user?.tenantId ?? null, body, req.user);
    return { data, message: "Asset type created" };
  }

  @Patch("types/:id")
  @Roles(...WRITE_ROLES)
  async updateType(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: UpdateAssetTypeMasterDto
  ) {
    const data = await this.taxonomy.updateType(req.user?.tenantId ?? null, id, body, req.user);
    return { data, message: "Asset type updated" };
  }

  @Get("attributes")
  @Roles(...READ_ROLES)
  async listAttributes(@Req() req: AuthedRequest, @Query() query: TaxonomyListQueryDto) {
    const data = await this.taxonomy.listAttributeDefinitions(req.user?.tenantId ?? null, query);
    return { data, message: "Attribute definitions fetched" };
  }

  @Post("attributes")
  @Roles(...WRITE_ROLES)
  async createAttribute(@Req() req: AuthedRequest, @Body() body: CreateAttributeDefinitionDto) {
    const data = await this.taxonomy.createAttributeDefinition(
      req.user?.tenantId ?? null,
      body,
      req.user
    );
    return { data, message: "Attribute definition created" };
  }

  @Patch("attributes/:id")
  @Roles(...WRITE_ROLES)
  async updateAttribute(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: UpdateAttributeDefinitionDto
  ) {
    const data = await this.taxonomy.updateAttributeDefinition(
      req.user?.tenantId ?? null,
      id,
      body,
      req.user
    );
    return { data, message: "Attribute definition updated" };
  }
}
