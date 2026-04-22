import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CleaningVisitMethod,
  CleaningVisitStatus,
  FacilityIssueStatus,
  IssueSeverity,
  Prisma
} from "@prisma/client";
import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import * as QRCode from "qrcode";

import { PrismaService } from "../../database/prisma.service";

import {
  CreateCleaningLocationDto,
  UpdateCleaningLocationDto
} from "./dto/cleaning-location.dto";
import {
  ScanCleaningVisitDto,
  SignOffVisitDto,
  StartCleaningVisitDto,
  SubmitCleaningVisitDto
} from "./dto/cleaning-visit.dto";
import {
  CreateFacilityIssueDto,
  UpdateFacilityIssueDto
} from "./dto/facility-issue.dto";

type VisitListParams = {
  tenantId: string | null;
  viewerCleanerId?: string;
  cleanedBy?: string;
  locationId?: string;
  status?: CleaningVisitStatus;
  date?: string;
  from?: string;
  to?: string;
  page?: string;
  pageSize?: string;
};

@Injectable()
export class CleaningService {
  private readonly logger = new Logger(CleaningService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  async createLocation(actorTenantId: string | null, dto: CreateCleaningLocationDto) {
    const qrCode = randomUUID();
    const scanUrl = this.buildScanUrl(qrCode);

    const location = await this.prisma.cleaningLocation.create({
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
        qrCodeUrl: scanUrl,
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

    return {
      ...location,
      qrCodeUrl: scanUrl,
      scanUrl
    };
  }

  async listLocations(tenantId: string | null) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const [locations, visitCounts] = await Promise.all([
      this.prisma.cleaningLocation.findMany({
        where: { tenantId: tenantId ?? undefined },
        include: { checklistTemplates: true },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.cleaningVisit.groupBy({
        by: ["locationId"],
        where: {
          tenantId: tenantId ?? undefined,
          scannedAt: {
            gte: startOfToday,
            lt: startOfTomorrow
          }
        },
        _count: {
          _all: true
        }
      })
    ]);

    const countsByLocation = new Map(visitCounts.map((entry) => [entry.locationId, entry._count._all]));

    return locations.map((location) => ({
      ...location,
      qrCodeUrl: this.getScanUrlForLocation(location.qrCode, location.qrCodeUrl),
      scanUrl: this.getScanUrlForLocation(location.qrCode, location.qrCodeUrl),
      todayVisitCount: countsByLocation.get(location.id) ?? 0
    }));
  }

  async getLocation(id: string) {
    const location = await this.prisma.cleaningLocation.findUnique({
      where: { id },
      include: { checklistTemplates: true }
    });

    if (!location) {
      throw new NotFoundException("Cleaning location not found");
    }

    return {
      ...location,
      qrCodeUrl: this.getScanUrlForLocation(location.qrCode, location.qrCodeUrl),
      scanUrl: this.getScanUrlForLocation(location.qrCode, location.qrCodeUrl)
    };
  }

  async getLocationQrCode(id: string) {
    const location = await this.prisma.cleaningLocation.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        qrCode: true,
        qrCodeUrl: true
      }
    });

    if (!location) {
      throw new NotFoundException("Cleaning location not found");
    }

    const scanUrl = this.getScanUrlForLocation(location.qrCode, location.qrCodeUrl);
    const buffer = await QRCode.toBuffer(scanUrl, {
      errorCorrectionLevel: "H",
      margin: 1,
      scale: 8,
      type: "png"
    });

    return {
      buffer,
      filename: `${this.slugify(location.name)}-qr.png`
    };
  }

  async updateLocation(id: string, dto: UpdateCleaningLocationDto) {
    await this.getLocation(id);

    const updated = await this.prisma.cleaningLocation.update({
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
      },
      include: { checklistTemplates: true }
    });

    return {
      ...updated,
      qrCodeUrl: this.getScanUrlForLocation(updated.qrCode, updated.qrCodeUrl),
      scanUrl: this.getScanUrlForLocation(updated.qrCode, updated.qrCodeUrl)
    };
  }

  async removeLocation(id: string) {
    await this.getLocation(id);
    await this.prisma.cleaningLocation.update({
      where: { id },
      data: { isActive: false }
    });

    return { deleted: true };
  }

  async scanVisit(cleanerId: string, tenantId: string | null, dto: ScanCleaningVisitDto) {
    const qrCode = this.normalizeQrCode(dto.qrCode);
    const location = await this.prisma.cleaningLocation.findUnique({
      where: { qrCode },
      select: {
        id: true,
        tenantId: true,
        name: true,
        qrCode: true,
        qrCodeUrl: true,
        isActive: true,
        area: true,
        building: true,
        floor: true
      }
    });

    if (!location || !location.isActive) {
      throw new NotFoundException("QR code does not match an active cleaning location");
    }

    if (tenantId && location.tenantId && location.tenantId !== tenantId) {
      throw new NotFoundException("QR code does not match an active cleaning location");
    }

    const effectiveTenantId = tenantId ?? location.tenantId ?? null;

    const duplicateCutoff = new Date(Date.now() - 30 * 60 * 1000);
    const previousVisit = await this.prisma.cleaningVisit.findFirst({
      where: {
        tenantId: effectiveTenantId ?? undefined,
        locationId: location.id,
        cleanerId,
        scannedAt: {
          gte: duplicateCutoff
        }
      },
      orderBy: {
        scannedAt: "desc"
      }
    });

    if (previousVisit) {
      throw new BadRequestException("You already scanned this location within the last 30 minutes");
    }

    const serverTimestamp = new Date();
    const visit = await this.prisma.cleaningVisit.create({
      data: {
        tenantId: effectiveTenantId,
        locationId: location.id,
        cleanerId,
        scannedAt: serverTimestamp,
        completedAt: serverTimestamp,
        method: CleaningVisitMethod.QR_SCAN,
        status: CleaningVisitStatus.COMPLETED
      },
      include: {
        location: true,
        cleaner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    return {
      ...visit,
      location: {
        ...visit.location,
        qrCodeUrl: this.getScanUrlForLocation(visit.location.qrCode, visit.location.qrCodeUrl),
        scanUrl: this.getScanUrlForLocation(visit.location.qrCode, visit.location.qrCodeUrl)
      }
    };
  }

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
    const seedItems =
      (template?.items as Array<{ label: string; required?: boolean }> | undefined) ?? [];
    const effectiveTenantId = tenantId ?? location.tenantId ?? null;

    return this.prisma.cleaningVisit.create({
      data: {
        tenantId: effectiveTenantId,
        locationId: location.id,
        cleanerId,
        method: CleaningVisitMethod.QR_SCAN,
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
  }

  async submitVisit(visitId: string, cleanerId: string, dto: SubmitCleaningVisitDto) {
    const visit = await this.prisma.cleaningVisit.findUnique({
      where: { id: visitId },
      include: { checklist: true }
    });

    if (!visit) {
      throw new NotFoundException("Visit not found");
    }
    if (visit.cleanerId !== cleanerId) {
      throw new ForbiddenException("You can only submit your own visits");
    }
    if (visit.status !== CleaningVisitStatus.IN_PROGRESS) {
      throw new BadRequestException("Visit is no longer in progress");
    }

    const requiredFailures = dto.checklist.filter((item) => !item.checked).map((item) => item.label);
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

    if (!visit) {
      throw new NotFoundException("Visit not found");
    }
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

  async listVisits(params: VisitListParams) {
    const page = this.normalizePositiveInt(params.page, 1);
    const pageSize = Math.min(this.normalizePositiveInt(params.pageSize, 20), 100);
    const where = this.buildVisitWhere(params);

    const [items, total] = await Promise.all([
      this.prisma.cleaningVisit.findMany({
        where,
        include: {
          location: true,
          cleaner: { select: { id: true, firstName: true, lastName: true, email: true } },
          signedOffBy: { select: { id: true, firstName: true, lastName: true } },
          checklist: true
        },
        orderBy: { scannedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.cleaningVisit.count({ where })
    ]);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 1 : Math.ceil(total / pageSize)
      }
    };
  }

  async exportVisits(params: Omit<VisitListParams, "viewerCleanerId" | "page" | "pageSize">) {
    const where = this.buildVisitWhere(params);
    const visits = await this.prisma.cleaningVisit.findMany({
      where,
      include: {
        location: true,
        cleaner: { select: { firstName: true, lastName: true, email: true } }
      },
      orderBy: { scannedAt: "desc" }
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Cleaning Visits");

    worksheet.columns = [
      { header: "Location", key: "location", width: 32 },
      { header: "Area", key: "area", width: 20 },
      { header: "Building", key: "building", width: 18 },
      { header: "Floor", key: "floor", width: 12 },
      { header: "Cleaned By", key: "cleaner", width: 26 },
      { header: "Email", key: "email", width: 28 },
      { header: "Scanned At", key: "scannedAt", width: 24 },
      { header: "Status", key: "status", width: 22 },
      { header: "Method", key: "method", width: 18 },
      { header: "Notes", key: "notes", width: 36 }
    ];

    visits.forEach((visit) => {
      worksheet.addRow({
        location: visit.location.name,
        area: visit.location.area,
        building: visit.location.building ?? "",
        floor: visit.location.floor ?? "",
        cleaner: `${visit.cleaner.firstName} ${visit.cleaner.lastName}`.trim(),
        email: visit.cleaner.email,
        scannedAt: visit.scannedAt.toISOString(),
        status: visit.status,
        method: visit.method,
        notes: visit.notes ?? ""
      });
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    const rawBuffer = await workbook.xlsx.writeBuffer();
    return {
      filename: `cleaning-visits-${new Date().toISOString().slice(0, 10)}.xlsx`,
      buffer: Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer)
    };
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

    if (!visit) {
      throw new NotFoundException("Visit not found");
    }

    return visit;
  }

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
    if (!issue) {
      throw new NotFoundException("Issue not found");
    }

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

  async dashboard(tenantId: string | null, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalLocations, totalVisits, completed, rejected, pending, openIssues, byLocation] =
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
            status: { in: [CleaningVisitStatus.APPROVED, CleaningVisitStatus.COMPLETED] },
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
        this.prisma.cleaningVisit.count({
          where: {
            tenantId: tenantId ?? undefined,
            status: {
              in: [
                CleaningVisitStatus.IN_PROGRESS,
                CleaningVisitStatus.SUBMITTED,
                CleaningVisitStatus.PENDING_VERIFICATION
              ]
            },
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

    const complianceRate = totalVisits === 0 ? 0 : Math.round((completed / totalVisits) * 100);

    return {
      windowDays: days,
      totalLocations,
      totalVisits,
      completed,
      approved: completed,
      rejected,
      pending,
      openIssues,
      complianceRate,
      perLocation: byLocation
    };
  }

  private buildVisitWhere(params: VisitListParams | Omit<VisitListParams, "page" | "pageSize">) {
    const where: Prisma.CleaningVisitWhereInput = {
      tenantId: params.tenantId ?? undefined,
      locationId: params.locationId,
      status: params.status
    };

    const scannedAt = this.buildScannedAtFilter(params.date, params.from, params.to);
    if (scannedAt) {
      where.scannedAt = scannedAt;
    }

    const andFilters: Prisma.CleaningVisitWhereInput[] = [];

    if ("viewerCleanerId" in params && params.viewerCleanerId) {
      andFilters.push({ cleanerId: params.viewerCleanerId });
    }

    if (params.cleanedBy?.trim()) {
      const search = params.cleanedBy.trim();
      andFilters.push({
        OR: [
          { cleanerId: search },
          {
            cleaner: {
              firstName: { contains: search, mode: "insensitive" }
            }
          },
          {
            cleaner: {
              lastName: { contains: search, mode: "insensitive" }
            }
          },
          {
            cleaner: {
              email: { contains: search, mode: "insensitive" }
            }
          }
        ]
      });
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    return where;
  }

  private buildScannedAtFilter(date?: string, from?: string, to?: string) {
    if (date) {
      const parsed = new Date(date);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException("Invalid date filter");
      }

      const start = new Date(parsed);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { gte: start, lt: end };
    }

    const range: { gte?: Date; lte?: Date } = {};

    if (from) {
      const parsedFrom = new Date(from);
      if (Number.isNaN(parsedFrom.getTime())) {
        throw new BadRequestException("Invalid from date filter");
      }
      range.gte = parsedFrom;
    }

    if (to) {
      const parsedTo = new Date(to);
      if (Number.isNaN(parsedTo.getTime())) {
        throw new BadRequestException("Invalid to date filter");
      }
      range.lte = parsedTo;
    }

    return Object.keys(range).length > 0 ? range : undefined;
  }

  private normalizePositiveInt(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private normalizeQrCode(raw: string) {
    const candidate = raw.trim();

    if (!candidate) {
      throw new BadRequestException("QR code is required");
    }

    try {
      const parsed = new URL(candidate);
      const code = parsed.searchParams.get("code");
      return code?.trim() || candidate;
    } catch {
      return candidate;
    }
  }

  private buildScanUrl(qrCode: string) {
    const baseUrl =
      this.configService.get<string>("FRONTEND_URL") ??
      this.configService.get<string>("CORS_ORIGIN")?.split(",")[0]?.trim() ??
      "http://localhost:3001";

    return `${baseUrl.replace(/\/$/, "")}/cleaning/scan?code=${encodeURIComponent(qrCode)}`;
  }

  private getScanUrlForLocation(qrCode: string, _existingValue?: string | null) {
    return this.buildScanUrl(qrCode);
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "cleaning-location";
  }

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

    if (supervisors.length === 0) {
      this.logger.debug("No supervisors found to notify for cleaning event");
      return;
    }

    await this.prisma.notification.createMany({
      data: supervisors.map((supervisor) => ({
        userId: supervisor.id,
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