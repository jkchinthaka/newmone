import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AssetCategory, AuditAction, Prisma } from "@prisma/client";

import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import {
  DEFAULT_ASSET_DOMAINS,
  DEFAULT_ATTRIBUTE_EXAMPLES,
  DEFAULT_CATEGORY_EXAMPLES
} from "./domain-defaults";
import {
  getAllDomainProfiles,
  normalizeDomainCode,
  resolveDomainProfile,
  type DomainProfileDefaults
} from "./domain-profiles";
import type {
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

type Actor = {
  sub: string;
  email?: string;
  role?: string;
  tenantId?: string | null;
};

function asAuditActor(actor?: Actor) {
  if (!actor) return undefined;
  return {
    sub: actor.sub,
    email: actor.email ?? "",
    role: actor.role as never,
    tenantId: actor.tenantId
  };
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "_");
}

@Injectable()
export class AssetTaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  async seedDefaults(tenantId: string | null, actor?: Actor) {
    const tid = requireTenantId(tenantId);
    let domainsCreated = 0;
    let categoriesCreated = 0;
    let typesCreated = 0;
    let attributesCreated = 0;

    for (const domain of DEFAULT_ASSET_DOMAINS) {
      const existing = await this.prisma.assetDomain.findUnique({
        where: { tenantId_code: { tenantId: tid, code: domain.code } }
      });
      if (existing) continue;
      await this.prisma.assetDomain.create({
        data: {
          tenantId: tid,
          code: domain.code,
          name: domain.name,
          sortOrder: domain.sortOrder
        }
      });
      domainsCreated += 1;
    }

    for (const example of DEFAULT_CATEGORY_EXAMPLES) {
      const domain = await this.prisma.assetDomain.findUnique({
        where: { tenantId_code: { tenantId: tid, code: example.domainCode } }
      });
      if (!domain) continue;

      let category = await this.prisma.assetCategoryMaster.findFirst({
        where: { tenantId: tid, domainId: domain.id, code: example.code }
      });
      if (!category) {
        category = await this.prisma.assetCategoryMaster.create({
          data: {
            tenantId: tid,
            domainId: domain.id,
            code: example.code,
            name: example.name,
            legacyEnum: (example.legacyEnum as AssetCategory | undefined) ?? null
          }
        });
        categoriesCreated += 1;
      }

      for (const type of example.types ?? []) {
        const existingType = await this.prisma.assetTypeMaster.findFirst({
          where: { tenantId: tid, categoryId: category.id, code: type.code }
        });
        if (existingType) continue;
        await this.prisma.assetTypeMaster.create({
          data: {
            tenantId: tid,
            categoryId: category.id,
            code: type.code,
            name: type.name
          }
        });
        typesCreated += 1;
      }
    }

    // Seed illustrative attribute definitions for key types (capacity, refrigerant, hostname)
    for (const attrEx of DEFAULT_ATTRIBUTE_EXAMPLES) {
      const domain = await this.prisma.assetDomain.findUnique({
        where: { tenantId_code: { tenantId: tid, code: attrEx.domainCode } }
      });
      if (!domain) continue;
      const category = await this.prisma.assetCategoryMaster.findFirst({
        where: { tenantId: tid, domainId: domain.id, code: attrEx.categoryCode }
      });
      if (!category) continue;
      const typeMaster = await this.prisma.assetTypeMaster.findFirst({
        where: { tenantId: tid, categoryId: category.id, code: attrEx.typeCode }
      });
      if (!typeMaster) continue;
      const existingAttr = await this.prisma.assetAttributeDefinition.findFirst({
        where: { tenantId: tid, typeMasterId: typeMaster.id, key: attrEx.key }
      });
      if (existingAttr) continue;
      await this.prisma.assetAttributeDefinition.create({
        data: {
          tenantId: tid,
          typeMasterId: typeMaster.id,
          key: attrEx.key,
          label: attrEx.label,
          dataType: attrEx.dataType,
          unit: attrEx.unit ?? null,
          options: attrEx.options ?? [],
          required: false,
          displayOrder: attrEx.displayOrder
        }
      });
      attributesCreated += 1;
    }

    await writeAuditTrail(this.prisma, {
      entity: "AssetTaxonomy",
      entityId: tid,
      action: AuditAction.CREATE,
      module: "asset-taxonomy",
      actor: asAuditActor(actor),
      afterData: { domainsCreated, categoriesCreated, typesCreated, attributesCreated } as Prisma.InputJsonValue
    });

    return { domainsCreated, categoriesCreated, typesCreated, attributesCreated };
  }

  async listDomains(tenantId: string | null, query: TaxonomyListQueryDto = {}) {
    const tid = requireTenantId(tenantId);
    const q = query.q?.trim();
    const items = await this.prisma.assetDomain.findMany({
      where: {
        tenantId: tid,
        isActive: query.includeInactive ? undefined : true,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { categories: true, assets: true } } }
    });
    // Enrich each domain with resolved profile (Phase 11)
    const enriched = items.map((domain) => ({
      ...domain,
      resolvedProfile: resolveDomainProfile(
        domain.code,
        (domain.profile as Partial<DomainProfileDefaults> | null) ?? undefined
      )
    }));
    return { items: enriched };
  }

  /** Phase 11: returns all static domain profiles merged with any tenant overrides for matching domains. */
  async listDomainProfiles(tenantId: string | null) {
    const tid = requireTenantId(tenantId);
    const staticProfiles = getAllDomainProfiles();
    // Load tenant domain rows to apply overrides
    const tenantDomains = await this.prisma.assetDomain.findMany({
      where: { tenantId: tid, isActive: true },
      select: { code: true, profile: true }
    });
    const overrideMap = new Map(tenantDomains.map((d) => [d.code, d.profile]));
    const resolved = staticProfiles.map((profile) => {
      const override = overrideMap.get(profile.code) as Partial<DomainProfileDefaults> | null;
      return resolveDomainProfile(profile.code, override ?? undefined) ?? profile;
    });
    return { items: resolved };
  }

  /** Phase 11: returns the resolved domain profile for a single code. */
  async getDomainProfileForCode(tenantId: string | null, code: string) {
    const tid = requireTenantId(tenantId);
    const normalized = normalizeDomainCode(code);
    const tenantDomain = await this.prisma.assetDomain.findUnique({
      where: { tenantId_code: { tenantId: tid, code: normalized } },
      select: { profile: true }
    });
    const override = (tenantDomain?.profile as Partial<DomainProfileDefaults> | null) ?? undefined;
    const profile = resolveDomainProfile(normalized, override);
    if (!profile) {
      throw new NotFoundException(`No domain profile found for code: ${code}`);
    }
    return profile;
  }

  /** Phase 11: merges partial profile overrides into AssetDomain.profile Json field. Audited. */
  async updateDomainProfile(
    tenantId: string | null,
    domainId: string,
    profilePartial: Partial<DomainProfileDefaults>,
    actor?: Actor
  ) {
    const tid = requireTenantId(tenantId);
    const current = await this.requireDomain(tid, domainId);
    const existing = (current.profile as Partial<DomainProfileDefaults> | null) ?? {};
    const merged: Partial<DomainProfileDefaults> = { ...existing, ...profilePartial };
    const updated = await this.prisma.assetDomain.update({
      where: { id: domainId },
      data: { profile: merged as Prisma.InputJsonValue }
    });
    await writeAuditTrail(this.prisma, {
      entity: "AssetDomain",
      entityId: domainId,
      action: AuditAction.UPDATE,
      module: "asset-taxonomy",
      actor: asAuditActor(actor),
      beforeData: { profile: existing } as Prisma.InputJsonValue,
      afterData: { profile: merged } as Prisma.InputJsonValue
    });
    return {
      ...updated,
      resolvedProfile: resolveDomainProfile(
        updated.code,
        merged as Partial<DomainProfileDefaults>
      )
    };
  }

  async createDomain(tenantId: string | null, dto: CreateAssetDomainDto, actor?: Actor) {
    const tid = requireTenantId(tenantId);
    const code = normalizeCode(dto.code);
    try {
      const row = await this.prisma.assetDomain.create({
        data: {
          tenantId: tid,
          code,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          sortOrder: dto.sortOrder ?? 0
        }
      });
      await writeAuditTrail(this.prisma, {
        entity: "AssetDomain",
        entityId: row.id,
        action: AuditAction.CREATE,
        module: "asset-taxonomy",
        actor: asAuditActor(actor),
        afterData: row as unknown as Prisma.InputJsonValue
      });
      return row;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("Domain code already exists for this organization");
      }
      throw error;
    }
  }

  async updateDomain(
    tenantId: string | null,
    id: string,
    dto: UpdateAssetDomainDto,
    actor?: Actor
  ) {
    const tid = requireTenantId(tenantId);
    const current = await this.requireDomain(tid, id);
    if (dto.isActive === false) {
      const activeAssets = await this.prisma.asset.count({
        where: { tenantId: tid, domainId: id, isActive: true, archivedAt: null }
      });
      // Soft-deactivate only — never hard-delete referenced domains
      if (activeAssets > 0 && dto.isActive === false) {
        // Allowed: inactive masters stay visible on historical assets
      }
    }

    const updated = await this.prisma.assetDomain.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        code: dto.code ? normalizeCode(dto.code) : undefined
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "AssetDomain",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "asset-taxonomy",
      actor: asAuditActor(actor),
      beforeData: current as unknown as Prisma.InputJsonValue,
      afterData: updated as unknown as Prisma.InputJsonValue
    });
    return updated;
  }

  async deactivateDomain(tenantId: string | null, id: string, actor?: Actor) {
    return this.updateDomain(tenantId, id, { isActive: false }, actor);
  }

  async listCategories(tenantId: string | null, query: TaxonomyListQueryDto = {}) {
    const tid = requireTenantId(tenantId);
    const q = query.q?.trim();
    const items = await this.prisma.assetCategoryMaster.findMany({
      where: {
        tenantId: tid,
        domainId: query.domainId,
        isActive: query.includeInactive ? undefined : true,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: [{ name: "asc" }],
      include: {
        domain: { select: { id: true, code: true, name: true, isActive: true } },
        _count: { select: { types: true, assets: true } }
      }
    });
    return { items };
  }

  async createCategory(tenantId: string | null, dto: CreateAssetCategoryMasterDto, actor?: Actor) {
    const tid = requireTenantId(tenantId);
    const domain = await this.requireDomain(tid, dto.domainId);
    if (!domain.isActive) {
      throw new BadRequestException("Cannot create category under inactive domain");
    }
    try {
      const row = await this.prisma.assetCategoryMaster.create({
        data: {
          tenantId: tid,
          domainId: domain.id,
          code: normalizeCode(dto.code),
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          legacyEnum: dto.legacyEnum ?? null
        }
      });
      await writeAuditTrail(this.prisma, {
        entity: "AssetCategoryMaster",
        entityId: row.id,
        action: AuditAction.CREATE,
        module: "asset-taxonomy",
        actor: asAuditActor(actor),
        afterData: row as unknown as Prisma.InputJsonValue
      });
      return row;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("Category code already exists under this domain");
      }
      throw error;
    }
  }

  async updateCategory(
    tenantId: string | null,
    id: string,
    dto: UpdateAssetCategoryMasterDto,
    actor?: Actor
  ) {
    const tid = requireTenantId(tenantId);
    const current = await this.requireCategory(tid, id);
    if (dto.domainId && dto.domainId !== current.domainId) {
      await this.requireDomain(tid, dto.domainId);
    }
    const updated = await this.prisma.assetCategoryMaster.update({
      where: { id },
      data: {
        domainId: dto.domainId,
        code: dto.code ? normalizeCode(dto.code) : undefined,
        name: dto.name?.trim(),
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
        legacyEnum: dto.legacyEnum,
        isActive: dto.isActive
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "AssetCategoryMaster",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "asset-taxonomy",
      actor: asAuditActor(actor),
      beforeData: current as unknown as Prisma.InputJsonValue,
      afterData: updated as unknown as Prisma.InputJsonValue
    });
    return updated;
  }

  async listTypes(tenantId: string | null, query: TaxonomyListQueryDto = {}) {
    const tid = requireTenantId(tenantId);
    const q = query.q?.trim();
    const items = await this.prisma.assetTypeMaster.findMany({
      where: {
        tenantId: tid,
        categoryId: query.categoryId,
        isActive: query.includeInactive ? undefined : true,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: [{ name: "asc" }],
      include: {
        category: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
            domainId: true,
            domain: { select: { id: true, code: true, name: true, isActive: true } }
          }
        },
        _count: { select: { attributeDefinitions: true, assets: true } }
      }
    });
    return { items };
  }

  async createType(tenantId: string | null, dto: CreateAssetTypeMasterDto, actor?: Actor) {
    const tid = requireTenantId(tenantId);
    const category = await this.requireCategory(tid, dto.categoryId);
    if (!category.isActive) {
      throw new BadRequestException("Cannot create type under inactive category");
    }
    try {
      const row = await this.prisma.assetTypeMaster.create({
        data: {
          tenantId: tid,
          categoryId: category.id,
          code: normalizeCode(dto.code),
          name: dto.name.trim(),
          description: dto.description?.trim() || null
        }
      });
      await writeAuditTrail(this.prisma, {
        entity: "AssetTypeMaster",
        entityId: row.id,
        action: AuditAction.CREATE,
        module: "asset-taxonomy",
        actor: asAuditActor(actor),
        afterData: row as unknown as Prisma.InputJsonValue
      });
      return row;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("Type code already exists under this category");
      }
      throw error;
    }
  }

  async updateType(
    tenantId: string | null,
    id: string,
    dto: UpdateAssetTypeMasterDto,
    actor?: Actor
  ) {
    const tid = requireTenantId(tenantId);
    const current = await this.requireType(tid, id);
    if (dto.categoryId && dto.categoryId !== current.categoryId) {
      await this.requireCategory(tid, dto.categoryId);
    }
    const updated = await this.prisma.assetTypeMaster.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        code: dto.code ? normalizeCode(dto.code) : undefined,
        name: dto.name?.trim(),
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
        isActive: dto.isActive
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "AssetTypeMaster",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "asset-taxonomy",
      actor: asAuditActor(actor),
      beforeData: current as unknown as Prisma.InputJsonValue,
      afterData: updated as unknown as Prisma.InputJsonValue
    });
    return updated;
  }

  async listAttributeDefinitions(tenantId: string | null, query: TaxonomyListQueryDto = {}) {
    const tid = requireTenantId(tenantId);
    const items = await this.prisma.assetAttributeDefinition.findMany({
      where: {
        tenantId: tid,
        typeMasterId: query.typeMasterId,
        isActive: query.includeInactive ? undefined : true
      },
      orderBy: [{ displayOrder: "asc" }, { label: "asc" }]
    });
    return { items };
  }

  async createAttributeDefinition(
    tenantId: string | null,
    dto: CreateAttributeDefinitionDto,
    actor?: Actor
  ) {
    const tid = requireTenantId(tenantId);
    await this.requireType(tid, dto.typeMasterId);
    try {
      const row = await this.prisma.assetAttributeDefinition.create({
        data: {
          tenantId: tid,
          typeMasterId: dto.typeMasterId,
          key: dto.key.trim(),
          label: dto.label.trim(),
          dataType: dto.dataType,
          unit: dto.unit?.trim() || null,
          required: dto.required ?? false,
          options: dto.options ?? [],
          minValue: dto.minValue ?? null,
          maxValue: dto.maxValue ?? null,
          displayOrder: dto.displayOrder ?? 0
        }
      });
      await writeAuditTrail(this.prisma, {
        entity: "AssetAttributeDefinition",
        entityId: row.id,
        action: AuditAction.CREATE,
        module: "asset-taxonomy",
        actor: asAuditActor(actor),
        afterData: row as unknown as Prisma.InputJsonValue
      });
      return row;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("Attribute key already exists for this type");
      }
      throw error;
    }
  }

  async updateAttributeDefinition(
    tenantId: string | null,
    id: string,
    dto: UpdateAttributeDefinitionDto,
    actor?: Actor
  ) {
    const tid = requireTenantId(tenantId);
    const current = await this.prisma.assetAttributeDefinition.findFirst({
      where: { id, tenantId: tid }
    });
    if (!current) throw new NotFoundException("Attribute definition not found");

    const updated = await this.prisma.assetAttributeDefinition.update({
      where: { id },
      data: {
        key: dto.key?.trim(),
        label: dto.label?.trim(),
        dataType: dto.dataType,
        unit: dto.unit === undefined ? undefined : dto.unit?.trim() || null,
        required: dto.required,
        options: dto.options,
        minValue: dto.minValue,
        maxValue: dto.maxValue,
        displayOrder: dto.displayOrder,
        isActive: dto.isActive
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "AssetAttributeDefinition",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "asset-taxonomy",
      actor: asAuditActor(actor),
      beforeData: current as unknown as Prisma.InputJsonValue,
      afterData: updated as unknown as Prisma.InputJsonValue
    });
    return updated;
  }

  /** Hard delete blocked when referenced — use deactivate instead */
  async assertCanHardDeleteDomain(tenantId: string | null, id: string) {
    const tid = requireTenantId(tenantId);
    await this.requireDomain(tid, id);
    const [assets, categories] = await Promise.all([
      this.prisma.asset.count({ where: { tenantId: tid, domainId: id } }),
      this.prisma.assetCategoryMaster.count({ where: { tenantId: tid, domainId: id } })
    ]);
    if (assets > 0 || categories > 0) {
      throw new BadRequestException(
        "Referenced domain cannot be deleted — deactivate instead"
      );
    }
    return { ok: true };
  }

  private async requireDomain(tenantId: string, id: string) {
    const row = await this.prisma.assetDomain.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Asset domain not found");
    return row;
  }

  private async requireCategory(tenantId: string, id: string) {
    const row = await this.prisma.assetCategoryMaster.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Asset category not found");
    return row;
  }

  private async requireType(tenantId: string, id: string) {
    const row = await this.prisma.assetTypeMaster.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Asset type not found");
    return row;
  }
}
