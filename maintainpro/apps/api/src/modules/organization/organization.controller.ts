import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { memoryStorage } from "multer";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { FunctionalLocationType, SiteType } from "@prisma/client";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { CreateSiteDto, UpdateSiteDto } from "./dto/site.dto";
import {
  CreateFunctionalLocationDto,
  MoveFunctionalLocationDto,
  UpdateFunctionalLocationDto
} from "./dto/functional-location.dto";
import { FacilityHierarchyMigrationService } from "./facility-hierarchy-migration.service";
import { OrganizationService } from "./organization.service";
import { PlacesImportService } from "./places-import.service";

type RowsUpload = { buffer?: Buffer } | undefined;

/** Rows come as a small JSON file built in the browser from the Excel sheet. */
function rowsFromUpload(file: RowsUpload, body: { rows?: unknown }): unknown {
  if (file?.buffer?.length) {
    try {
      return JSON.parse(file.buffer.toString("utf8"));
    } catch {
      return null;
    }
  }
  return body?.rows;
}

type AuthedRequest = { user: JwtPayload };

const ORG_READ_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "FACILITY_MANAGER",
  "BUILDING_SUPERVISOR",
  "SUPERVISOR",
  "VIEWER",
  "ASSET_MANAGER"
] as const;

const ORG_MANAGE_ROLES = ["SUPER_ADMIN", "ADMIN", "FACILITY_MANAGER"] as const;

/**
 * Authoritative Site + FunctionalLocation API.
 * Legacy /api/facilities/* remains for Property/Building/Floor/Room compatibility.
 */
@ApiTags("Organization")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("organization")
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly migrationService: FacilityHierarchyMigrationService,
    private readonly placesImport: PlacesImportService
  ) {}

  @Get("summary")
  @Header("Cache-Control", "private, max-age=30")
  @Roles(...ORG_READ_ROLES)
  @Permissions("organization.view")
  async summary(@Req() req: AuthedRequest) {
    const data = await this.organizationService.getOrganizationSummary(req.user.tenantId ?? null);
    return { data, message: "Organization summary fetched" };
  }

  @Get("sites")
  @Header("Cache-Control", "private, max-age=30")
  @Roles(...ORG_READ_ROLES)
  @Permissions("organization.view")
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "type", required: false, enum: SiteType })
  @ApiQuery({ name: "includeInactive", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  async listSites(
    @Req() req: AuthedRequest,
    @Query("q") q?: string,
    @Query("type") type?: SiteType,
    @Query("includeInactive") includeInactive?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    const data = await this.organizationService.listSites(req.user.tenantId ?? null, {
      q,
      type,
      includeInactive: includeInactive === "true",
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined
    });
    return { data: data.items, meta: data.meta, message: "Sites fetched" };
  }

  @Post("sites")
  @Roles(...ORG_MANAGE_ROLES)
  @Permissions("organization.manage")
  async createSite(@Req() req: AuthedRequest, @Body() body: CreateSiteDto) {
    const data = await this.organizationService.createSite(req.user.tenantId ?? null, body, req.user);
    return { data, message: "Site created" };
  }

  @Get("sites/:siteId")
  @Roles(...ORG_READ_ROLES)
  @Permissions("organization.view")
  async getSite(@Req() req: AuthedRequest, @Param("siteId") siteId: string) {
    const data = await this.organizationService.getSite(req.user.tenantId ?? null, siteId);
    return { data, message: "Site fetched" };
  }

  @Patch("sites/:siteId")
  @Roles(...ORG_MANAGE_ROLES)
  @Permissions("organization.manage")
  async updateSite(
    @Req() req: AuthedRequest,
    @Param("siteId") siteId: string,
    @Body() body: UpdateSiteDto
  ) {
    const data = await this.organizationService.updateSite(
      req.user.tenantId ?? null,
      siteId,
      body,
      req.user
    );
    return { data, message: "Site updated" };
  }

  @Get("locations")
  @Header("Cache-Control", "private, max-age=30")
  @Roles(...ORG_READ_ROLES)
  @Permissions("locations.view")
  @ApiQuery({ name: "siteId", required: false })
  @ApiQuery({ name: "parentId", required: false })
  @ApiQuery({ name: "type", required: false, enum: FunctionalLocationType })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "includeInactive", required: false })
  async listLocations(
    @Req() req: AuthedRequest,
    @Query("siteId") siteId?: string,
    @Query("parentId") parentId?: string,
    @Query("type") type?: FunctionalLocationType,
    @Query("q") q?: string,
    @Query("includeInactive") includeInactive?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    const data = await this.organizationService.listLocations(req.user.tenantId ?? null, {
      siteId,
      parentId,
      type,
      q,
      includeInactive: includeInactive === "true",
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined
    });
    return { data: data.items, meta: data.meta, message: "Functional locations fetched" };
  }

  @Get("locations/tree")
  @Roles(...ORG_READ_ROLES)
  @Permissions("locations.view")
  @ApiQuery({ name: "siteId", required: true })
  async getTree(
    @Req() req: AuthedRequest,
    @Query("siteId") siteId: string,
    @Query("includeInactive") includeInactive?: string
  ) {
    const data = await this.organizationService.getLocationTree(req.user.tenantId ?? null, {
      siteId,
      includeInactive: includeInactive === "true"
    });
    return { data, message: "Location tree fetched" };
  }

  @Post("locations")
  @Roles(...ORG_MANAGE_ROLES)
  @Permissions("locations.manage")
  async createLocation(@Req() req: AuthedRequest, @Body() body: CreateFunctionalLocationDto) {
    const data = await this.organizationService.createLocation(
      req.user.tenantId ?? null,
      body,
      req.user
    );
    return { data, message: "Functional location created" };
  }

  @Get("locations/:locationId")
  @Roles(...ORG_READ_ROLES)
  @Permissions("locations.view")
  async getLocation(@Req() req: AuthedRequest, @Param("locationId") locationId: string) {
    const data = await this.organizationService.getLocation(req.user.tenantId ?? null, locationId);
    return { data, message: "Functional location fetched" };
  }

  @Get("locations/:locationId/children")
  @Roles(...ORG_READ_ROLES)
  @Permissions("locations.view")
  async getChildren(
    @Req() req: AuthedRequest,
    @Param("locationId") locationId: string,
    @Query("includeInactive") includeInactive?: string
  ) {
    const data = await this.organizationService.getLocationChildren(
      req.user.tenantId ?? null,
      locationId,
      includeInactive === "true"
    );
    return { data, message: "Location children fetched" };
  }

  @Patch("locations/:locationId")
  @Roles(...ORG_MANAGE_ROLES)
  @Permissions("locations.manage")
  async updateLocation(
    @Req() req: AuthedRequest,
    @Param("locationId") locationId: string,
    @Body() body: UpdateFunctionalLocationDto
  ) {
    const data = await this.organizationService.updateLocation(
      req.user.tenantId ?? null,
      locationId,
      body,
      req.user
    );
    return { data, message: "Functional location updated" };
  }

  @Post("locations/:locationId/move")
  @Roles(...ORG_MANAGE_ROLES)
  @Permissions("locations.manage")
  async moveLocation(
    @Req() req: AuthedRequest,
    @Param("locationId") locationId: string,
    @Body() body: MoveFunctionalLocationDto
  ) {
    const data = await this.organizationService.moveLocation(
      req.user.tenantId ?? null,
      locationId,
      body,
      req.user
    );
    return { data, message: "Functional location moved" };
  }

  /** Sites + functional locations from Excel: template, check, save. */
  @Get("places-import/template.xlsx")
  @Roles(...ORG_MANAGE_ROLES)
  @Permissions("organization.manage")
  async placesTemplate(@Req() req: AuthedRequest, @Res() res: Response) {
    const buffer = await this.placesImport.template(req.user);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"sites-and-locations-template.xlsx\"");
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  }

  @Post("places-import/preview")
  @Roles(...ORG_MANAGE_ROLES)
  @Permissions("organization.manage")
  @UseInterceptors(FileInterceptor("rows", { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  async placesPreview(@Req() req: AuthedRequest, @UploadedFile() file: RowsUpload, @Body() body: { rows?: unknown }) {
    const data = await this.placesImport.preview(req.user, rowsFromUpload(file, body));
    return { data, message: "Sites and locations checked" };
  }

  @Post("places-import/save")
  @Roles(...ORG_MANAGE_ROLES)
  @Permissions("organization.manage")
  @UseInterceptors(FileInterceptor("rows", { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  async placesSave(@Req() req: AuthedRequest, @UploadedFile() file: RowsUpload, @Body() body: { rows?: unknown }) {
    const data = await this.placesImport.save(req.user, rowsFromUpload(file, body));
    return { data, message: "Sites and locations saved" };
  }

  @Get("data-quality")
  @Roles(...ORG_MANAGE_ROLES)
  @Permissions("organization.manage")
  async dataQuality(@Req() req: AuthedRequest) {
    const data = await this.organizationService.getDataQualityFindings(req.user.tenantId ?? null);
    return { data, message: "Organization data-quality findings" };
  }

  @Post("migrations/facility-hierarchy")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("organization.manage")
  async migrateFacilityHierarchy(
    @Req() req: AuthedRequest,
    @Body() body: { dryRun?: boolean } = {}
  ) {
    const data = await this.migrationService.migrateTenant(req.user.tenantId ?? null, {
      dryRun: body.dryRun !== false
    });
    return {
      data,
      message: data.dryRun
        ? "Facility hierarchy migration dry-run completed"
        : "Facility hierarchy migration applied"
    };
  }

  @Get("migrations/free-text-locations")
  @Roles(...ORG_MANAGE_ROLES)
  @Permissions("organization.manage")
  async classifyFreeText(@Req() req: AuthedRequest) {
    const data = await this.migrationService.classifyFreeTextAssetLocations(
      req.user.tenantId ?? null
    );
    return { data, message: "Free-text location classification (non-destructive)" };
  }
}
