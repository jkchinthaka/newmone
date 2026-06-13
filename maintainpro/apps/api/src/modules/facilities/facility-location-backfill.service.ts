import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../../database/prisma.service";
import {
  matchCleaningLocationsToRooms,
  type CleaningLocationMatchInput,
  type FacilityLocationBackfillSummary,
  type RoomHierarchyMatchInput
} from "./facility-location-backfill.matcher";

export type FacilityLocationBackfillOptions = {
  tenantId?: string;
  apply?: boolean;
};

@Injectable()
export class FacilityLocationBackfillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  isApplyAllowed(): boolean {
    return this.configService.get<boolean>("ALLOW_FACILITY_BACKFILL_APPLY", false);
  }

  async run(options: FacilityLocationBackfillOptions = {}): Promise<FacilityLocationBackfillSummary> {
    const dryRun = options.apply !== true;
    const applyEnabled = this.isApplyAllowed();
    const tenantFilter = options.tenantId?.trim();

    const cleaningLocations = await this.prisma.cleaningLocation.findMany({
      where: tenantFilter ? { tenantId: tenantFilter } : undefined,
      select: {
        id: true,
        tenantId: true,
        name: true,
        area: true,
        building: true,
        floor: true
      },
      orderBy: [{ name: "asc" }]
    });

    const rooms = await this.prisma.room.findMany({
      where: tenantFilter ? { tenantId: tenantFilter } : undefined,
      select: {
        id: true,
        tenantId: true,
        name: true,
        code: true,
        floor: {
          select: {
            name: true,
            levelNumber: true,
            building: {
              select: {
                name: true,
                code: true
              }
            }
          }
        }
      }
    });

    const locationInputs: CleaningLocationMatchInput[] = cleaningLocations.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      area: row.area,
      building: row.building,
      floor: row.floor
    }));

    const roomInputs: RoomHierarchyMatchInput[] = rooms.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      code: row.code,
      floor: row.floor
    }));

    const rows = matchCleaningLocationsToRooms(locationInputs, roomInputs);
    const exactRows = rows.filter((row) => row.confidence === "exact" && row.candidateRoomId);

    let issuesEligibleForApply = 0;
    let issuesUpdated = 0;

    if (!dryRun) {
      if (!applyEnabled) {
        throw new Error(
          "Apply mode blocked. Set ALLOW_FACILITY_BACKFILL_APPLY=true and pass --apply explicitly."
        );
      }

      for (const row of exactRows) {
        if (!row.candidateRoomId) {
          continue;
        }

        const eligibleIssues = await this.prisma.facilityIssue.findMany({
          where: {
            locationId: row.cleaningLocationId,
            roomId: null,
            ...(tenantFilter ? { tenantId: tenantFilter } : {})
          },
          select: { id: true }
        });

        issuesEligibleForApply += eligibleIssues.length;

        if (eligibleIssues.length === 0) {
          continue;
        }

        const updateResult = await this.prisma.facilityIssue.updateMany({
          where: {
            id: { in: eligibleIssues.map((issue) => issue.id) },
            roomId: null
          },
          data: {
            roomId: row.candidateRoomId
          }
        });

        issuesUpdated += updateResult.count;
      }
    } else {
      for (const row of exactRows) {
        const eligibleCount = await this.prisma.facilityIssue.count({
          where: {
            locationId: row.cleaningLocationId,
            roomId: null,
            ...(tenantFilter ? { tenantId: tenantFilter } : {})
          }
        });
        issuesEligibleForApply += eligibleCount;
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      tenantId: tenantFilter ?? null,
      dryRun,
      applyEnabled,
      totals: {
        cleaningLocationCount: rows.length,
        exactCount: rows.filter((row) => row.confidence === "exact").length,
        likelyCount: rows.filter((row) => row.confidence === "likely").length,
        ambiguousCount: rows.filter((row) => row.confidence === "ambiguous").length,
        noneCount: rows.filter((row) => row.confidence === "none").length,
        issuesEligibleForApply,
        issuesUpdated
      },
      rows
    };
  }
}
