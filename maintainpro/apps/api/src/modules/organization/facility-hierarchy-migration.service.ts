import { Injectable } from "@nestjs/common";
import { FunctionalLocationType, SiteType } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { normalizeLocationCode, slugifyCodeSegment } from "./location-hierarchy";

export type FacilityHierarchyMigrationReport = {
  tenantId: string;
  dryRun: boolean;
  propertiesMapped: number;
  buildingsMapped: number;
  floorsMapped: number;
  roomsMapped: number;
  skippedExisting: number;
  unresolved: Array<{ kind: string; id: string; reason: string }>;
};

/**
 * Deterministic, idempotent Property→Building→Floor→Room → Site/FunctionalLocation bridge.
 * Does not delete legacy records. Re-runs skip rows already linked via legacy*Id.
 */
@Injectable()
export class FacilityHierarchyMigrationService {
  constructor(private readonly prisma: PrismaService) {}

  async migrateTenant(tenantId: string | null, options: { dryRun?: boolean } = {}): Promise<FacilityHierarchyMigrationReport> {
    const tid = requireTenantId(tenantId);
    const dryRun = options.dryRun !== false;

    const report: FacilityHierarchyMigrationReport = {
      tenantId: tid,
      dryRun,
      propertiesMapped: 0,
      buildingsMapped: 0,
      floorsMapped: 0,
      roomsMapped: 0,
      skippedExisting: 0,
      unresolved: []
    };

    const properties = await this.prisma.property.findMany({
      where: { tenantId: tid },
      include: {
        buildings: {
          include: {
            floors: {
              include: { rooms: true }
            }
          }
        }
      },
      orderBy: { code: "asc" }
    });

    for (const property of properties) {
      const existingSite = await this.prisma.site.findFirst({
        where: { tenantId: tid, legacyPropertyId: property.id }
      });

      let siteId = existingSite?.id;
      if (existingSite) {
        report.skippedExisting += 1;
      } else {
        const code = await this.ensureUniqueSiteCode(tid, property.code);
        if (!dryRun) {
          const site = await this.prisma.site.create({
            data: {
              tenantId: tid,
              code,
              name: property.name,
              type: SiteType.OTHER,
              address: property.address,
              isActive: property.isActive,
              legacyPropertyId: property.id,
              description: "Migrated from legacy Property (Phase 3)"
            }
          });
          siteId = site.id;
        }
        report.propertiesMapped += 1;
      }

      if (!siteId && dryRun) {
        // Dry-run still walks children for counts using a synthetic placeholder site id.
        siteId = `dryrun-site-${property.id}`;
      }
      if (!siteId) {
        continue;
      }

      for (const building of property.buildings) {
        const buildingLoc = await this.migrateNode({
          tid,
          siteId,
          dryRun,
          existingWhere: { tenantId: tid, legacyBuildingId: building.id },
          create: {
            code: await this.ensureUniqueLocationCode(tid, siteId, building.code, dryRun),
            name: building.name,
            type: FunctionalLocationType.BUILDING,
            description: building.description,
            isActive: building.isActive,
            parentId: null,
            legacyBuildingId: building.id
          },
          report,
          counter: "buildingsMapped"
        });

        for (const floor of building.floors) {
          const floorCodeBase =
            floor.levelNumber != null
              ? `${building.code}-L${floor.levelNumber}`
              : `${building.code}-${slugifyCodeSegment(floor.name) || "FLOOR"}`;
          const floorLoc = await this.migrateNode({
            tid,
            siteId,
            dryRun,
            existingWhere: { tenantId: tid, legacyFloorId: floor.id },
            create: {
              code: await this.ensureUniqueLocationCode(tid, siteId, floorCodeBase, dryRun),
              name: floor.name,
              type: FunctionalLocationType.FLOOR,
              description: null,
              isActive: floor.isActive,
              parentId: buildingLoc?.id ?? null,
              legacyFloorId: floor.id
            },
            report,
            counter: "floorsMapped"
          });

          for (const room of floor.rooms) {
            const roomCodeBase =
              room.code?.trim() ||
              `${floorCodeBase}-${slugifyCodeSegment(room.name) || "ROOM"}`;
            await this.migrateNode({
              tid,
              siteId,
              dryRun,
              existingWhere: { tenantId: tid, legacyRoomId: room.id },
              create: {
                code: await this.ensureUniqueLocationCode(tid, siteId, roomCodeBase, dryRun),
                name: room.name,
                type: this.mapRoomType(room.roomType),
                description: null,
                isActive: room.isActive,
                parentId: floorLoc?.id ?? null,
                legacyRoomId: room.id
              },
              report,
              counter: "roomsMapped"
            });
          }
        }
      }
    }

    return report;
  }

  /**
   * Free-text Asset.location is NOT auto-mapped.
   * Returns classification buckets for Data Quality (Phase 12).
   */
  async classifyFreeTextAssetLocations(tenantId: string | null) {
    const tid = requireTenantId(tenantId);
    const assets = await this.prisma.asset.findMany({
      where: { tenantId: tid, location: { not: null } },
      select: { id: true, assetTag: true, name: true, location: true }
    });
    const locations = await this.prisma.functionalLocation.findMany({
      where: { tenantId: tid, isActive: true },
      select: { id: true, code: true, name: true }
    });

    const byCode = new Map(locations.map((l) => [l.code.toUpperCase(), l]));
    const byName = new Map(locations.map((l) => [l.name.trim().toLowerCase(), l]));

    const exact: Array<{ assetId: string; locationId: string; text: string }> = [];
    const ambiguous: Array<{ assetId: string; text: string; reason: string }> = [];
    const missing: Array<{ assetId: string; text: string }> = [];

    for (const asset of assets) {
      const text = asset.location?.trim() ?? "";
      if (!text) {
        missing.push({ assetId: asset.id, text: "" });
        continue;
      }
      const codeHit = byCode.get(text.toUpperCase());
      const nameHits = locations.filter((l) => l.name.trim().toLowerCase() === text.toLowerCase());
      if (codeHit) {
        exact.push({ assetId: asset.id, locationId: codeHit.id, text });
      } else if (nameHits.length === 1) {
        // High-confidence controlled name match — still report, do not write Asset.functionalLocationId in Phase 3.
        exact.push({ assetId: asset.id, locationId: nameHits[0]!.id, text });
      } else if (nameHits.length > 1 || byName.has(text.toLowerCase())) {
        ambiguous.push({ assetId: asset.id, text, reason: "Multiple or ambiguous name matches" });
      } else {
        ambiguous.push({
          assetId: asset.id,
          text,
          reason: "No deterministic FunctionalLocation match — original text retained"
        });
      }
    }

    return {
      tenantId: tid,
      totals: {
        assetsWithText: assets.length,
        exactOrHighConfidence: exact.length,
        ambiguous: ambiguous.length,
        missing: missing.length
      },
      // Phase 4 attaches assets; Phase 3 only classifies.
      note: "Free-text Asset.location is never overwritten in Phase 3.",
      exact,
      ambiguous,
      missing
    };
  }

  private mapRoomType(roomType: string | null | undefined): FunctionalLocationType {
    switch (roomType) {
      case "PLANT_ROOM":
        return FunctionalLocationType.PLANT_ROOM;
      case "STORAGE":
        return FunctionalLocationType.STORAGE_AREA;
      case "OFFICE":
      case "RESTROOM":
      case "CORRIDOR":
      case "LOBBY":
      case "MEETING_ROOM":
        return FunctionalLocationType.ROOM;
      default:
        return FunctionalLocationType.ROOM;
    }
  }

  private async migrateNode(args: {
    tid: string;
    siteId: string;
    dryRun: boolean;
    existingWhere: Record<string, unknown>;
    create: {
      code: string;
      name: string;
      type: FunctionalLocationType;
      description: string | null;
      isActive: boolean;
      parentId: string | null;
      legacyBuildingId?: string;
      legacyFloorId?: string;
      legacyRoomId?: string;
    };
    report: FacilityHierarchyMigrationReport;
    counter: "buildingsMapped" | "floorsMapped" | "roomsMapped";
  }): Promise<{ id: string } | null> {
    const existing = await this.prisma.functionalLocation.findFirst({
      where: args.existingWhere as never
    });
    if (existing) {
      args.report.skippedExisting += 1;
      return { id: existing.id };
    }

    args.report[args.counter] += 1;
    if (args.dryRun) {
      return { id: `dryrun-${args.counter}-${args.create.code}` };
    }

    // Dry-run placeholders must not be used as parent FKs on apply path.
    const parentId =
      args.create.parentId && !args.create.parentId.startsWith("dryrun-")
        ? args.create.parentId
        : null;

    const created = await this.prisma.functionalLocation.create({
      data: {
        tenantId: args.tid,
        siteId: args.siteId.startsWith("dryrun-") ? undefined! : args.siteId,
        parentId,
        code: normalizeLocationCode(args.create.code),
        name: args.create.name,
        type: args.create.type,
        description: args.create.description,
        isActive: args.create.isActive,
        legacyBuildingId: args.create.legacyBuildingId,
        legacyFloorId: args.create.legacyFloorId,
        legacyRoomId: args.create.legacyRoomId
      }
    });
    return { id: created.id };
  }

  private async ensureUniqueSiteCode(tenantId: string, raw: string): Promise<string> {
    let code = normalizeLocationCode(raw || "SITE");
    let suffix = 1;
    while (await this.prisma.site.findFirst({ where: { tenantId, code } })) {
      code = `${normalizeLocationCode(raw)}-${suffix++}`;
    }
    return code;
  }

  private async ensureUniqueLocationCode(
    tenantId: string,
    siteId: string,
    raw: string,
    dryRun: boolean
  ): Promise<string> {
    let code = normalizeLocationCode(raw || "LOC");
    if (dryRun || siteId.startsWith("dryrun-")) {
      return code;
    }
    let suffix = 1;
    while (await this.prisma.functionalLocation.findFirst({ where: { tenantId, siteId, code } })) {
      code = `${normalizeLocationCode(raw)}-${suffix++}`;
    }
    return code;
  }
}
