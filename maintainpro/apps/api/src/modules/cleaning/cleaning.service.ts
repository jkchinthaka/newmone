import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import {
  CleaningVisitStatus,
  FacilityIssueStatus,
  IssueSeverity,
  Prisma
} from "@prisma/client";
import { randomBytes } from "crypto";
import * as QRCode from "qrcode";

import { PrismaService } from "../../database/prisma.service";

import {
  CreateCleaningLocationDto,
  UpdateCleaningLocationDto
} from "./dto/cleaning-location.dto";
import {
  SignOffVisitDto,
  StartCleaningVisitDto,
  SubmitCleaningVisitDto
} from "./dto/cleaning-visit.dto";
import {
  CreateFacilityIssueDto,
  UpdateFacilityIssueDto
} from "./dto/facility-issue.dto";

@Injectable()
export class CleaningService {
  private readonly logger = new Logger(CleaningService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------- Locations ----------

  async createLocation(actorTenantId: string | null, dto: CreateCleaningLocationDto) {
    const qrCode = `CLN-${randomBytes(6).toString("hex").toUpperCase()}`;
    const qrCodeUrl = await QRCode.toDataURL(qrCode);

    return this.prisma.cleaningLocation.create({
      data: {
        tenantId: actorTenantId,
        name: dto.name,
        area: dto.area,
        building: dto.building,
        floor: dto.floor,
        description: dto.description,
        scheduleCron: dto.scheduleCron,
        shiftWindow: dto.shiftWindow,
        qrCode,
        qrCodeUrl,
        checklistTemplates: dto.checklistItems?.length
          ? {
              create: {
                name: "Default checklist",
                items: dto.checklistItems as unknown as Prisma.InputJsonValue
              }
            }
          : undefined
      },
      include: { checklistTemplates: true }
    });
  }

  listLocations(tenantId: string | null) {
    return this.prisma.cleaningLocation.findMany({
      where: { tenantId: tenantId ?? undefined },
      include: { checklistTemplates: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async getLocation(id: string) {
    const location = await this.prisma.cleaningLocation.findUnique({
      where: { id },
      include: { checklistTemplates: true }
    });
    if (!location) throw new NotFoundException("Cleaning location not found");
    return location;
  }

  async updateLocation(id: string, dto: UpdateCleaningLocationDto) {
    await this.getLocation(id);
    return this.prisma.cleaningLocation.update({
      where: { id },
      data: {
        name: dto.name,
        area: dto.area,
        building: dto.building,
        floor: dto.floor,
        description: dto.description,
        scheduleCron: dto.scheduleCron,
        shiftWindow: dto.shiftWindow,
        isActive: dto.isActive
      }
    });
  }

  async removeLocation(id: string) {
    await this.getLocation(id);
    await this.prisma.cleaningLocation.update({
      where: { id },
      data: { isActive: false }
    });
    return { deleted: true };
  }

  // ---------- Visits ----------

  async startVisit(cleanerId: string, tenantId: string | null, dto: StartCleaningVisitDto) {
    const location = await this.prisma.cleaningLocation.findUnique({
      where: { qrCode: dto.qrCode },
      include: {
        checklistTemplates: { where: { isActive: true }, take: 1 }
      }
    });

    if (!location || !location.isActive) {
      throw new NotFoundException("Cleaning location not found for the scanned QR");
    }

    const template = location.checklistTemplates[0];
    const seedItems = (template?.items as Array<{ label: string; required?: boolean }> | undefined) ?? [];

    const visit = await this.prisma.cleaningVisit.create({
      data: {
        tenantId,
        locationId: location.id,
        cleanerId,
        latitude: dto.latitude !== undefined ? new Prisma.Decimal(dto.latitude) : null,
        longitude: dto.longitude !== undefined ? new Prisma.Decimal(dto.longitude) : null,
        beforePhotos: dto.beforePhotos ?? [],
        status: CleaningVisitStatus.IN_PROGRESS,
        checklist: {
          create: {
            items: seedItems.map((item) => ({
              label: item.label,
              checked: false,
              required: Boolean(item.required)
            })) as unknown as Prisma.InputJsonValue
          }
        }
      },
      include: { checklist: true, location: true }
    });

    return visit;
  }

  async submitVisit(visitId: string, cleanerId: string, dto: SubmitCleaningVisitDto) {
    const visit = await this.prisma.cleaningVisit.findUnique({
      where: { id: visitId },
      include: { checklist: true }
    });

    if (!visit) throw new NotFoundException("Visit not found");
    if (visit.cleanerId !== cleanerId) {
      throw new ForbiddenException("You can only submit your own visits");
    }
    if (visit.status !== CleaningVisitStatus.IN_PROGRESS) {
      throw new BadRequestException("Visit is no longer in progress");
    }

    const requiredFailures = dto.checklist.filter((item) => !item.checked).map((i) => i.label);
    if (requiredFailures.length === dto.checklist.length) {
      throw new BadRequestException("At least one checklist item must be completed");
    }

    const updated = await this.prisma.cleaningVisit.update({
      where: { id: visitId },
      data: {
        status: CleaningVisitStatus.SUBMITTED,
        completedAt: new Date(),
        afterPhotos: dto.afterPhotos ?? visit.afterPhotos,
        notes: dto.notes ?? visit.notes,
        checklist: {
          update: {
            items: dto.checklist as unknown as Prisma.InputJsonValue,
            completedAt: new Date()
          }
        }
      },
      include: { checklist: true, location: true, cleaner: true }
    });

    // Notify supervisors of submission (in-app)
    await this.notifySupervisors(updated.tenantId, {
      title: "Cleaning visit submitted",
      message: `${updated.cleaner.firstName} ${updated.cleaner.lastName} submitted a visit at ${updated.location.name}`,
      type: "CLEANING_VISIT_SUBMITTED",
      referenceId: updated.id,
      referenceType: "CleaningVisit"
    });

    return updated;
  }

  async signOffVisit(visitId: string, supervisorId: string, dto: SignOffVisitDto) {
    const visit = await this.prisma.cleaningVisit.findUnique({
      where: { id: visitId },
      include: { cleaner: true, location: true }
    });
    if (!visit) throw new NotFoundException("Visit not found");
    if (visit.status !== CleaningVisitStatus.SUBMITTED) {
      throw new BadRequestException("Only submitted visits can be signed off");
    }
    if (!dto.approve && !dto.rejectionReason) {
      throw new BadRequestException("Rejection reason is required when rejecting");
    }

    const updated = await this.prisma.cleaningVisit.update({
      where: { id: visitId },
      data: {
        status: dto.approve ? CleaningVisitStatus.APPROVED : CleaningVisitStatus.REJECTED,
        signedOffById: supervisorId,
        signedOffAt: new Date(),
        signOffNotes: dto.notes,
        rejectionReason: dto.approve ? null : dto.rejectionReason
      }
    });

    await this.prisma.notification.create({
      data: {
        userId: visit.cleanerId,
        title: dto.approve ? "Cleaning visit approved" : "Cleaning visit rejected",
        message: `Your visit at ${visit.location.name} was ${dto.approve ? "approved" : "rejected"}.`,
        type: dto.approve ? "CLEANING_SIGN_OFF" : "CLEANING_REJECTED",
        channel: "IN_APP",
        referenceId: visit.id,
        referenceType: "CleaningVisit"
      }
    });

    return updated;
  }

  listVisits(params: {
    tenantId: string | null;
    cleanerId?: string;
    locationId?: string;
    status?: CleaningVisitStatus;
    from?: Date;
    to?: Date;
  }) {
    return this.prisma.cleaningVisit.findMany({
      where: {
        tenantId: params.tenantId ?? undefined,
        cleanerId: params.cleanerId,
        locationId: params.locationId,
        status: params.status,
        scannedAt:
          params.from || params.to ? { gte: params.from, lte: params.to } : undefined
      },
      include: {
        location: true,
        cleaner: { select: { id: true, firstName: true, lastName: true, email: true } },
        signedOffBy: { select: { id: true, firstName: true, lastName: true } },
        checklist: true
      },
      orderBy: { scannedAt: "desc" },
      take: 200
    });
  }

  async getVisit(id: string) {
    const visit = await this.prisma.cleaningVisit.findUnique({
      where: { id },
      include: {
        location: true,
        cleaner: { select: { id: true, firstName: true, lastName: true, email: true } },
        signedOffBy: { select: { id: true, firstName: true, lastName: true } },
        checklist: true
      }
    });
    if (!visit) throw new NotFoundException("Visit not found");
    return visit;
  }

  // ---------- Issues ----------

  createIssue(reportedById: string, tenantId: string | null, dto: CreateFacilityIssueDto) {
    return this.prisma.facilityIssue.create({
      data: {
        tenantId,
        reportedById,
        title: dto.title,
        description: dto.description,
        severity: dto.severity ?? IssueSeverity.MEDIUM,
        locationId: dto.locationId,
        photos: dto.photos ?? []
      }
    });
  }

  listIssues(tenantId: string | null, status?: FacilityIssueStatus) {
    return this.prisma.facilityIssue.findMany({
      where: { tenantId: tenantId ?? undefined, status },
      include: {
        location: true,
        reportedBy: { select: { id: true, firstName: true, lastName: true } },
        resolvedBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 200
    });
  }

  async updateIssue(id: string, actorId: string, dto: UpdateFacilityIssueDto) {
    const issue = await this.prisma.facilityIssue.findUnique({ where: { id } });
    if (!issue) throw new NotFoundException("Issue not found");

    const isResolving =
      dto.status === FacilityIssueStatus.RESOLVED || dto.status === FacilityIssueStatus.CLOSED;

    return this.prisma.facilityIssue.update({
      where: { id },
      data: {
        status: dto.status,
        resolution: dto.resolution,
        resolvedById: isResolving ? actorId : issue.resolvedById,
        resolvedAt: isResolving ? new Date() : issue.resolvedAt
      }
    });
  }

  // ---------- Dashboard ----------

  async dashboard(tenantId: string | null, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalLocations, totalVisits, approved, rejected, openIssues, byLocation] =
      await Promise.all([
        this.prisma.cleaningLocation.count({
          where: { tenantId: tenantId ?? undefined, isActive: true }
        }),
        this.prisma.cleaningVisit.count({
          where: { tenantId: tenantId ?? undefined, scannedAt: { gte: since } }
        }),
        this.prisma.cleaningVisit.count({
          where: {
            tenantId: tenantId ?? undefined,
            status: CleaningVisitStatus.APPROVED,
            scannedAt: { gte: since }
          }
        }),
        this.prisma.cleaningVisit.count({
          where: {
            tenantId: tenantId ?? undefined,
            status: CleaningVisitStatus.REJECTED,
            scannedAt: { gte: since }
          }
        }),
        this.prisma.facilityIssue.count({
          where: { tenantId: tenantId ?? undefined, status: FacilityIssueStatus.OPEN }
        }),
        this.prisma.cleaningVisit.groupBy({
          by: ["locationId", "status"],
          where: { tenantId: tenantId ?? undefined, scannedAt: { gte: since } },
          _count: { _all: true }
        })
      ]);

    const complianceRate = totalVisits === 0 ? 0 : Math.round((approved / totalVisits) * 100);

    return {
      windowDays: days,
      totalLocations,
      totalVisits,
      approved,
      rejected,
      pending: totalVisits - approved - rejected,
      openIssues,
      complianceRate,
      perLocation: byLocation
    };
  }

  // ---------- Helpers ----------

  private async notifySupervisors(
    tenantId: string | null,
    payload: {
      title: string;
      message: string;
      type:
        | "CLEANING_VISIT_SUBMITTED"
        | "CLEANING_SIGN_OFF"
        | "CLEANING_REJECTED"
        | "FACILITY_ISSUE_REPORTED"
        | "CLEANING_MISSED";
      referenceId?: string;
      referenceType?: string;
    }
  ) {
    const supervisors = await this.prisma.user.findMany({
      where: {
        tenantId: tenantId ?? undefined,
        isActive: true,
        role: { name: { in: ["SUPERVISOR", "ADMIN", "SUPER_ADMIN"] } }
      },
      select: { id: true }
    });

    if (supervisors.length === 0) return;

    await this.prisma.notification.createMany({
      data: supervisors.map((s) => ({
        userId: s.id,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        channel: "IN_APP" as const,
        referenceId: payload.referenceId,
        referenceType: payload.referenceType
      }))
    });
  }
}
