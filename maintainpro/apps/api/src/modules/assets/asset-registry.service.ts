import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import {
  ApprovalProcessType,
  ApprovalRequestStatus,
  ApprovalTrigger,
  AssetCriticality,
  AssetStatus,
  AuditAction,
  Prisma
} from "@prisma/client";

import { formatLocationPathLabel, buildLocationPath } from "../organization/location-hierarchy";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import { ApprovalsService } from "../approvals/approvals.service";
import { assertNoAssetHierarchyCycle } from "./asset-hierarchy";
import { validateCustomAttributes } from "../asset-taxonomy/attribute-validation";
import { mapLegacyAssetCategory } from "../asset-taxonomy/legacy-category-map";

const OPEN_WORK_ORDER_STATUSES = [
  "OPEN",
  "PLANNED",
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "TECHNICIAN_COMPLETED",
  "REWORK_REQUIRED",
  "VERIFIED",
  "OVERDUE"
] as const;
const TERMINAL_STATUSES: AssetStatus[] = [AssetStatus.RETIRED, AssetStatus.DISPOSED];

export type MoveAssetInput = {
  toSiteId: string;
  toFunctionalLocationId: string;
  reason: string;
  effectiveAt?: string;
};

export type RetireAssetInput = {
  reason: string;
  retiredAt?: string;
};

export type DisposeAssetInput = {
  reason: string;
  disposalDate?: string;
};

@Injectable()
export class AssetRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly approvalsService?: ApprovalsService
  ) {}

  async resolveLocationPath(tenantId: string, functionalLocationId: string | null | undefined) {
    if (!functionalLocationId) return null;
    const locations = await this.prisma.functionalLocation.findMany({
      where: { tenantId },
      select: { id: true, parentId: true, name: true, siteId: true, code: true, type: true }
    });
    const byId = new Map(
      locations.map((l) => [
        l.id,
        {
          id: l.id,
          parentId: l.parentId,
          name: l.name,
          code: l.code,
          type: l.type
        }
      ])
    );
    const target = byId.get(functionalLocationId);
    if (!target) return null;
    const site = await this.prisma.site.findFirst({
      where: { id: locations.find((l) => l.id === functionalLocationId)?.siteId, tenantId },
      select: { id: true, name: true, code: true }
    });
    const pathNodes = buildLocationPath(functionalLocationId, byId);
    const locationLabel = formatLocationPathLabel(pathNodes);
    return {
      siteId: site?.id ?? null,
      siteName: site?.name ?? null,
      siteCode: site?.code ?? null,
      functionalLocationId,
      path: site?.name ? `${site.name} / ${locationLabel}` : locationLabel,
      nodes: pathNodes
    };
  }

  async validateSiteAndLocation(
    tenantId: string,
    siteId: string | null | undefined,
    functionalLocationId: string | null | undefined,
    options: { requireActive?: boolean } = {}
  ) {
    const requireActive = options.requireActive ?? true;
    if (!siteId && !functionalLocationId) return { siteId: null, functionalLocationId: null };

    if (functionalLocationId && !siteId) {
      throw new BadRequestException("siteId is required when functionalLocationId is set");
    }
    if (siteId) {
      const site = await this.prisma.site.findFirst({
        where: { id: siteId, tenantId }
      });
      if (!site) throw new BadRequestException("Site not found for this organization");
      if (requireActive && !site.isActive) {
        throw new BadRequestException("Inactive site cannot be assigned to new assets");
      }
    }
    if (functionalLocationId) {
      const location = await this.prisma.functionalLocation.findFirst({
        where: { id: functionalLocationId, tenantId }
      });
      if (!location) {
        throw new BadRequestException("Functional location not found for this organization");
      }
      if (requireActive && !location.isActive) {
        throw new BadRequestException("Inactive functional location cannot be assigned");
      }
      if (siteId && location.siteId !== siteId) {
        throw new BadRequestException("Functional location does not belong to the selected site");
      }
    }
    return { siteId: siteId ?? null, functionalLocationId: functionalLocationId ?? null };
  }

  async validateTaxonomy(
    tenantId: string,
    input: {
      domainId?: string | null;
      categoryMasterId?: string | null;
      typeMasterId?: string | null;
      requireActive?: boolean;
    }
  ) {
    const requireActive = input.requireActive ?? true;
    let domainId = input.domainId ?? null;
    let categoryMasterId = input.categoryMasterId ?? null;
    let typeMasterId = input.typeMasterId ?? null;

    if (typeMasterId) {
      const type = await this.prisma.assetTypeMaster.findFirst({
        where: { id: typeMasterId, tenantId },
        include: { category: true }
      });
      if (!type) throw new BadRequestException("Asset type not found for this organization");
      if (requireActive && !type.isActive) {
        throw new BadRequestException("Inactive asset type cannot be assigned");
      }
      if (categoryMasterId && categoryMasterId !== type.categoryId) {
        throw new BadRequestException("Asset type does not belong to the selected category");
      }
      categoryMasterId = type.categoryId;
      if (domainId && domainId !== type.category.domainId) {
        throw new BadRequestException("Asset category does not belong to the selected domain");
      }
      domainId = type.category.domainId;
    }

    if (categoryMasterId) {
      const category = await this.prisma.assetCategoryMaster.findFirst({
        where: { id: categoryMasterId, tenantId }
      });
      if (!category) throw new BadRequestException("Asset category not found for this organization");
      if (requireActive && !category.isActive) {
        throw new BadRequestException("Inactive asset category cannot be assigned");
      }
      if (domainId && domainId !== category.domainId) {
        throw new BadRequestException("Asset category does not belong to the selected domain");
      }
      domainId = category.domainId;
    }

    if (domainId) {
      const domain = await this.prisma.assetDomain.findFirst({
        where: { id: domainId, tenantId }
      });
      if (!domain) throw new BadRequestException("Asset domain not found for this organization");
      if (requireActive && !domain.isActive) {
        throw new BadRequestException("Inactive asset domain cannot be assigned");
      }
    }

    return { domainId, categoryMasterId, typeMasterId };
  }

  async validateAndNormalizeAttributes(
    tenantId: string,
    typeMasterId: string | null | undefined,
    customAttributes: Record<string, unknown> | null | undefined,
    options: { allowPartial?: boolean } = {}
  ) {
    if (!typeMasterId) {
      if (customAttributes && Object.keys(customAttributes).length > 0) {
        throw new BadRequestException("customAttributes require a typeMasterId");
      }
      return null;
    }
    const definitions = await this.prisma.assetAttributeDefinition.findMany({
      where: { tenantId, typeMasterId }
    });
    return validateCustomAttributes(definitions, customAttributes, options);
  }

  async moveAsset(
    tenantId: string | null | undefined,
    assetId: string,
    actorId: string,
    input: MoveAssetInput
  ) {
    const tid = requireTenantId(tenantId);
    const reason = input.reason?.trim();
    if (!reason) throw new BadRequestException("Movement reason is required");

    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, tenantId: tid } });
    if (!asset) throw new NotFoundException("Asset not found");
    if (TERMINAL_STATUSES.includes(asset.status) || asset.archivedAt) {
      throw new BadRequestException("Retired or disposed assets cannot be moved");
    }

    await this.validateSiteAndLocation(tid, input.toSiteId, input.toFunctionalLocationId, {
      requireActive: true
    });

    const history = await this.prisma.assetLocationHistory.create({
      data: {
        tenantId: tid,
        assetId,
        fromSiteId: asset.siteId,
        fromFunctionalLocationId: asset.functionalLocationId,
        toSiteId: input.toSiteId,
        toFunctionalLocationId: input.toFunctionalLocationId,
        effectiveAt: input.effectiveAt ? new Date(input.effectiveAt) : new Date(),
        reason,
        movedById: actorId
      }
    });

    const updated = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        siteId: input.toSiteId,
        functionalLocationId: input.toFunctionalLocationId
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: tid,
        actorId,
        entity: "ASSET",
        entityId: assetId,
        action: AuditAction.UPDATE,
        beforeData: {
          siteId: asset.siteId,
          functionalLocationId: asset.functionalLocationId
        } as Prisma.InputJsonValue,
        afterData: {
          siteId: updated.siteId,
          functionalLocationId: updated.functionalLocationId,
          movementId: history.id,
          reason
        } as Prisma.InputJsonValue
      }
    });

    return { asset: updated, history };
  }

  async listMovementHistory(tenantId: string | null | undefined, assetId: string) {
    const tid = requireTenantId(tenantId);
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId: tid },
      select: { id: true }
    });
    if (!asset) throw new NotFoundException("Asset not found");

    const items = await this.prisma.assetLocationHistory.findMany({
      where: { tenantId: tid, assetId },
      orderBy: { effectiveAt: "desc" }
    });
    return { items };
  }

  async setParent(
    tenantId: string | null | undefined,
    assetId: string,
    actorId: string,
    parentAssetId: string | null
  ) {
    const tid = requireTenantId(tenantId);
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, tenantId: tid } });
    if (!asset) throw new NotFoundException("Asset not found");

    if (parentAssetId) {
      const parent = await this.prisma.asset.findFirst({
        where: { id: parentAssetId, tenantId: tid }
      });
      if (!parent) throw new BadRequestException("Parent asset not found for this organization");
      await assertNoAssetHierarchyCycle({
        assetId,
        parentAssetId,
        loadParentId: async (id) => {
          const row = await this.prisma.asset.findFirst({
            where: { id, tenantId: tid },
            select: { parentAssetId: true }
          });
          return row?.parentAssetId;
        }
      });
    }

    const updated = await this.prisma.asset.update({
      where: { id: assetId },
      data: { parentAssetId }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: tid,
        actorId,
        entity: "ASSET",
        entityId: assetId,
        action: AuditAction.UPDATE,
        beforeData: { parentAssetId: asset.parentAssetId } as Prisma.InputJsonValue,
        afterData: { parentAssetId } as Prisma.InputJsonValue
      }
    });

    return updated;
  }

  async listChildren(tenantId: string | null | undefined, assetId: string) {
    const tid = requireTenantId(tenantId);
    const parent = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId: tid },
      select: { id: true }
    });
    if (!parent) throw new NotFoundException("Asset not found");
    const items = await this.prisma.asset.findMany({
      where: { tenantId: tid, parentAssetId: assetId },
      orderBy: { assetTag: "asc" },
      select: {
        id: true,
        assetTag: true,
        name: true,
        status: true,
        condition: true,
        criticalityLevel: true,
        isActive: true
      }
    });
    return { items };
  }

  async retire(
    tenantId: string | null | undefined,
    assetId: string,
    actorId: string,
    input: RetireAssetInput,
    actor?: { sub: string; role?: string; tenantId?: string | null; permissions?: string[] }
  ) {
    const tid = requireTenantId(tenantId);
    const reason = input.reason?.trim();
    if (!reason) throw new BadRequestException("Retirement reason is required");

    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, tenantId: tid } });
    if (!asset) throw new NotFoundException("Asset not found");
    if (asset.status === AssetStatus.DISPOSED) {
      throw new BadRequestException("Disposed assets cannot be retired");
    }

    // Technical integrity checks cannot be bypassed by approval success alone.
    const openWorkOrders = await this.prisma.workOrder.count({
      where: { assetId, status: { in: [...OPEN_WORK_ORDER_STATUSES] } }
    });
    if (openWorkOrders > 0) {
      throw new BadRequestException("Cannot retire asset with open work orders");
    }

    const activeChildren = await this.prisma.asset.count({
      where: {
        tenantId: tid,
        parentAssetId: assetId,
        isActive: true,
        status: { notIn: TERMINAL_STATUSES },
        archivedAt: null
      }
    });
    if (activeChildren > 0) {
      throw new BadRequestException("Cannot retire parent while active child assets remain");
    }

    if (this.approvalsService && actor?.sub) {
      const ensure = await this.approvalsService.ensureApprovalRequired({
        actor,
        processType: ApprovalProcessType.ASSET_RETIREMENT,
        trigger: ApprovalTrigger.BEFORE_RETIRE,
        subjectEntityType: "Asset",
        subjectEntityId: assetId,
        context: {
          processType: ApprovalProcessType.ASSET_RETIREMENT,
          siteId: asset.siteId,
          departmentId: asset.departmentId,
          domainId: asset.domainId,
          status: asset.status
        },
        sourceContext: { reason, retiredAt: input.retiredAt ?? null }
      });
      if (ensure.configError) {
        throw new BadRequestException(ensure.configError);
      }
      if (ensure.required && ensure.status !== ApprovalRequestStatus.APPROVED) {
        throw new BadRequestException({
          message:
            "Asset retirement requires approval. Retirement completes when the approval is granted.",
          code: "APPROVAL_REQUIRED",
          approvalRequestId: ensure.approvalRequestId,
          processType: ApprovalProcessType.ASSET_RETIREMENT
        });
      }
    }

    const updated = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        status: AssetStatus.RETIRED,
        retiredAt: input.retiredAt ? new Date(input.retiredAt) : new Date(),
        retirementReason: reason,
        isActive: false
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: tid,
        actorId,
        entity: "ASSET",
        entityId: assetId,
        action: AuditAction.UPDATE,
        beforeData: { status: asset.status } as Prisma.InputJsonValue,
        afterData: {
          status: updated.status,
          retiredAt: updated.retiredAt,
          retirementReason: reason
        } as Prisma.InputJsonValue
      }
    });

    return updated;
  }

  async dispose(
    tenantId: string | null | undefined,
    assetId: string,
    actorId: string,
    input: DisposeAssetInput
  ) {
    const tid = requireTenantId(tenantId);
    const reason = input.reason?.trim();
    if (!reason) throw new BadRequestException("Disposal reason is required");

    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, tenantId: tid } });
    if (!asset) throw new NotFoundException("Asset not found");
    if (asset.status === AssetStatus.UNDER_MAINTENANCE) {
      throw new BadRequestException("Cannot dispose an asset that is UNDER_MAINTENANCE");
    }

    const updated = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        status: AssetStatus.DISPOSED,
        disposalDate: input.disposalDate ? new Date(input.disposalDate) : new Date(),
        disposalReason: reason,
        isActive: false
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: tid,
        actorId,
        entity: "ASSET",
        entityId: assetId,
        action: AuditAction.UPDATE,
        beforeData: { status: asset.status } as Prisma.InputJsonValue,
        afterData: {
          status: updated.status,
          disposalDate: updated.disposalDate,
          disposalReason: reason
        } as Prisma.InputJsonValue
      }
    });

    return updated;
  }

  async linkVehicle(
    tenantId: string | null | undefined,
    vehicleId: string,
    assetId: string,
    actorId: string
  ) {
    const tid = requireTenantId(tenantId);
    const [vehicle, asset] = await Promise.all([
      this.prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId: tid } }),
      this.prisma.asset.findFirst({ where: { id: assetId, tenantId: tid } })
    ]);
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    if (!asset) throw new NotFoundException("Asset not found");

    const existingLink = await this.prisma.vehicle.findFirst({
      where: { assetId, id: { not: vehicleId } }
    });
    if (existingLink) {
      throw new BadRequestException("Asset is already linked to another vehicle");
    }
    if (vehicle.assetId && vehicle.assetId !== assetId) {
      throw new BadRequestException("Vehicle is already linked to a different asset");
    }

    const updated = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        assetId,
        // Preserve soft assetTag compatibility when empty
        assetTag: vehicle.assetTag || asset.assetTag
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: tid,
        actorId,
        entity: "VEHICLE",
        entityId: vehicleId,
        action: AuditAction.UPDATE,
        beforeData: { assetId: vehicle.assetId } as Prisma.InputJsonValue,
        afterData: { assetId } as Prisma.InputJsonValue
      }
    });

    return updated;
  }

  async dataQualityReport(tenantId: string | null | undefined) {
    const tid = requireTenantId(tenantId);
    const assets = await this.prisma.asset.findMany({
      where: { tenantId: tid, archivedAt: null },
      select: {
        id: true,
        assetTag: true,
        name: true,
        status: true,
        criticalityLevel: true,
        siteId: true,
        functionalLocationId: true,
        departmentId: true,
        location: true,
        serialNumber: true,
        domainId: true,
        categoryMasterId: true,
        typeMasterId: true,
        category: true,
        parentAssetId: true,
        isActive: true
      }
    });

    const serialCounts = new Map<string, number>();
    for (const asset of assets) {
      const serial = asset.serialNumber?.trim().toLowerCase();
      if (!serial) continue;
      serialCounts.set(serial, (serialCounts.get(serial) ?? 0) + 1);
    }

    const vehiclesWithoutAsset = await this.prisma.vehicle.count({
      where: { tenantId: tid, assetId: null }
    });

    const issues = {
      missingCriticality: assets.filter(
        (a) => a.isActive && a.status === AssetStatus.ACTIVE && !a.criticalityLevel
      ).length,
      missingSite: assets.filter((a) => a.isActive && !a.siteId).length,
      missingFunctionalLocation: assets.filter((a) => a.isActive && !a.functionalLocationId).length,
      missingDepartment: assets.filter((a) => a.isActive && !a.departmentId).length,
      unresolvedLegacyLocation: assets.filter(
        (a) => Boolean(a.location?.trim()) && (!a.siteId || !a.functionalLocationId)
      ).length,
      missingTaxonomy: assets.filter((a) => a.isActive && (!a.domainId || !a.categoryMasterId)).length,
      duplicateSerial: [...serialCounts.values()].filter((c) => c > 1).length,
      retiredWithActiveChildren: 0,
      vehiclesWithoutAssetLink: vehiclesWithoutAsset
    };

    const retiredParents = assets.filter((a) => a.status === AssetStatus.RETIRED);
    for (const parent of retiredParents) {
      const childCount = assets.filter(
        (c) =>
          c.parentAssetId === parent.id &&
          c.isActive &&
          c.status !== AssetStatus.RETIRED &&
          c.status !== AssetStatus.DISPOSED
      ).length;
      if (childCount > 0) issues.retiredWithActiveChildren += 1;
    }

    return { counts: issues, sampleSize: assets.length };
  }

  async backfillLegacyCategories(
    tenantId: string | null | undefined,
    options: { dryRun?: boolean } = {}
  ) {
    const tid = requireTenantId(tenantId);
    const dryRun = options.dryRun ?? true;
    const assets = await this.prisma.asset.findMany({
      where: {
        tenantId: tid,
        OR: [{ domainId: null }, { categoryMasterId: null }]
      },
      select: { id: true, assetTag: true, category: true, domainId: true, categoryMasterId: true }
    });

    const report = { mapped: 0, skipped: 0, ambiguous: 0, failed: 0, details: [] as Array<Record<string, unknown>> };

    for (const asset of assets) {
      const mapping = mapLegacyAssetCategory(asset.category);
      const domain = await this.prisma.assetDomain.findUnique({
        where: { tenantId_code: { tenantId: tid, code: mapping.domainCode } }
      });
      const category = domain
        ? await this.prisma.assetCategoryMaster.findFirst({
            where: { tenantId: tid, domainId: domain.id, code: mapping.categoryCode }
          })
        : null;

      if (!domain || !category) {
        report.failed += 1;
        report.details.push({
          assetId: asset.id,
          assetTag: asset.assetTag,
          status: "failed",
          reason: "Master domain/category not seeded",
          mapping
        });
        continue;
      }

      if (mapping.ambiguous) {
        report.ambiguous += 1;
        report.details.push({
          assetId: asset.id,
          assetTag: asset.assetTag,
          status: "ambiguous",
          mapping
        });
      }

      if (!dryRun) {
        await this.prisma.asset.update({
          where: { id: asset.id },
          data: {
            domainId: asset.domainId ?? domain.id,
            categoryMasterId: asset.categoryMasterId ?? category.id
          }
        });
      }
      report.mapped += 1;
    }

    return { dryRun, ...report };
  }

  mapCriticalityFromLegacy(value: string | null | undefined): AssetCriticality | null {
    if (!value) return null;
    const normalized = value.trim().toUpperCase();
    if (normalized === "LOW" || normalized === "STANDARD") return AssetCriticality.LOW;
    if (normalized === "MEDIUM" || normalized === "PRODUCTION") return AssetCriticality.MEDIUM;
    if (normalized === "HIGH" || normalized === "SAFETY") return AssetCriticality.HIGH;
    if (normalized === "CRITICAL") return AssetCriticality.CRITICAL;
    // Do not invent CRITICAL for unknown legacy strings
    return null;
  }
}
