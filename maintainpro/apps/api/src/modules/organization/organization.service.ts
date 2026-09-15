import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AuditAction,
  FunctionalLocationType,
  Prisma,
  SiteType
} from "@prisma/client";

import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import {
  buildLocationPath,
  formatLocationPathLabel,
  normalizeLocationCode,
  wouldCreateHierarchyCycle
} from "./location-hierarchy";
import type { CreateSiteDto, UpdateSiteDto } from "./dto/site.dto";
import type {
  CreateFunctionalLocationDto,
  MoveFunctionalLocationDto,
  UpdateFunctionalLocationDto
} from "./dto/functional-location.dto";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Organization summary (Tenant as backend boundary) ───────────────────

  async getOrganizationSummary(tenantId: string | null) {
    const tid = requireTenantId(tenantId);
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tid },
      select: { id: true, name: true, slug: true, isActive: true, createdAt: true, updatedAt: true }
    });
    if (!tenant) {
      throw new NotFoundException("Organization not found");
    }

    const [siteCount, locationCount, activeSiteCount] = await Promise.all([
      this.prisma.site.count({ where: { tenantId: tid } }),
      this.prisma.functionalLocation.count({ where: { tenantId: tid } }),
      this.prisma.site.count({ where: { tenantId: tid, isActive: true } })
    ]);

    return {
      // UI label: Organization — backend identity remains Tenant.
      organization: {
        id: tenant.id,
        name: tenant.name,
        code: tenant.slug,
        isActive: tenant.isActive,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt
      },
      counts: {
        sites: siteCount,
        activeSites: activeSiteCount,
        functionalLocations: locationCount
      }
    };
  }

  // ─── Sites ───────────────────────────────────────────────────────────────

  async listSites(
    tenantId: string | null,
    params: { q?: string; type?: SiteType; includeInactive?: boolean; page?: number; pageSize?: number } = {}
  ) {
    const tid = requireTenantId(tenantId);
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 50, 1), 200);
    const q = params.q?.trim();

    const where: Prisma.SiteWhereInput = {
      tenantId: tid,
      type: params.type,
      isActive: params.includeInactive ? undefined : true,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { code: { contains: q } },
              { address: { contains: q } }
            ]
          }
        : {})
    };

    const [total, items] = await Promise.all([
      this.prisma.site.count({ where }),
      this.prisma.site.findMany({
        where,
        orderBy: [{ name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { locations: true } } }
      })
    ]);

    return {
      items: items.map((site) => this.mapSite(site)),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    };
  }

  async getSite(tenantId: string | null, siteId: string) {
    const tid = requireTenantId(tenantId);
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId: tid },
      include: { _count: { select: { locations: true } } }
    });
    if (!site) {
      throw new NotFoundException("Site not found");
    }
    return this.mapSite(site);
  }

  async createSite(tenantId: string | null, dto: CreateSiteDto, actor?: Actor) {
    const tid = requireTenantId(tenantId);
    const code = normalizeLocationCode(dto.code);
    try {
      const site = await this.prisma.site.create({
        data: {
          tenantId: tid,
          code,
          name: dto.name.trim(),
          type: dto.type,
          description: dto.description?.trim() || null,
          address: dto.address?.trim() || null,
          contactPhone: dto.contactPhone?.trim() || null
        }
      });
      await writeAuditTrail(this.prisma, {
        entity: "Site",
        entityId: site.id,
        action: AuditAction.CREATE,
        module: "organization",
        actor,
        afterData: site as unknown as Prisma.InputJsonValue
      });
      return this.mapSite(site);
    } catch (error) {
      this.rethrowUnique(error, "Site code already exists for this organization");
    }
  }

  async updateSite(tenantId: string | null, siteId: string, dto: UpdateSiteDto, actor?: Actor) {
    const tid = requireTenantId(tenantId);
    const existing = await this.prisma.site.findFirst({ where: { id: siteId, tenantId: tid } });
    if (!existing) {
      throw new NotFoundException("Site not found");
    }

    if (dto.isActive === false) {
      const activeChildren = await this.prisma.functionalLocation.count({
        where: { tenantId: tid, siteId, isActive: true }
      });
      if (activeChildren > 0) {
        throw new BadRequestException(
          `Cannot deactivate site while ${activeChildren} active functional location(s) exist. Deactivate children first.`
        );
      }
    }

    try {
      const updated = await this.prisma.site.update({
        where: { id: siteId },
        data: {
          code: dto.code ? normalizeLocationCode(dto.code) : undefined,
          name: dto.name?.trim(),
          type: dto.type,
          description: dto.description === undefined ? undefined : dto.description?.trim() || null,
          address: dto.address === undefined ? undefined : dto.address?.trim() || null,
          contactPhone: dto.contactPhone === undefined ? undefined : dto.contactPhone?.trim() || null,
          isActive: dto.isActive
        }
      });
      await writeAuditTrail(this.prisma, {
        entity: "Site",
        entityId: siteId,
        action: AuditAction.UPDATE,
        module: "organization",
        actor,
        beforeData: existing as unknown as Prisma.InputJsonValue,
        afterData: updated as unknown as Prisma.InputJsonValue
      });
      return this.mapSite(updated);
    } catch (error) {
      this.rethrowUnique(error, "Site code already exists for this organization");
    }
  }

  // ─── Functional locations ────────────────────────────────────────────────

  async listLocations(
    tenantId: string | null,
    params: {
      siteId?: string;
      parentId?: string | "null";
      type?: FunctionalLocationType;
      q?: string;
      includeInactive?: boolean;
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    const tid = requireTenantId(tenantId);
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 100, 1), 500);
    const q = params.q?.trim();

    const parentFilter =
      params.parentId === undefined
        ? {}
        : params.parentId === "null"
          ? { parentId: null }
          : { parentId: params.parentId };

    const where: Prisma.FunctionalLocationWhereInput = {
      tenantId: tid,
      siteId: params.siteId,
      type: params.type,
      isActive: params.includeInactive ? undefined : true,
      ...parentFilter,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { code: { contains: q } }
            ]
          }
        : {})
    };

    const [total, items] = await Promise.all([
      this.prisma.functionalLocation.count({ where }),
      this.prisma.functionalLocation.findMany({
        where,
        orderBy: [{ name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          site: { select: { id: true, code: true, name: true } },
          department: { select: { id: true, code: true, name: true } },
          _count: { select: { children: true } }
        }
      })
    ]);

    return {
      items: items.map((item) => this.mapLocation(item)),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    };
  }

  async getLocation(tenantId: string | null, locationId: string) {
    const tid = requireTenantId(tenantId);
    const location = await this.prisma.functionalLocation.findFirst({
      where: { id: locationId, tenantId: tid },
      include: {
        site: { select: { id: true, code: true, name: true, type: true } },
        parent: { select: { id: true, code: true, name: true, type: true } },
        department: { select: { id: true, code: true, name: true } },
        _count: { select: { children: true } }
      }
    });
    if (!location) {
      throw new NotFoundException("Functional location not found");
    }

    const path = await this.resolvePath(tid, location.siteId, locationId);
    return {
      ...this.mapLocation(location),
      path,
      pathLabel: formatLocationPathLabel(path),
      // Phase 4 hooks — empty placeholders so clients can extend without breaking.
      attachmentsPreview: {
        assets: null,
        openWorkOrders: null,
        maintenanceHistory: null
      }
    };
  }

  async getLocationTree(
    tenantId: string | null,
    params: { siteId: string; includeInactive?: boolean }
  ) {
    const tid = requireTenantId(tenantId);
    await this.assertSite(tid, params.siteId);

    const rows = await this.prisma.functionalLocation.findMany({
      where: {
        tenantId: tid,
        siteId: params.siteId,
        isActive: params.includeInactive ? undefined : true
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        parentId: true,
        isActive: true,
        departmentId: true
      }
    });

    type Node = (typeof rows)[number] & { children: Node[] };
    const byId = new Map<string, Node>();
    for (const row of rows) {
      byId.set(row.id, { ...row, children: [] });
    }
    const roots: Node[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return { siteId: params.siteId, roots };
  }

  async getLocationChildren(tenantId: string | null, locationId: string, includeInactive = false) {
    const tid = requireTenantId(tenantId);
    await this.assertLocation(tid, locationId);
    const children = await this.prisma.functionalLocation.findMany({
      where: {
        tenantId: tid,
        parentId: locationId,
        isActive: includeInactive ? undefined : true
      },
      orderBy: { name: "asc" },
      include: { _count: { select: { children: true } } }
    });
    return children.map((child) => this.mapLocation(child));
  }

  async createLocation(tenantId: string | null, dto: CreateFunctionalLocationDto, actor?: Actor) {
    const tid = requireTenantId(tenantId);
    await this.assertSite(tid, dto.siteId);

    let parentId: string | null = dto.parentId ?? null;
    if (parentId) {
      const parent = await this.assertLocation(tid, parentId);
      if (parent.siteId !== dto.siteId) {
        throw new BadRequestException("Parent location must belong to the same site");
      }
      if (!parent.isActive) {
        throw new BadRequestException("Cannot create a child under an inactive parent");
      }
    }

    if (dto.departmentId) {
      await this.assertDepartment(tid, dto.departmentId);
    }

    const code = normalizeLocationCode(dto.code);
    try {
      const created = await this.prisma.functionalLocation.create({
        data: {
          tenantId: tid,
          siteId: dto.siteId,
          parentId,
          departmentId: dto.departmentId ?? null,
          code,
          name: dto.name.trim(),
          type: dto.type,
          description: dto.description?.trim() || null
        }
      });
      await writeAuditTrail(this.prisma, {
        entity: "FunctionalLocation",
        entityId: created.id,
        action: AuditAction.CREATE,
        module: "organization",
        actor,
        afterData: created as unknown as Prisma.InputJsonValue
      });
      return this.mapLocation(created);
    } catch (error) {
      this.rethrowUnique(error, "Location code already exists for this site");
    }
  }

  async updateLocation(
    tenantId: string | null,
    locationId: string,
    dto: UpdateFunctionalLocationDto,
    actor?: Actor
  ) {
    const tid = requireTenantId(tenantId);
    const existing = await this.assertLocation(tid, locationId);

    if (dto.isActive === false) {
      const activeChildren = await this.prisma.functionalLocation.count({
        where: { tenantId: tid, parentId: locationId, isActive: true }
      });
      if (activeChildren > 0) {
        throw new BadRequestException(
          `Cannot deactivate location while ${activeChildren} active child location(s) exist`
        );
      }
    }

    if (dto.departmentId) {
      await this.assertDepartment(tid, dto.departmentId);
    }

    try {
      const updated = await this.prisma.functionalLocation.update({
        where: { id: locationId },
        data: {
          code: dto.code ? normalizeLocationCode(dto.code) : undefined,
          name: dto.name?.trim(),
          type: dto.type,
          description: dto.description === undefined ? undefined : dto.description?.trim() || null,
          departmentId: dto.departmentId === undefined ? undefined : dto.departmentId,
          isActive: dto.isActive
        }
      });
      await writeAuditTrail(this.prisma, {
        entity: "FunctionalLocation",
        entityId: locationId,
        action: AuditAction.UPDATE,
        module: "organization",
        actor,
        beforeData: existing as unknown as Prisma.InputJsonValue,
        afterData: updated as unknown as Prisma.InputJsonValue
      });
      return this.mapLocation(updated);
    } catch (error) {
      this.rethrowUnique(error, "Location code already exists for this site");
    }
  }

  async moveLocation(
    tenantId: string | null,
    locationId: string,
    dto: MoveFunctionalLocationDto,
    actor?: Actor
  ) {
    const tid = requireTenantId(tenantId);
    const existing = await this.assertLocation(tid, locationId);
    const targetSiteId = dto.siteId ?? existing.siteId;
    await this.assertSite(tid, targetSiteId);

    const newParentId = dto.parentId === undefined ? existing.parentId : dto.parentId;

    if (newParentId) {
      const parent = await this.assertLocation(tid, newParentId);
      if (parent.siteId !== targetSiteId) {
        throw new BadRequestException("New parent must belong to the target site");
      }
      if (!parent.isActive) {
        throw new BadRequestException("Cannot move under an inactive parent");
      }
    }

    const siblings = await this.prisma.functionalLocation.findMany({
      where: { tenantId: tid, siteId: existing.siteId },
      select: { id: true, parentId: true }
    });
    // If moving across sites, also load target site graph for cycle check on new parent chain.
    const targetGraph =
      targetSiteId === existing.siteId
        ? siblings
        : await this.prisma.functionalLocation.findMany({
            where: { tenantId: tid, siteId: targetSiteId },
            select: { id: true, parentId: true }
          });

    const parentById = new Map<string, string | null>();
    for (const row of [...siblings, ...targetGraph]) {
      parentById.set(row.id, row.parentId);
    }
    parentById.set(locationId, newParentId ?? null);

    if (
      wouldCreateHierarchyCycle({
        locationId,
        newParentId,
        parentById
      })
    ) {
      throw new BadRequestException("Move would create a hierarchy cycle");
    }

    const updated = await this.prisma.functionalLocation.update({
      where: { id: locationId },
      data: {
        parentId: newParentId,
        siteId: targetSiteId
      }
    });

    await writeAuditTrail(this.prisma, {
      entity: "FunctionalLocation",
      entityId: locationId,
      action: AuditAction.UPDATE,
      module: "organization",
      actor,
      reason: dto.reason.trim(),
      beforeData: {
        parentId: existing.parentId,
        siteId: existing.siteId
      } as Prisma.InputJsonValue,
      afterData: {
        parentId: updated.parentId,
        siteId: updated.siteId
      } as Prisma.InputJsonValue,
      metadata: { operation: "MOVE" }
    });

    return this.mapLocation(updated);
  }

  // ─── Data quality hooks (not full Phase 12 dashboard) ────────────────────

  async getDataQualityFindings(tenantId: string | null) {
    const tid = requireTenantId(tenantId);
    const locations = await this.prisma.functionalLocation.findMany({
      where: { tenantId: tid },
      select: {
        id: true,
        code: true,
        name: true,
        siteId: true,
        parentId: true,
        isActive: true
      }
    });
    const siteIds = new Set(
      (await this.prisma.site.findMany({ where: { tenantId: tid }, select: { id: true } })).map((s) => s.id)
    );
    const byId = new Map(locations.map((l) => [l.id, l]));

    const findings: Array<{ code: string; severity: "WARNING" | "ERROR"; message: string; entityId?: string }> =
      [];

    for (const loc of locations) {
      if (!siteIds.has(loc.siteId)) {
        findings.push({
          code: "LOCATION_MISSING_SITE",
          severity: "ERROR",
          message: `Location ${loc.code} references missing site`,
          entityId: loc.id
        });
      }
      if (loc.parentId) {
        const parent = byId.get(loc.parentId);
        if (!parent) {
          findings.push({
            code: "INVALID_PARENT",
            severity: "ERROR",
            message: `Location ${loc.code} has invalid parent`,
            entityId: loc.id
          });
        } else if (parent.siteId !== loc.siteId) {
          findings.push({
            code: "CROSS_SITE_PARENT",
            severity: "ERROR",
            message: `Location ${loc.code} parent is on a different site`,
            entityId: loc.id
          });
        } else if (!parent.isActive && loc.isActive) {
          findings.push({
            code: "INACTIVE_PARENT",
            severity: "WARNING",
            message: `Active location ${loc.code} has inactive parent`,
            entityId: loc.id
          });
        }
      }
    }

    return { findings, count: findings.length };
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  private mapSite(site: {
    id: string;
    tenantId: string;
    code: string;
    name: string;
    type: SiteType;
    description: string | null;
    address: string | null;
    contactPhone?: string | null;
    isActive: boolean;
    legacyPropertyId?: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { locations: number };
  }) {
    return {
      id: site.id,
      tenantId: site.tenantId,
      code: site.code,
      name: site.name,
      type: site.type,
      description: site.description,
      address: site.address,
      contactPhone: site.contactPhone ?? null,
      isActive: site.isActive,
      legacyPropertyId: site.legacyPropertyId ?? null,
      locationCount: site._count?.locations ?? undefined,
      createdAt: site.createdAt,
      updatedAt: site.updatedAt
    };
  }

  private mapLocation(location: {
    id: string;
    tenantId: string;
    siteId: string;
    parentId: string | null;
    departmentId: string | null;
    code: string;
    name: string;
    type: FunctionalLocationType;
    description: string | null;
    isActive: boolean;
    legacyBuildingId?: string | null;
    legacyFloorId?: string | null;
    legacyRoomId?: string | null;
    createdAt: Date;
    updatedAt: Date;
    site?: { id: string; code: string; name: string; type?: SiteType };
    parent?: { id: string; code: string; name: string; type: FunctionalLocationType } | null;
    department?: { id: string; code: string; name: string } | null;
    _count?: { children: number };
  }) {
    return {
      id: location.id,
      tenantId: location.tenantId,
      siteId: location.siteId,
      parentId: location.parentId,
      departmentId: location.departmentId,
      code: location.code,
      name: location.name,
      type: location.type,
      description: location.description,
      isActive: location.isActive,
      legacyBuildingId: location.legacyBuildingId ?? null,
      legacyFloorId: location.legacyFloorId ?? null,
      legacyRoomId: location.legacyRoomId ?? null,
      site: location.site,
      parent: location.parent ?? undefined,
      department: location.department ?? undefined,
      childCount: location._count?.children,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt
    };
  }

  private async resolvePath(tenantId: string, siteId: string, locationId: string) {
    const rows = await this.prisma.functionalLocation.findMany({
      where: { tenantId, siteId },
      select: { id: true, code: true, name: true, type: true, parentId: true }
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return buildLocationPath(locationId, byId);
  }

  private async assertSite(tenantId: string, siteId: string) {
    const site = await this.prisma.site.findFirst({ where: { id: siteId, tenantId } });
    if (!site) {
      throw new NotFoundException("Site not found");
    }
    return site;
  }

  private async assertLocation(tenantId: string, locationId: string) {
    const location = await this.prisma.functionalLocation.findFirst({
      where: { id: locationId, tenantId }
    });
    if (!location) {
      throw new NotFoundException("Functional location not found");
    }
    return location;
  }

  private async assertDepartment(tenantId: string, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId }
    });
    if (!department) {
      // Non-enumerating: do not reveal whether the id exists in another tenant.
      throw new NotFoundException("Department not found");
    }
    return department;
  }

  private rethrowUnique(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new BadRequestException(message);
    }
    throw error;
  }
}
