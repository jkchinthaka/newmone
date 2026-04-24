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
  AuditAction,
  CleaningFrequencyUnit,
  CleaningScheduleStatus,
  CleaningShift,
  CleaningVisitMethod,
  CleaningVisitStatus,
  FacilityIssueStatus,
  IssueSeverity,
  NotificationPriority,
  NotificationType,
  Prisma,
  RoleName
} from "@prisma/client";
import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";

import { QrCodeService } from "../../common/services/qr-code.service";
import { PrismaService } from "../../database/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

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

type ScheduleCalendarQuery = {
  from?: string;
  to?: string;
  locationId?: string;
};

type CleaningAnalyticsQuery = {
  from?: string;
  to?: string;
  locationId?: string;
  cleanerId?: string;
};

const COMPLETED_VISIT_STATUSES = new Set<CleaningVisitStatus>([
  CleaningVisitStatus.COMPLETED,
  CleaningVisitStatus.SUBMITTED,
  CleaningVisitStatus.APPROVED
]);

const PENDING_VISIT_STATUSES = new Set<CleaningVisitStatus>([
  CleaningVisitStatus.IN_PROGRESS,
  CleaningVisitStatus.PENDING_VERIFICATION
]);

const ACTIVE_ISSUE_STATUSES = new Set<FacilityIssueStatus>([
  FacilityIssueStatus.OPEN,
  FacilityIssueStatus.IN_PROGRESS
]);

const MS_IN_HOUR = 60 * 60 * 1000;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class CleaningService {
  private readonly logger = new Logger(CleaningService.name);
  private readonly maxClientTimestampSkewMs = 20 * 60 * 1000;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(QrCodeService) private readonly qrCodeService: QrCodeService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService
  ) {}

  async listAssignableCleaners(tenantId: string | null) {
    return this.prisma.user.findMany({
      where: {
        tenantId: tenantId ?? undefined,
        isActive: true,
        role: {
          name: {
            in: [RoleName.CLEANER, RoleName.SUPERVISOR]
          }
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: {
          select: {
            name: true
          }
        }
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
    });
  }

  async createLocation(actorTenantId: string | null, dto: CreateCleaningLocationDto) {
    if (dto.assignedCleanerId) {
      await this.ensureAssignableCleaner(actorTenantId, dto.assignedCleanerId);
    }

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
        cleaningFrequency: dto.cleaningFrequency ?? 1,
        cleaningFrequencyUnit: dto.cleaningFrequencyUnit ?? CleaningFrequencyUnit.PER_DAY,
        shiftAssignment: dto.shiftAssignment ?? CleaningShift.MORNING,
        assignedCleanerId: dto.assignedCleanerId,
        geoLatitude: this.toNullableDecimal(dto.geoLatitude),
        geoLongitude: this.toNullableDecimal(dto.geoLongitude),
        geoRadiusMeters: dto.geoRadiusMeters ?? 150,
        requireDeviceValidation: dto.requireDeviceValidation ?? false,
        requirePhotoEvidence: dto.requirePhotoEvidence ?? false,
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
      include: {
        checklistTemplates: true,
        assignedCleaner: {
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
      ...location,
      qrCodeUrl: scanUrl,
      scanUrl
    };
  }

  async listLocations(tenantId: string | null) {
    const startOfToday = this.startOfDayUtc(new Date());
    const startOfTomorrow = new Date(startOfToday.getTime() + MS_IN_DAY);

    const [locations, visitCounts, issueCounts] = await Promise.all([
      this.prisma.cleaningLocation.findMany({
        where: { tenantId: tenantId ?? undefined },
        include: {
          checklistTemplates: true,
          assignedCleaner: {
            select: { id: true, firstName: true, lastName: true, email: true }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.cleaningVisit.groupBy({
        by: ["locationId", "status"],
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
      }),
      this.prisma.facilityIssue.groupBy({
        by: ["locationId"],
        where: {
          tenantId: tenantId ?? undefined,
          status: {
            in: [FacilityIssueStatus.OPEN, FacilityIssueStatus.IN_PROGRESS]
          }
        },
        _count: {
          _all: true
        }
      })
    ]);

    const completedMap = new Map<string, number>();
    const pendingMap = new Map<string, number>();

    visitCounts.forEach((row) => {
      if (COMPLETED_VISIT_STATUSES.has(row.status)) {
        completedMap.set(row.locationId, (completedMap.get(row.locationId) ?? 0) + row._count._all);
      } else if (PENDING_VISIT_STATUSES.has(row.status)) {
        pendingMap.set(row.locationId, (pendingMap.get(row.locationId) ?? 0) + row._count._all);
      }
    });

    const issueMap = new Map(
      issueCounts
        .filter((entry) => Boolean(entry.locationId))
        .map((entry) => [entry.locationId as string, entry._count._all])
    );

    return locations.map((location) => {
      const expectedTodayVisits = this.expectedVisitsForDate(location, startOfToday);
      const completedToday = completedMap.get(location.id) ?? 0;
      const pendingToday = Math.max(expectedTodayVisits - completedToday, 0);

      return {
        ...location,
        qrCodeUrl: this.getScanUrlForLocation(location.qrCode, location.qrCodeUrl),
        scanUrl: this.getScanUrlForLocation(location.qrCode, location.qrCodeUrl),
        todayVisitCount: completedToday,
        pendingToday,
        expectedTodayVisits,
        complianceToday: this.calculateComplianceRate(completedToday, expectedTodayVisits),
        openIssuesCount: issueMap.get(location.id) ?? 0
      };
    });
  }

  async getLocation(id: string) {
    const location = await this.prisma.cleaningLocation.findUnique({
      where: { id },
      include: {
        checklistTemplates: true,
        assignedCleaner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
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
    const buffer = await this.qrCodeService.toBuffer(scanUrl, {
      errorCorrectionLevel: "H",
      margin: 1,
      scale: 8
    });

    return {
      buffer,
      filename: `${this.slugify(location.name)}-qr.png`
    };
  }

  async regenerateLocationQrCode(id: string) {
    const location = await this.prisma.cleaningLocation.findUnique({ where: { id } });
    if (!location) {
      throw new NotFoundException("Cleaning location not found");
    }

    const qrCode = randomUUID();
    const scanUrl = this.buildScanUrl(qrCode);

    const updated = await this.prisma.cleaningLocation.update({
      where: { id },
      data: {
        qrCode,
        qrCodeUrl: scanUrl
      }
    });

    await this.recordAudit({
      tenantId: updated.tenantId,
      entity: "CLEANING_LOCATION",
      entityId: updated.id,
      action: AuditAction.UPDATE,
      beforeData: {
        qrCode: location.qrCode
      },
      afterData: {
        qrCode: updated.qrCode
      }
    });

    return {
      id: updated.id,
      qrCode: updated.qrCode,
      qrCodeUrl: scanUrl,
      scanUrl
    };
  }

  async updateLocation(id: string, dto: UpdateCleaningLocationDto) {
    const existing = await this.prisma.cleaningLocation.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException("Cleaning location not found");
    }

    if (dto.assignedCleanerId) {
      await this.ensureAssignableCleaner(existing.tenantId, dto.assignedCleanerId);
    }

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
        cleaningFrequency: dto.cleaningFrequency,
        cleaningFrequencyUnit: dto.cleaningFrequencyUnit,
        shiftAssignment: dto.shiftAssignment,
        assignedCleanerId: dto.assignedCleanerId,
        geoLatitude: this.toNullableDecimal(dto.geoLatitude),
        geoLongitude: this.toNullableDecimal(dto.geoLongitude),
        geoRadiusMeters: dto.geoRadiusMeters,
        requireDeviceValidation: dto.requireDeviceValidation,
        requirePhotoEvidence: dto.requirePhotoEvidence,
        isActive: dto.isActive
      },
      include: {
        checklistTemplates: true,
        assignedCleaner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    await this.recordAudit({
      tenantId: updated.tenantId,
      entity: "CLEANING_LOCATION",
      entityId: updated.id,
      action: AuditAction.UPDATE,
      beforeData: existing,
      afterData: updated
    });

    return {
      ...updated,
      qrCodeUrl: this.getScanUrlForLocation(updated.qrCode, updated.qrCodeUrl),
      scanUrl: this.getScanUrlForLocation(updated.qrCode, updated.qrCodeUrl)
    };
  }

  async removeLocation(id: string) {
    const existing = await this.prisma.cleaningLocation.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException("Cleaning location not found");
    }

    await this.prisma.cleaningLocation.update({
      where: { id },
      data: { isActive: false }
    });

    await this.recordAudit({
      tenantId: existing.tenantId,
      entity: "CLEANING_LOCATION",
      entityId: id,
      action: AuditAction.DELETE,
      beforeData: existing,
      afterData: {
        isActive: false
      }
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
        floor: true,
        shiftWindow: true,
        requireDeviceValidation: true,
        geoLatitude: true,
        geoLongitude: true,
        geoRadiusMeters: true
      }
    });

    if (!location || !location.isActive) {
      throw new NotFoundException("QR code does not match an active cleaning location");
    }

    if (tenantId && location.tenantId && location.tenantId !== tenantId) {
      throw new NotFoundException("QR code does not match an active cleaning location");
    }

    this.validateClientTimestamp(dto.clientScannedAt);

    if (location.requireDeviceValidation && !dto.deviceId?.trim()) {
      throw new BadRequestException("Device validation is required for this location");
    }

    const geofence = this.validateGeofence(location, dto.latitude, dto.longitude);
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
    const scheduleStatus = this.evaluateScheduleStatus(location.shiftWindow, serverTimestamp);

    const visit = await this.prisma.cleaningVisit.create({
      data: {
        tenantId: effectiveTenantId,
        locationId: location.id,
        cleanerId,
        scannedAt: serverTimestamp,
        clientScannedAt: dto.clientScannedAt ? new Date(dto.clientScannedAt) : null,
        startedAt: serverTimestamp,
        completedAt: serverTimestamp,
        durationSeconds: 0,
        method: CleaningVisitMethod.QR_SCAN,
        deviceId: dto.deviceId?.trim() || null,
        latitude: dto.latitude !== undefined ? new Prisma.Decimal(dto.latitude) : null,
        longitude: dto.longitude !== undefined ? new Prisma.Decimal(dto.longitude) : null,
        geofenceDistanceMeters: geofence.distanceMeters,
        geoValidated: geofence.geoValidated,
        checklistScore: 100,
        photoScore: 20,
        qualityScore: this.calculateQualityScore({ checklistScore: 100, photoScore: 20, rating: null }),
        scheduleStatus,
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

    await this.recordAudit({
      tenantId: visit.tenantId,
      actorId: cleanerId,
      entity: "CLEANING_VISIT",
      entityId: visit.id,
      action: AuditAction.CREATE,
      afterData: {
        status: visit.status,
        locationId: visit.locationId,
        scannedAt: visit.scannedAt,
        scheduleStatus: visit.scheduleStatus
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
    const qrCode = this.normalizeQrCode(dto.qrCode);
    const location = await this.prisma.cleaningLocation.findUnique({
      where: { qrCode },
      include: {
        checklistTemplates: { where: { isActive: true }, take: 1 }
      }
    });

    if (!location || !location.isActive) {
      throw new NotFoundException("Cleaning location not found for the scanned QR");
    }

    if (tenantId && location.tenantId && location.tenantId !== tenantId) {
      throw new NotFoundException("Cleaning location not found for the scanned QR");
    }

    this.validateClientTimestamp(dto.clientScannedAt);

    if (location.requireDeviceValidation && !dto.deviceId?.trim()) {
      throw new BadRequestException("Device validation is required for this location");
    }

    const geofence = this.validateGeofence(location, dto.latitude, dto.longitude);
    const template = location.checklistTemplates[0];
    const seedItems =
      (template?.items as Array<{ label: string; required?: boolean }> | undefined) ?? [];
    const effectiveTenantId = tenantId ?? location.tenantId ?? null;
    const now = new Date();

    const visit = await this.prisma.cleaningVisit.create({
      data: {
        tenantId: effectiveTenantId,
        locationId: location.id,
        cleanerId,
        scannedAt: now,
        clientScannedAt: dto.clientScannedAt ? new Date(dto.clientScannedAt) : null,
        startedAt: now,
        method: CleaningVisitMethod.QR_SCAN,
        deviceId: dto.deviceId?.trim() || null,
        latitude: dto.latitude !== undefined ? new Prisma.Decimal(dto.latitude) : null,
        longitude: dto.longitude !== undefined ? new Prisma.Decimal(dto.longitude) : null,
        geofenceDistanceMeters: geofence.distanceMeters,
        geoValidated: geofence.geoValidated,
        beforePhotos: dto.beforePhotos ?? [],
        scheduleStatus: this.evaluateScheduleStatus(location.shiftWindow, now),
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

    await this.recordAudit({
      tenantId: visit.tenantId,
      actorId: cleanerId,
      entity: "CLEANING_VISIT",
      entityId: visit.id,
      action: AuditAction.CREATE,
      afterData: {
        status: visit.status,
        locationId: visit.locationId,
        startedAt: visit.startedAt
      }
    });

    return visit;
  }

  async submitVisit(visitId: string, cleanerId: string, dto: SubmitCleaningVisitDto) {
    const visit = await this.prisma.cleaningVisit.findUnique({
      where: { id: visitId },
      include: { checklist: true, location: true }
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

    if (!dto.checklist.length) {
      throw new BadRequestException("Checklist data is required");
    }

    const requiredIncomplete = dto.checklist.filter(
      (item) => (item as unknown as { required?: boolean }).required && !item.checked
    );
    if (requiredIncomplete.length > 0) {
      throw new BadRequestException("All required checklist items must be completed");
    }

    const checkedCount = dto.checklist.filter((item) => item.checked).length;
    if (checkedCount === 0) {
      throw new BadRequestException("At least one checklist item must be completed");
    }

    const afterPhotos = dto.afterPhotos ?? visit.afterPhotos;
    if (visit.location.requirePhotoEvidence && (!afterPhotos || afterPhotos.length === 0)) {
      throw new BadRequestException("After-cleaning photo evidence is required for this location");
    }

    const completedAt = new Date();
    const durationSeconds = Math.max(
      1,
      Math.round(
        (completedAt.getTime() - (visit.startedAt ?? visit.scannedAt).getTime()) / 1000
      )
    );

    const checklistScore = this.calculateChecklistScore(dto.checklist);
    const photoScore = this.calculatePhotoScore(visit.beforePhotos, afterPhotos);
    const qualityScore = this.calculateQualityScore({
      checklistScore,
      photoScore,
      rating: visit.supervisorRating
    });

    const updated = await this.prisma.cleaningVisit.update({
      where: { id: visitId },
      data: {
        status: CleaningVisitStatus.SUBMITTED,
        completedAt,
        durationSeconds,
        afterPhotos,
        notes: dto.notes ?? visit.notes,
        checklistScore,
        photoScore,
        qualityScore,
        checklist: {
          update: {
            items: dto.checklist as unknown as Prisma.InputJsonValue,
            completedAt
          }
        }
      },
      include: { checklist: true, location: true, cleaner: true }
    });

    await this.notifySupervisors(updated.tenantId, {
      title: "Cleaning visit submitted",
      message: `${updated.cleaner.firstName} ${updated.cleaner.lastName} submitted a visit at ${updated.location.name}`,
      type: NotificationType.CLEANING_VISIT_SUBMITTED,
      referenceId: updated.id,
      referenceType: "CleaningVisit"
    });

    await this.recordAudit({
      tenantId: updated.tenantId,
      actorId: cleanerId,
      entity: "CLEANING_VISIT",
      entityId: updated.id,
      action: AuditAction.UPDATE,
      beforeData: {
        status: visit.status,
        durationSeconds: visit.durationSeconds
      },
      afterData: {
        status: updated.status,
        durationSeconds: updated.durationSeconds,
        qualityScore: updated.qualityScore
      }
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

    const effectiveRating = dto.rating ?? visit.supervisorRating ?? null;
    const finalQualityScore = this.calculateQualityScore({
      checklistScore: visit.checklistScore,
      photoScore: visit.photoScore,
      rating: effectiveRating
    });

    const updated = await this.prisma.cleaningVisit.update({
      where: { id: visitId },
      data: {
        status: dto.approve ? CleaningVisitStatus.APPROVED : CleaningVisitStatus.REJECTED,
        signedOffById: supervisorId,
        signedOffAt: new Date(),
        signOffNotes: dto.notes,
        supervisorComment: dto.notes,
        supervisorRating: effectiveRating,
        qualityScore: finalQualityScore,
        rejectionReason: dto.approve ? null : dto.rejectionReason
      }
    });

    await this.notificationsService.createNotification({
      userId: visit.cleanerId,
      title: dto.approve ? "Cleaning visit approved" : "Cleaning visit rejected",
      message: `Your visit at ${visit.location.name} was ${dto.approve ? "approved" : "rejected"}.`,
      type: dto.approve ? NotificationType.CLEANING_SIGN_OFF : NotificationType.CLEANING_REJECTED,
      priority: dto.approve ? NotificationPriority.INFO : NotificationPriority.WARNING,
      channel: "IN_APP",
      referenceId: visit.id,
      referenceType: "CleaningVisit",
      metadata: {
        locationName: visit.location.name,
        approved: dto.approve
      }
    });

    await this.recordAudit({
      tenantId: visit.tenantId,
      actorId: supervisorId,
      entity: "CLEANING_VISIT",
      entityId: visit.id,
      action: AuditAction.UPDATE,
      beforeData: {
        status: visit.status,
        supervisorRating: visit.supervisorRating,
        qualityScore: visit.qualityScore
      },
      afterData: {
        status: updated.status,
        supervisorRating: updated.supervisorRating,
        qualityScore: updated.qualityScore
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
          location: {
            include: {
              assignedCleaner: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          },
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
      { header: "Cleaned By", key: "cleaner", width: 26 },
      { header: "Email", key: "email", width: 28 },
      { header: "Scanned At", key: "scannedAt", width: 24 },
      { header: "Duration (min)", key: "duration", width: 16 },
      { header: "Status", key: "status", width: 22 },
      { header: "Schedule", key: "schedule", width: 16 },
      { header: "Quality Score", key: "qualityScore", width: 16 },
      { header: "Notes", key: "notes", width: 36 }
    ];

    visits.forEach((visit) => {
      worksheet.addRow({
        location: visit.location.name,
        area: visit.location.area,
        cleaner: `${visit.cleaner.firstName} ${visit.cleaner.lastName}`.trim(),
        email: visit.cleaner.email,
        scannedAt: visit.scannedAt.toISOString(),
        duration: visit.durationSeconds ? Math.round((visit.durationSeconds / 60) * 10) / 10 : "-",
        status: visit.status,
        schedule: visit.scheduleStatus,
        qualityScore: visit.qualityScore ?? "-",
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
        location: {
          include: {
            assignedCleaner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
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

  async createIssue(reportedById: string, tenantId: string | null, dto: CreateFacilityIssueDto) {
    if (dto.assignedToId) {
      await this.ensureAssignableCleaner(tenantId, dto.assignedToId);
    }

    const issue = await this.prisma.facilityIssue.create({
      data: {
        tenantId,
        reportedById,
        assignedToId: dto.assignedToId,
        title: dto.title,
        description: dto.description,
        severity: dto.severity ?? IssueSeverity.MEDIUM,
        locationId: dto.locationId,
        photos: dto.photos ?? [],
        slaTargetAt: dto.slaHours ? new Date(Date.now() + dto.slaHours * MS_IN_HOUR) : null
      },
      include: {
        location: true,
        reportedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    await this.notifySupervisors(issue.tenantId, {
      title: "Facility issue reported",
      message: `${issue.title} has been reported${issue.location?.name ? ` at ${issue.location.name}` : ""}.`,
      type: NotificationType.FACILITY_ISSUE_REPORTED,
      referenceId: issue.id,
      referenceType: "FacilityIssue"
    });

    if (issue.assignedToId) {
      await this.notificationsService.createNotification({
        userId: issue.assignedToId,
        title: "Facility issue assigned",
        message: `You were assigned to issue: ${issue.title}`,
        type: NotificationType.SYSTEM_ALERT,
        priority: NotificationPriority.WARNING,
        channel: "IN_APP",
        referenceId: issue.id,
        referenceType: "FacilityIssue",
        dueAt: issue.slaTargetAt,
        metadata: {
          title: issue.title,
          severity: issue.severity,
          locationName: issue.location?.name
        }
      });
    }

    await this.recordAudit({
      tenantId: issue.tenantId,
      actorId: reportedById,
      entity: "FACILITY_ISSUE",
      entityId: issue.id,
      action: AuditAction.CREATE,
      afterData: issue
    });

    return issue;
  }

  async listIssues(tenantId: string | null, status?: FacilityIssueStatus) {
    return this.prisma.facilityIssue.findMany({
      where: {
        tenantId: tenantId ?? undefined,
        status: this.isIssueStatus(status) ? status : undefined
      },
      include: {
        location: true,
        reportedBy: { select: { id: true, firstName: true, lastName: true } },
        resolvedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 300
    });
  }

  async updateIssue(id: string, actorId: string, dto: UpdateFacilityIssueDto) {
    const issue = await this.prisma.facilityIssue.findUnique({ where: { id } });
    if (!issue) {
      throw new NotFoundException("Issue not found");
    }

    if (dto.assignedToId) {
      await this.ensureAssignableCleaner(issue.tenantId, dto.assignedToId);
    }

    const now = new Date();
    const nextStatus = dto.status ?? issue.status;

    const isResolving =
      nextStatus === FacilityIssueStatus.RESOLVED || nextStatus === FacilityIssueStatus.CLOSED;

    const firstResponseAt =
      issue.firstResponseAt ??
      (nextStatus === FacilityIssueStatus.IN_PROGRESS || isResolving ? now : issue.firstResponseAt);

    const resolvedAt = isResolving ? issue.resolvedAt ?? now : issue.resolvedAt;
    const closedAt = nextStatus === FacilityIssueStatus.CLOSED ? now : issue.closedAt;
    const resolutionMinutes = isResolving
      ? Math.max(1, Math.round((now.getTime() - issue.createdAt.getTime()) / 60000))
      : issue.resolutionMinutes;

    const updated = await this.prisma.facilityIssue.update({
      where: { id },
      data: {
        status: nextStatus,
        assignedToId: dto.assignedToId,
        resolution: dto.resolution,
        firstResponseAt,
        resolvedById: isResolving ? actorId : issue.resolvedById,
        resolvedAt,
        closedAt,
        resolutionMinutes
      },
      include: {
        location: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        reportedBy: { select: { id: true, firstName: true, lastName: true } },
        resolvedBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    if (updated.slaTargetAt && isResolving && updated.resolvedAt && updated.resolvedAt > updated.slaTargetAt) {
      await this.notifySupervisors(updated.tenantId, {
        title: "Issue SLA breached",
        message: `Issue \"${updated.title}\" missed its SLA target.`,
        type: NotificationType.CLEANING_SLA_BREACH,
        referenceId: updated.id,
        referenceType: "FacilityIssue",
        dedupeKey: `cleaning-sla:${updated.id}`
      });
    }

    await this.recordAudit({
      tenantId: updated.tenantId,
      actorId,
      entity: "FACILITY_ISSUE",
      entityId: updated.id,
      action: AuditAction.UPDATE,
      beforeData: issue,
      afterData: updated
    });

    return updated;
  }

  async dashboard(tenantId: string | null, days = 14) {
    const windowDays = this.normalizeNumber(days, 14, 1, 90);
    const rangeStart = this.startOfDayUtc(new Date(Date.now() - (windowDays - 1) * MS_IN_DAY));

    const [enforcement, totalLocations, openIssues, visits, recentRejected] = await Promise.all([
      this.runScheduleEnforcement(tenantId),
      this.prisma.cleaningLocation.count({
        where: { tenantId: tenantId ?? undefined, isActive: true }
      }),
      this.prisma.facilityIssue.count({
        where: {
          tenantId: tenantId ?? undefined,
          status: {
            in: [FacilityIssueStatus.OPEN, FacilityIssueStatus.IN_PROGRESS]
          }
        }
      }),
      this.prisma.cleaningVisit.findMany({
        where: {
          tenantId: tenantId ?? undefined,
          scannedAt: { gte: rangeStart }
        },
        select: {
          id: true,
          locationId: true,
          status: true,
          scannedAt: true,
          durationSeconds: true,
          qualityScore: true
        }
      }),
      this.prisma.cleaningVisit.findMany({
        where: {
          tenantId: tenantId ?? undefined,
          status: CleaningVisitStatus.REJECTED,
          scannedAt: { gte: new Date(Date.now() - 7 * MS_IN_DAY) }
        },
        include: {
          location: { select: { id: true, name: true } },
          cleaner: { select: { firstName: true, lastName: true } }
        },
        orderBy: { scannedAt: "desc" },
        take: 8
      })
    ]);

    const totalVisits = visits.length;
    let approved = 0;
    let rejected = 0;
    let pending = 0;

    const dailyMap = new Map<
      string,
      { date: string; completed: number; pending: number; rejected: number; avgDurationMinutes: number }
    >();
    const locationCompleted = new Map<string, number>();

    visits.forEach((visit) => {
      if (COMPLETED_VISIT_STATUSES.has(visit.status)) {
        approved += 1;
        locationCompleted.set(visit.locationId, (locationCompleted.get(visit.locationId) ?? 0) + 1);
      } else if (visit.status === CleaningVisitStatus.REJECTED) {
        rejected += 1;
      } else if (PENDING_VISIT_STATUSES.has(visit.status)) {
        pending += 1;
      }

      const dateKey = visit.scannedAt.toISOString().slice(0, 10);
      const day = dailyMap.get(dateKey) ?? {
        date: dateKey,
        completed: 0,
        pending: 0,
        rejected: 0,
        avgDurationMinutes: 0
      };

      if (COMPLETED_VISIT_STATUSES.has(visit.status)) {
        day.completed += 1;
      } else if (visit.status === CleaningVisitStatus.REJECTED) {
        day.rejected += 1;
      } else {
        day.pending += 1;
      }

      if (visit.durationSeconds) {
        const currentTotal = day.avgDurationMinutes * Math.max(day.completed + day.rejected + day.pending - 1, 0);
        const nextCount = Math.max(day.completed + day.rejected + day.pending, 1);
        day.avgDurationMinutes = (currentTotal + visit.durationSeconds / 60) / nextCount;
      }

      dailyMap.set(dateKey, day);
    });

    const activeLocations = await this.prisma.cleaningLocation.findMany({
      where: { tenantId: tenantId ?? undefined, isActive: true },
      select: {
        id: true,
        name: true,
        cleaningFrequency: true,
        cleaningFrequencyUnit: true,
        shiftAssignment: true,
        assignedCleaner: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    const locationCompliance = activeLocations.map((location) => {
      const completedCount = locationCompleted.get(location.id) ?? 0;
      const expectedCount = this.expectedVisitsForWindow(location, rangeStart, new Date());
      return {
        locationId: location.id,
        locationName: location.name,
        completedCount,
        expectedCount,
        complianceRate: this.calculateComplianceRate(completedCount, expectedCount),
        shiftAssignment: location.shiftAssignment,
        assignedCleaner:
          location.assignedCleaner
            ? `${location.assignedCleaner.firstName} ${location.assignedCleaner.lastName}`
            : null
      };
    });

    const weeklyMap = new Map<string, { weekStart: string; completed: number; pending: number; rejected: number }>();
    dailyMap.forEach((day) => {
      const weekStart = this.startOfWeekUtc(new Date(`${day.date}T00:00:00.000Z`));
      const weekKey = weekStart.toISOString().slice(0, 10);
      const week = weeklyMap.get(weekKey) ?? {
        weekStart: weekKey,
        completed: 0,
        pending: 0,
        rejected: 0
      };
      week.completed += day.completed;
      week.pending += day.pending;
      week.rejected += day.rejected;
      weeklyMap.set(weekKey, week);
    });

    const dailyTrend = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    const weeklyTrend = [...weeklyMap.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));

    return {
      windowDays,
      totalLocations,
      totalVisits,
      approved,
      rejected,
      pending,
      openIssues,
      complianceRate: enforcement.complianceRate,
      completedVisitsToday: enforcement.completedToday,
      pendingOrMissedCleanings: enforcement.pendingToday,
      openIssuesCount: openIssues,
      dailyTrend,
      weeklyTrend,
      locationCompliance,
      alerts: {
        missedSchedules: enforcement.missedSchedules,
        rejectedVisits: recentRejected.map((visit) => ({
          id: visit.id,
          locationName: visit.location.name,
          cleanerName: `${visit.cleaner.firstName} ${visit.cleaner.lastName}`,
          scannedAt: visit.scannedAt,
          rejectionReason: visit.rejectionReason
        })),
        highIssueLocations: enforcement.highIssueLocations
      }
    };
  }

  async analytics(tenantId: string | null, query: CleaningAnalyticsQuery) {
    const range = this.parseDateRange(query.from, query.to, 30);

    const where: Prisma.CleaningVisitWhereInput = {
      tenantId: tenantId ?? undefined,
      scannedAt: {
        gte: range.start,
        lte: range.end
      },
      locationId: query.locationId || undefined,
      cleanerId: query.cleanerId || undefined
    };

    const visits = await this.prisma.cleaningVisit.findMany({
      where,
      include: {
        cleaner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        location: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { scannedAt: "asc" }
    });

    const cleanerStats = new Map<
      string,
      {
        cleanerId: string;
        cleanerName: string;
        totalVisits: number;
        approvedVisits: number;
        rejectedVisits: number;
        durationTotalSeconds: number;
        durationCount: number;
        qualityTotal: number;
        qualityCount: number;
      }
    >();

    const trendMap = new Map<
      string,
      {
        date: string;
        completed: number;
        rejected: number;
        totalDurationSeconds: number;
        durationCount: number;
      }
    >();

    let totalDuration = 0;
    let durationCount = 0;
    let qualityTotal = 0;
    let qualityCount = 0;
    let rejectedTotal = 0;

    visits.forEach((visit) => {
      const cleanerName = `${visit.cleaner.firstName} ${visit.cleaner.lastName}`.trim();
      const stat =
        cleanerStats.get(visit.cleanerId) ??
        {
          cleanerId: visit.cleanerId,
          cleanerName,
          totalVisits: 0,
          approvedVisits: 0,
          rejectedVisits: 0,
          durationTotalSeconds: 0,
          durationCount: 0,
          qualityTotal: 0,
          qualityCount: 0
        };

      stat.totalVisits += 1;
      if (COMPLETED_VISIT_STATUSES.has(visit.status)) {
        stat.approvedVisits += 1;
      }
      if (visit.status === CleaningVisitStatus.REJECTED) {
        stat.rejectedVisits += 1;
        rejectedTotal += 1;
      }

      if (visit.durationSeconds && visit.durationSeconds > 0) {
        stat.durationTotalSeconds += visit.durationSeconds;
        stat.durationCount += 1;
        totalDuration += visit.durationSeconds;
        durationCount += 1;
      }

      if (visit.qualityScore !== null && visit.qualityScore !== undefined) {
        stat.qualityTotal += visit.qualityScore;
        stat.qualityCount += 1;
        qualityTotal += visit.qualityScore;
        qualityCount += 1;
      }

      cleanerStats.set(visit.cleanerId, stat);

      const dateKey = visit.scannedAt.toISOString().slice(0, 10);
      const trend = trendMap.get(dateKey) ?? {
        date: dateKey,
        completed: 0,
        rejected: 0,
        totalDurationSeconds: 0,
        durationCount: 0
      };

      if (COMPLETED_VISIT_STATUSES.has(visit.status)) {
        trend.completed += 1;
      }
      if (visit.status === CleaningVisitStatus.REJECTED) {
        trend.rejected += 1;
      }
      if (visit.durationSeconds && visit.durationSeconds > 0) {
        trend.totalDurationSeconds += visit.durationSeconds;
        trend.durationCount += 1;
      }

      trendMap.set(dateKey, trend);
    });

    const cleanerPerformance = [...cleanerStats.values()]
      .map((item) => {
        const avgDurationMinutes =
          item.durationCount === 0 ? 0 : item.durationTotalSeconds / item.durationCount / 60;
        const avgQualityScore =
          item.qualityCount === 0 ? 0 : Math.round(item.qualityTotal / item.qualityCount);
        const rejectionRate = item.totalVisits === 0 ? 0 : (item.rejectedVisits / item.totalVisits) * 100;
        const approvalRate = item.totalVisits === 0 ? 0 : (item.approvedVisits / item.totalVisits) * 100;
        const performanceScore = Math.round(
          approvalRate * 0.45 + (100 - rejectionRate) * 0.15 + avgQualityScore * 0.4
        );

        return {
          cleanerId: item.cleanerId,
          cleanerName: item.cleanerName,
          totalVisits: item.totalVisits,
          approvedVisits: item.approvedVisits,
          rejectedVisits: item.rejectedVisits,
          avgDurationMinutes: Math.round(avgDurationMinutes * 10) / 10,
          avgQualityScore,
          rejectionRate: Math.round(rejectionRate * 10) / 10,
          performanceScore
        };
      })
      .sort((a, b) => b.performanceScore - a.performanceScore);

    return {
      filters: {
        from: range.start.toISOString(),
        to: range.end.toISOString(),
        locationId: query.locationId ?? null,
        cleanerId: query.cleanerId ?? null
      },
      summary: {
        totalVisits: visits.length,
        avgCleaningTimeMinutes:
          durationCount === 0 ? 0 : Math.round((totalDuration / durationCount / 60) * 10) / 10,
        rejectionRate:
          visits.length === 0 ? 0 : Math.round((rejectedTotal / visits.length) * 1000) / 10,
        avgQualityScore: qualityCount === 0 ? 0 : Math.round(qualityTotal / qualityCount)
      },
      cleanerPerformance,
      leaderboard: cleanerPerformance.slice(0, 5),
      trend: [...trendMap.values()]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((row) => ({
          date: row.date,
          completed: row.completed,
          rejected: row.rejected,
          avgDurationMinutes:
            row.durationCount === 0
              ? 0
              : Math.round((row.totalDurationSeconds / row.durationCount / 60) * 10) / 10
        }))
    };
  }

  async getScheduleCalendar(tenantId: string | null, query: ScheduleCalendarQuery) {
    const range = this.parseDateRange(query.from, query.to, 14);

    const locations = await this.prisma.cleaningLocation.findMany({
      where: {
        tenantId: tenantId ?? undefined,
        isActive: true,
        id: query.locationId || undefined
      },
      select: {
        id: true,
        name: true,
        shiftAssignment: true,
        shiftWindow: true,
        cleaningFrequency: true,
        cleaningFrequencyUnit: true,
        assignedCleaner: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { name: "asc" }
    });

    if (locations.length === 0) {
      return {
        from: range.start,
        to: range.end,
        events: []
      };
    }

    const visits = await this.prisma.cleaningVisit.findMany({
      where: {
        tenantId: tenantId ?? undefined,
        locationId: {
          in: locations.map((location) => location.id)
        },
        scannedAt: {
          gte: range.start,
          lte: range.end
        }
      },
      select: {
        locationId: true,
        status: true,
        scannedAt: true
      }
    });

    const visitsByLocationDate = new Map<string, number>();

    visits.forEach((visit) => {
      if (!COMPLETED_VISIT_STATUSES.has(visit.status)) {
        return;
      }

      const dateKey = visit.scannedAt.toISOString().slice(0, 10);
      const key = `${visit.locationId}:${dateKey}`;
      visitsByLocationDate.set(key, (visitsByLocationDate.get(key) ?? 0) + 1);
    });

    const events: Array<{
      date: string;
      locationId: string;
      locationName: string;
      expectedVisits: number;
      completedVisits: number;
      pendingVisits: number;
      status: "COMPLETED" | "PENDING" | "MISSED";
      shiftAssignment: CleaningShift;
      shiftWindow: string | null;
      assignedCleaner: string | null;
    }> = [];

    const today = this.startOfDayUtc(new Date());
    const cursor = new Date(range.start);

    while (cursor <= range.end) {
      const dateKey = cursor.toISOString().slice(0, 10);

      locations.forEach((location) => {
        const expectedVisits = this.expectedVisitsForDate(location, cursor);
        const completedVisits = visitsByLocationDate.get(`${location.id}:${dateKey}`) ?? 0;
        const pendingVisits = Math.max(expectedVisits - completedVisits, 0);

        const status =
          pendingVisits <= 0
            ? "COMPLETED"
            : cursor < today
              ? "MISSED"
              : "PENDING";

        events.push({
          date: dateKey,
          locationId: location.id,
          locationName: location.name,
          expectedVisits,
          completedVisits,
          pendingVisits,
          status,
          shiftAssignment: location.shiftAssignment,
          shiftWindow: location.shiftWindow,
          assignedCleaner: location.assignedCleaner
            ? `${location.assignedCleaner.firstName} ${location.assignedCleaner.lastName}`
            : null
        });
      });

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return {
      from: range.start,
      to: range.end,
      events
    };
  }

  async runScheduleEnforcement(tenantId: string | null) {
    const now = new Date();
    const startOfToday = this.startOfDayUtc(now);
    const startOfTomorrow = new Date(startOfToday.getTime() + MS_IN_DAY);
    const dateKey = startOfToday.toISOString().slice(0, 10);

    const [locations, visitsToday, issueCounts] = await Promise.all([
      this.prisma.cleaningLocation.findMany({
        where: { tenantId: tenantId ?? undefined, isActive: true },
        select: {
          id: true,
          tenantId: true,
          name: true,
          cleaningFrequency: true,
          cleaningFrequencyUnit: true,
          shiftWindow: true,
          geoRadiusMeters: true
        }
      }),
      this.prisma.cleaningVisit.findMany({
        where: {
          tenantId: tenantId ?? undefined,
          scannedAt: { gte: startOfToday, lt: startOfTomorrow }
        },
        select: {
          locationId: true,
          status: true
        }
      }),
      this.prisma.facilityIssue.groupBy({
        by: ["locationId"],
        where: {
          tenantId: tenantId ?? undefined,
          status: {
            in: [FacilityIssueStatus.OPEN, FacilityIssueStatus.IN_PROGRESS]
          }
        },
        _count: {
          _all: true
        }
      })
    ]);

    const completedByLocation = new Map<string, number>();

    visitsToday.forEach((visit) => {
      if (COMPLETED_VISIT_STATUSES.has(visit.status)) {
        completedByLocation.set(visit.locationId, (completedByLocation.get(visit.locationId) ?? 0) + 1);
      }
    });

    const issueByLocation = new Map(
      issueCounts
        .filter((entry) => Boolean(entry.locationId))
        .map((entry) => [entry.locationId as string, entry._count._all])
    );

    const missedSchedules: Array<{
      locationId: string;
      locationName: string;
      expectedVisits: number;
      completedVisits: number;
      pendingVisits: number;
    }> = [];

    const lateVisits: Array<{
      locationId: string;
      locationName: string;
      shiftWindow: string | null;
    }> = [];

    const highIssueLocations: Array<{
      locationId: string;
      locationName: string;
      openIssueCount: number;
    }> = [];

    let expectedToday = 0;
    let completedToday = 0;
    let pendingToday = 0;
    let createdAlerts = 0;

    for (const location of locations) {
      const expected = this.expectedVisitsForDate(location, startOfToday);
      const completed = completedByLocation.get(location.id) ?? 0;
      const pending = Math.max(expected - completed, 0);

      expectedToday += expected;
      completedToday += completed;
      pendingToday += pending;

      if (pending > 0) {
        missedSchedules.push({
          locationId: location.id,
          locationName: location.name,
          expectedVisits: expected,
          completedVisits: completed,
          pendingVisits: pending
        });

        createdAlerts += await this.notifySupervisors(location.tenantId, {
          title: "Missed cleaning schedule",
          message: `${location.name} has ${pending} pending cleaning visit(s) today.`,
          type: NotificationType.CLEANING_MISSED,
          referenceId: location.id,
          referenceType: "CleaningLocation",
          dedupeKey: `cleaning-missed:${location.id}:${dateKey}`
        });
      }

      if (completed === 0 && this.isShiftOver(location.shiftWindow, now)) {
        lateVisits.push({
          locationId: location.id,
          locationName: location.name,
          shiftWindow: location.shiftWindow
        });

        createdAlerts += await this.notifySupervisors(location.tenantId, {
          title: "Late cleaning visit",
          message: `${location.name} has no completed visit after shift window ${location.shiftWindow ?? ""}.`,
          type: NotificationType.CLEANING_LATE_VISIT,
          referenceId: location.id,
          referenceType: "CleaningLocation",
          dedupeKey: `cleaning-late:${location.id}:${dateKey}`
        });
      }

      const openIssueCount = issueByLocation.get(location.id) ?? 0;
      if (openIssueCount >= 3) {
        highIssueLocations.push({
          locationId: location.id,
          locationName: location.name,
          openIssueCount
        });

        createdAlerts += await this.notifySupervisors(location.tenantId, {
          title: "High issue frequency",
          message: `${location.name} has ${openIssueCount} open/in-progress issues.`,
          type: NotificationType.CLEANING_HIGH_ISSUE,
          referenceId: location.id,
          referenceType: "CleaningLocation",
          dedupeKey: `cleaning-high-issue:${location.id}:${dateKey}`
        });
      }
    }

    return {
      evaluatedAt: now,
      totalLocations: locations.length,
      expectedToday,
      completedToday,
      pendingToday,
      complianceRate: this.calculateComplianceRate(completedToday, expectedToday),
      missedSchedules,
      lateVisits,
      highIssueLocations,
      createdAlerts
    };
  }

  private buildVisitWhere(params: VisitListParams | Omit<VisitListParams, "page" | "pageSize">) {
    const where: Prisma.CleaningVisitWhereInput = {
      tenantId: params.tenantId ?? undefined,
      locationId: params.locationId || undefined,
      status: this.isVisitStatus(params.status) ? params.status : undefined
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

      const start = this.startOfDayUtc(parsed);
      const end = new Date(start.getTime() + MS_IN_DAY);
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

  private validateClientTimestamp(clientScannedAt?: string) {
    if (!clientScannedAt) {
      return;
    }

    const parsed = new Date(clientScannedAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("Invalid client scan timestamp");
    }

    const diff = Math.abs(Date.now() - parsed.getTime());
    if (diff > this.maxClientTimestampSkewMs) {
      throw new BadRequestException("Scan timestamp is outside the allowed time window");
    }
  }

  private validateGeofence(
    location: {
      geoLatitude: Prisma.Decimal | null;
      geoLongitude: Prisma.Decimal | null;
      geoRadiusMeters: number;
    },
    latitude?: number,
    longitude?: number
  ) {
    if (location.geoLatitude === null || location.geoLongitude === null) {
      return {
        geoValidated: false,
        distanceMeters: null
      };
    }

    if (latitude === undefined || longitude === undefined) {
      throw new BadRequestException("Location geofence requires latitude and longitude");
    }

    const distance = this.haversineDistanceMeters(
      Number(location.geoLatitude),
      Number(location.geoLongitude),
      latitude,
      longitude
    );

    if (distance > location.geoRadiusMeters) {
      throw new BadRequestException(
        `You are outside the allowed geofence radius (${Math.round(distance)}m > ${location.geoRadiusMeters}m)`
      );
    }

    return {
      geoValidated: true,
      distanceMeters: new Prisma.Decimal(distance.toFixed(2))
    };
  }

  private expectedVisitsForDate(
    location: {
      cleaningFrequency: number;
      cleaningFrequencyUnit: CleaningFrequencyUnit;
    },
    _date: Date
  ) {
    if (location.cleaningFrequencyUnit === CleaningFrequencyUnit.PER_WEEK) {
      return Math.max(1, Math.round(location.cleaningFrequency / 7));
    }

    return Math.max(1, location.cleaningFrequency);
  }

  private expectedVisitsForWindow(
    location: {
      cleaningFrequency: number;
      cleaningFrequencyUnit: CleaningFrequencyUnit;
    },
    start: Date,
    end: Date
  ) {
    const startDay = this.startOfDayUtc(start);
    const endDay = this.startOfDayUtc(end);
    const dayCount = Math.max(1, Math.floor((endDay.getTime() - startDay.getTime()) / MS_IN_DAY) + 1);

    if (location.cleaningFrequencyUnit === CleaningFrequencyUnit.PER_WEEK) {
      return Math.max(location.cleaningFrequency, Math.ceil(dayCount / 7) * location.cleaningFrequency);
    }

    return Math.max(1, location.cleaningFrequency) * dayCount;
  }

  private evaluateScheduleStatus(shiftWindow: string | null | undefined, scannedAt: Date) {
    if (!shiftWindow) {
      return CleaningScheduleStatus.ON_TIME;
    }

    const endMinutes = this.parseShiftEndMinutes(shiftWindow);
    if (endMinutes === null) {
      return CleaningScheduleStatus.ON_TIME;
    }

    const scanMinutes = scannedAt.getHours() * 60 + scannedAt.getMinutes();
    return scanMinutes > endMinutes + 30
      ? CleaningScheduleStatus.LATE
      : CleaningScheduleStatus.ON_TIME;
  }

  private isShiftOver(shiftWindow: string | null | undefined, now: Date) {
    const endMinutes = this.parseShiftEndMinutes(shiftWindow);
    if (endMinutes === null) {
      return false;
    }

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return nowMinutes > endMinutes + 30;
  }

  private parseShiftEndMinutes(shiftWindow: string | null | undefined) {
    if (!shiftWindow) {
      return null;
    }

    const parts = shiftWindow.split("-");
    if (parts.length !== 2) {
      return null;
    }

    const end = parts[1].trim();
    const [hourPart, minutePart] = end.split(":");
    const hour = Number(hourPart);
    const minute = Number(minutePart);

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null;
    }

    return hour * 60 + minute;
  }

  private calculateChecklistScore(items: Array<{ checked: boolean }>) {
    if (items.length === 0) {
      return 0;
    }

    const checkedCount = items.filter((item) => item.checked).length;
    return Math.round((checkedCount / items.length) * 100);
  }

  private calculatePhotoScore(beforePhotos: string[] | null, afterPhotos: string[] | null) {
    const before = beforePhotos?.length ?? 0;
    const after = afterPhotos?.length ?? 0;

    let score = 0;
    if (before > 0) {
      score += 40;
    }
    if (after > 0) {
      score += 60;
    }

    return score;
  }

  private calculateQualityScore(input: {
    checklistScore?: number | null;
    photoScore?: number | null;
    rating?: number | null;
  }) {
    const checklistScore = this.clampPercent(input.checklistScore ?? 0);
    const photoScore = this.clampPercent(input.photoScore ?? 0);

    if (input.rating === null || input.rating === undefined) {
      return Math.round(checklistScore * 0.7 + photoScore * 0.3);
    }

    const ratingScore = this.clampPercent((input.rating / 5) * 100);
    return Math.round(checklistScore * 0.5 + photoScore * 0.2 + ratingScore * 0.3);
  }

  private clampPercent(value: number) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const earthRadius = 6371000;
    const toRadians = (value: number) => (value * Math.PI) / 180;

    const deltaLat = toRadians(lat2 - lat1);
    const deltaLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadius * c;
  }

  private parseDateRange(from: string | undefined, to: string | undefined, fallbackDays: number) {
    const now = new Date();
    const defaultEnd = now;
    const defaultStart = new Date(now.getTime() - (fallbackDays - 1) * MS_IN_DAY);

    const start = from ? new Date(from) : defaultStart;
    const end = to ? new Date(to) : defaultEnd;

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException("Invalid date range");
    }

    if (start > end) {
      throw new BadRequestException("From date cannot be after to date");
    }

    return {
      start,
      end
    };
  }

  private normalizePositiveInt(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private normalizeNumber(value: number | undefined, fallback: number, min: number, max: number) {
    if (value === undefined || !Number.isFinite(value)) {
      return fallback;
    }

    return Math.max(min, Math.min(max, Math.round(value)));
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
    return (
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "cleaning-location"
    );
  }

  private async notifySupervisors(
    tenantId: string | null,
    payload: {
      title: string;
      message: string;
      type: NotificationType;
      priority?: NotificationPriority;
      dueAt?: Date | null;
      metadata?: Prisma.InputJsonValue;
      referenceId?: string;
      referenceType?: string;
      dedupeKey?: string;
    }
  ) {
    const supervisors = await this.prisma.user.findMany({
      where: {
        tenantId: tenantId ?? undefined,
        isActive: true,
        role: { name: { in: [RoleName.SUPERVISOR, RoleName.ADMIN, RoleName.SUPER_ADMIN] } }
      },
      select: { id: true }
    });

    if (supervisors.length === 0) {
      this.logger.debug("No supervisors found to notify for cleaning event");
      return 0;
    }

    const supervisorIds = supervisors.map((supervisor) => supervisor.id);
    let targetIds = supervisorIds;

    if (payload.dedupeKey) {
      const existing = await this.prisma.notification.findMany({
        where: {
          userId: { in: supervisorIds },
          dedupeKey: payload.dedupeKey
        },
        select: { userId: true }
      });

      const existingSet = new Set(existing.map((entry) => entry.userId));
      targetIds = supervisorIds.filter((id) => !existingSet.has(id));
    }

    if (targetIds.length === 0) {
      return 0;
    }

    await this.notificationsService.createManyNotifications(
      targetIds.map((userId) => ({
        userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        priority: payload.priority,
        channel: "IN_APP",
        referenceId: payload.referenceId,
        referenceType: payload.referenceType,
        dueAt: payload.dueAt,
        metadata: payload.metadata,
        dedupeKey: payload.dedupeKey
      }))
    );

    return targetIds.length;
  }

  private async ensureAssignableCleaner(tenantId: string | null, userId: string) {
    const cleaner = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: tenantId ?? undefined,
        isActive: true,
        role: {
          name: {
            in: [RoleName.CLEANER, RoleName.SUPERVISOR]
          }
        }
      },
      select: {
        id: true
      }
    });

    if (!cleaner) {
      throw new BadRequestException("Assigned cleaner is invalid for this tenant");
    }
  }

  private toNullableDecimal(value: number | undefined) {
    if (value === undefined || value === null) {
      return undefined;
    }

    return new Prisma.Decimal(value);
  }

  private startOfDayUtc(value: Date) {
    const output = new Date(value);
    output.setUTCHours(0, 0, 0, 0);
    return output;
  }

  private startOfWeekUtc(value: Date) {
    const output = this.startOfDayUtc(value);
    const day = output.getUTCDay();
    const offset = day === 0 ? 6 : day - 1;
    output.setUTCDate(output.getUTCDate() - offset);
    return output;
  }

  private calculateComplianceRate(completed: number, expected: number) {
    if (expected <= 0) {
      return 100;
    }

    return Math.min(100, Math.round((completed / expected) * 100));
  }

  private isVisitStatus(value: unknown): value is CleaningVisitStatus {
    if (typeof value !== "string") {
      return false;
    }

    return Object.values(CleaningVisitStatus).includes(value as CleaningVisitStatus);
  }

  private isIssueStatus(value: unknown): value is FacilityIssueStatus {
    if (typeof value !== "string") {
      return false;
    }

    return Object.values(FacilityIssueStatus).includes(value as FacilityIssueStatus);
  }

  private async recordAudit(input: {
    tenantId?: string | null;
    actorId?: string | null;
    entity: string;
    entityId: string;
    action: AuditAction;
    beforeData?: unknown;
    afterData?: unknown;
  }) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId ?? null,
        actorId: input.actorId ?? null,
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        beforeData: this.toAuditJson(input.beforeData),
        afterData: this.toAuditJson(input.afterData)
      }
    });
  }

  private toAuditJson(value: unknown) {
    if (value === undefined || value === null) {
      return Prisma.JsonNull;
    }
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
