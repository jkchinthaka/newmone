import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FacilityIssueStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { DuplicateCheckFacilityIssueDto } from "./dto/facility-issue.dto";
import {
  clampDuplicateIssueWindowDays,
  computeDuplicateCombinedTextScore,
  countSharedDuplicateTokens,
  DUPLICATE_ISSUE_MAX_CANDIDATES,
  DuplicateFacilityIssueCheckResult,
  resolveDuplicateIssueConfidence,
  sortDuplicateFacilityIssueCandidates,
  toPublicDuplicateFacilityIssueCandidate
} from "./duplicate-facility-issue.mapper";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DUPLICATE_ISSUE_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  category: true,
  severity: true,
  workOrderId: true,
  createdAt: true,
  location: {
    select: {
      name: true
    }
  },
  room: {
    select: {
      name: true
    }
  }
} as const;

@Injectable()
export class DuplicateFacilityIssueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  getWindowDays(): number {
    return clampDuplicateIssueWindowDays(
      this.configService.get<number>("DUPLICATE_ISSUE_WINDOW_DAYS", 7)
    );
  }

  async checkDuplicates(
    tenantId: string | null,
    dto: DuplicateCheckFacilityIssueDto
  ): Promise<DuplicateFacilityIssueCheckResult> {
    const scopedTenantId = this.requireTenantId(tenantId);
    const windowDays = this.getWindowDays();
    const checkedAt = new Date();

    if (!dto.roomId?.trim() && !dto.locationId?.trim()) {
      return {
        checkedAt: checkedAt.toISOString(),
        windowDays,
        candidates: []
      };
    }

    if (dto.roomId?.trim()) {
      await this.assertActiveRoomForTenant(scopedTenantId, dto.roomId.trim());
    }

    if (dto.locationId?.trim()) {
      await this.assertActiveLocationForTenant(scopedTenantId, dto.locationId.trim());
    }

    const windowStart = new Date(checkedAt.getTime() - windowDays * MS_PER_DAY);
    const where: Prisma.FacilityIssueWhereInput = {
      tenantId: scopedTenantId,
      status: {
        in: [FacilityIssueStatus.OPEN, FacilityIssueStatus.IN_PROGRESS]
      },
      createdAt: {
        gte: windowStart
      }
    };

    if (dto.roomId?.trim()) {
      where.roomId = dto.roomId.trim();
    } else if (dto.locationId?.trim()) {
      where.locationId = dto.locationId.trim();
    }

    if (dto.category) {
      where.category = dto.category;
    }

    const issues = await this.prisma.facilityIssue.findMany({
      where,
      select: DUPLICATE_ISSUE_SELECT,
      orderBy: [{ createdAt: "desc" }],
      take: 25
    });

    const inputCombined = `${dto.title} ${dto.description ?? ""}`.trim();
    const candidates = issues
      .map((issue) => {
        const textScore = computeDuplicateCombinedTextScore({
          title: dto.title,
          description: dto.description,
          candidateTitle: issue.title,
          candidateDescription: issue.description
        });
        const sharedTokens = countSharedDuplicateTokens(inputCombined, `${issue.title} ${issue.description}`);

        const resolved = resolveDuplicateIssueConfidence({
          inputCategory: dto.category,
          candidateCategory: issue.category,
          textScore,
          sharedTokens
        });

        if (!resolved) {
          return null;
        }

        return toPublicDuplicateFacilityIssueCandidate(issue, resolved.confidence, resolved.reason);
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

    return {
      checkedAt: checkedAt.toISOString(),
      windowDays,
      candidates: sortDuplicateFacilityIssueCandidates(candidates).slice(0, DUPLICATE_ISSUE_MAX_CANDIDATES)
    };
  }

  private requireTenantId(tenantId: string | null | undefined): string {
    if (!tenantId) {
      throw new BadRequestException(
        "Tenant context is required. Select a tenant or provide X-Tenant-Id for cross-tenant administration."
      );
    }

    return tenantId;
  }

  private async assertActiveRoomForTenant(tenantId: string, roomId: string): Promise<void> {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, tenantId, isActive: true },
      select: { id: true }
    });

    if (!room) {
      throw new BadRequestException("Room is invalid for this tenant");
    }
  }

  private async assertActiveLocationForTenant(tenantId: string, locationId: string): Promise<void> {
    const location = await this.prisma.cleaningLocation.findFirst({
      where: { id: locationId, tenantId, isActive: true },
      select: { id: true }
    });

    if (!location) {
      throw new BadRequestException("Location is invalid for this tenant");
    }
  }
}
