import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalRequestStatus, Priority, WorkOrderStatus } from "@prisma/client";

import { JOB_DOMAINS, parseJobDomain, type JobDomain } from "../../common/utils/job-domain.util";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "tenantId" | "role">;

const OPEN_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.OPEN,
  WorkOrderStatus.PLANNED,
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD,
  WorkOrderStatus.TECHNICIAN_COMPLETED,
  WorkOrderStatus.REWORK_REQUIRED,
  WorkOrderStatus.OVERDUE
];

const DEFAULT_CATEGORIES: Array<{
  jobDomain: JobDomain;
  main: { code: string; name: string };
  subs: Array<{ code: string; name: string }>;
}> = [
  {
    jobDomain: "MACHINERY",
    main: { code: "CORRECTIVE", name: "Corrective Maintenance" },
    subs: [
      { code: "MECHANICAL", name: "Mechanical" },
      { code: "ELECTRICAL", name: "Electrical" },
      { code: "HYDRAULIC", name: "Hydraulic" },
      { code: "PNEUMATIC", name: "Pneumatic" },
      { code: "MOTOR", name: "Motor" },
      { code: "CONVEYOR", name: "Conveyor" },
      { code: "COMPRESSOR", name: "Compressor" },
      { code: "REFRIGERATION", name: "Refrigeration" },
      { code: "GENERATOR", name: "Generator" }
    ]
  },
  {
    jobDomain: "SERVICE",
    main: { code: "FACILITY_SERVICE", name: "Facility Service" },
    subs: [
      { code: "ELECTRICAL_SERVICE", name: "Electrical Service" },
      { code: "PLUMBING", name: "Plumbing" },
      { code: "AC", name: "AC" },
      { code: "CIVIL", name: "Civil / Building" },
      { code: "CLEANING_EQUIPMENT", name: "Cleaning Equipment" },
      { code: "FIRE_SYSTEM", name: "Fire System" },
      { code: "CCTV", name: "CCTV" },
      { code: "NETWORK_IT", name: "Network / IT Infrastructure" },
      { code: "COLD_ROOM", name: "Cold Room" },
      { code: "PEST_CONTROL", name: "Pest Control" }
    ]
  },
  {
    jobDomain: "VEHICLE",
    main: { code: "VEHICLE_REPAIR", name: "Vehicle Repair" },
    subs: [
      { code: "ENGINE", name: "Engine" },
      { code: "BRAKE", name: "Brake" },
      { code: "ELECTRICAL_V", name: "Electrical" },
      { code: "TYRES", name: "Tyres" },
      { code: "BATTERY", name: "Battery" },
      { code: "SUSPENSION", name: "Suspension" },
      { code: "TRANSMISSION", name: "Transmission" },
      { code: "AC_V", name: "AC" },
      { code: "BODY_REPAIR", name: "Body Repair" },
      { code: "ACCIDENT_REPAIR", name: "Accident Repair" },
      { code: "SCHEDULED_SERVICE", name: "Scheduled Service" }
    ]
  }
];

const DEFAULT_PRIORITY_SLA: Array<{
  priority: Priority;
  responseMinutes: number;
  completionMinutes: number;
}> = [
  { priority: Priority.CRITICAL, responseMinutes: 30, completionMinutes: 4 * 60 },
  { priority: Priority.HIGH, responseMinutes: 2 * 60, completionMinutes: 24 * 60 },
  { priority: Priority.MEDIUM, responseMinutes: 8 * 60, completionMinutes: 72 * 60 },
  { priority: Priority.LOW, responseMinutes: 24 * 60, completionMinutes: 7 * 24 * 60 }
];

@Injectable()
export class MaintenanceConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async opsOverview(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const now = new Date();

    const [
      openJobs,
      machineryJobs,
      serviceJobs,
      vehicleJobs,
      criticalJobs,
      overdueJobs,
      waitingParts,
      externalJobs,
      pendingApprovals,
      pmDueSoon,
      _lowStockPlaceholder,
      requestsOpen
    ] = await Promise.all([
      this.prisma.workOrder.count({ where: { tenantId, status: { in: OPEN_STATUSES } } }),
      this.prisma.workOrder.count({
        where: { tenantId, jobDomain: "MACHINERY", status: { in: OPEN_STATUSES } }
      }),
      this.prisma.workOrder.count({
        where: { tenantId, jobDomain: "SERVICE", status: { in: OPEN_STATUSES } }
      }),
      this.prisma.workOrder.count({
        where: { tenantId, jobDomain: "VEHICLE", status: { in: OPEN_STATUSES } }
      }),
      this.prisma.workOrder.count({
        where: { tenantId, priority: Priority.CRITICAL, status: { in: OPEN_STATUSES } }
      }),
      this.prisma.workOrder.count({
        where: {
          tenantId,
          status: { in: OPEN_STATUSES },
          OR: [{ status: WorkOrderStatus.OVERDUE }, { dueDate: { lt: now } }]
        }
      }),
      this.prisma.workOrder.count({
        where: {
          tenantId,
          status: WorkOrderStatus.ON_HOLD,
          OR: [
            { holdReasonCode: { contains: "PART" } },
            { holdNotes: { contains: "part" } }
          ]
        }
      }),
      this.prisma.workOrder.count({
        where: {
          tenantId,
          status: { in: OPEN_STATUSES },
          OR: [{ executionMode: "EXTERNAL" }, { vendorSupplierId: { not: null } }]
        }
      }),
      this.prisma.approvalRequest.count({
        where: { tenantId, status: ApprovalRequestStatus.PENDING }
      }),
      this.prisma.pmPlan
        .count({
          where: {
            tenantId,
            nextDueAt: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }
          }
        })
        .catch(() => 0),
      Promise.resolve(0),
      this.prisma.maintenanceRequest.count({
        where: {
          tenantId,
          status: { in: ["NEW", "UNDER_REVIEW", "APPROVED"] }
        }
      })
    ]);

    void _lowStockPlaceholder;
    const parts = await this.prisma.sparePart.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, quantityInStock: true, minimumStock: true, reorderPoint: true },
      take: 500
    });
    const lowStockCount = parts.filter((p) => {
      const min = p.reorderPoint ?? p.minimumStock ?? 0;
      return (p.quantityInStock ?? 0) <= min;
    }).length;

    return {
      openJobs,
      machineryJobs,
      serviceJobs,
      vehicleJobs,
      criticalJobs,
      overdueJobs,
      waitingParts,
      externalJobs,
      pendingApprovals,
      pmDueSoon,
      lowStock: lowStockCount,
      requestsOpen,
      generatedAt: now.toISOString()
    };
  }

  async listJobCategories(actor: Actor, jobDomain?: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const domain = jobDomain ? parseJobDomain(jobDomain) : undefined;
    return this.prisma.maintenanceJobCategory.findMany({
      where: {
        tenantId,
        ...(domain ? { jobDomain: domain } : {})
      },
      orderBy: [{ jobDomain: "asc" }, { level: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: { select: { id: true, code: true, name: true, active: true, sortOrder: true } }
      }
    });
  }

  async createJobCategory(
    actor: Actor,
    input: {
      jobDomain: string;
      level: "MAIN" | "SUB";
      code: string;
      name: string;
      parentId?: string;
      sortOrder?: number;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const jobDomain = parseJobDomain(input.jobDomain);
    if (!jobDomain) throw new BadRequestException("Invalid jobDomain");
    if (!input.code?.trim() || !input.name?.trim()) {
      throw new BadRequestException("code and name are required");
    }
    if (input.level === "SUB" && !input.parentId) {
      throw new BadRequestException("SUB categories require parentId");
    }
    if (input.parentId) {
      const parent = await this.prisma.maintenanceJobCategory.findFirst({
        where: { id: input.parentId, tenantId, jobDomain }
      });
      if (!parent) throw new BadRequestException("Parent category not found");
    }

    return this.prisma.maintenanceJobCategory.create({
      data: {
        tenantId,
        jobDomain,
        level: input.level,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder ?? 0
      }
    });
  }

  async updateJobCategory(
    actor: Actor,
    id: string,
    input: { name?: string; active?: boolean; sortOrder?: number; parentId?: string | null }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const existing = await this.prisma.maintenanceJobCategory.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Job category not found");

    return this.prisma.maintenanceJobCategory.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {})
      }
    });
  }

  async seedDefaultCategories(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    let created = 0;
    let skipped = 0;

    for (const group of DEFAULT_CATEGORIES) {
      const main = await this.prisma.maintenanceJobCategory.upsert({
        where: {
          tenantId_jobDomain_code: {
            tenantId,
            jobDomain: group.jobDomain,
            code: group.main.code
          }
        },
        update: { name: group.main.name, level: "MAIN", active: true },
        create: {
          tenantId,
          jobDomain: group.jobDomain,
          level: "MAIN",
          code: group.main.code,
          name: group.main.name,
          sortOrder: 10
        }
      });
      created += 1;

      for (let i = 0; i < group.subs.length; i += 1) {
        const sub = group.subs[i];
        await this.prisma.maintenanceJobCategory.upsert({
          where: {
            tenantId_jobDomain_code: {
              tenantId,
              jobDomain: group.jobDomain,
              code: sub.code
            }
          },
          update: {
            name: sub.name,
            level: "SUB",
            parentId: main.id,
            active: true,
            sortOrder: (i + 1) * 10
          },
          create: {
            tenantId,
            jobDomain: group.jobDomain,
            level: "SUB",
            code: sub.code,
            name: sub.name,
            parentId: main.id,
            sortOrder: (i + 1) * 10
          }
        });
        created += 1;
      }
    }

    for (const rule of DEFAULT_PRIORITY_SLA) {
      await this.prisma.prioritySlaRule.upsert({
        where: { tenantId_priority: { tenantId, priority: rule.priority } },
        update: {
          responseMinutes: rule.responseMinutes,
          completionMinutes: rule.completionMinutes,
          active: true
        },
        create: {
          tenantId,
          priority: rule.priority,
          responseMinutes: rule.responseMinutes,
          completionMinutes: rule.completionMinutes
        }
      });
    }

    return { domains: [...JOB_DOMAINS], created, skipped };
  }

  async listPrioritySla(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const rules = await this.prisma.prioritySlaRule.findMany({
      where: { tenantId },
      orderBy: { priority: "asc" }
    });
    if (rules.length === 0) {
      await this.seedDefaultCategories(actor);
      return this.prisma.prioritySlaRule.findMany({
        where: { tenantId },
        orderBy: { priority: "asc" }
      });
    }
    return rules;
  }

  async upsertPrioritySla(
    actor: Actor,
    input: {
      priority: string;
      responseMinutes?: number | null;
      completionMinutes?: number | null;
      escalateOnBreach?: boolean;
      notifyOnBreach?: boolean;
      active?: boolean;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const priority = input.priority.trim().toUpperCase();
    const allowed = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
    if (!(allowed as readonly string[]).includes(priority)) {
      throw new BadRequestException("Invalid priority");
    }

    return this.prisma.prioritySlaRule.upsert({
      where: { tenantId_priority: { tenantId, priority } },
      update: {
        responseMinutes: input.responseMinutes ?? undefined,
        completionMinutes: input.completionMinutes ?? undefined,
        escalateOnBreach: input.escalateOnBreach,
        notifyOnBreach: input.notifyOnBreach,
        active: input.active
      },
      create: {
        tenantId,
        priority,
        responseMinutes: input.responseMinutes ?? null,
        completionMinutes: input.completionMinutes ?? null,
        escalateOnBreach: input.escalateOnBreach ?? true,
        notifyOnBreach: input.notifyOnBreach ?? true,
        active: input.active ?? true
      }
    });
  }

  integrationsStatus() {
    const flag = (configured: boolean, healthyHint?: boolean) => {
      if (!configured) return { status: "DISABLED" as const, label: "Waiting for Configuration" };
      if (healthyHint === false) return { status: "DEGRADED" as const, label: "Degraded" };
      return { status: "CONFIGURED" as const, label: "Configured" };
    };

    const erpConfigured = Boolean(process.env.BILEETA_BASE_URL || process.env.ERP_BASE_URL);
    const erpMock = (process.env.ERP_PROVIDER ?? "mock").toLowerCase() === "mock";
    const emailConfigured = Boolean(process.env.SMTP_HOST || process.env.EMAIL_PROVIDER);
    const smsConfigured = Boolean(process.env.SMS_PROVIDER && process.env.SMS_PROVIDER !== "disabled");
    const pushConfigured = Boolean(process.env.PUSH_PROVIDER && process.env.PUSH_PROVIDER !== "disabled");
    const storageConfigured = Boolean(
      process.env.MINIO_ENDPOINT || process.env.S3_BUCKET || process.env.CLOUDINARY_CLOUD_NAME
    );
    const redisConfigured = Boolean(process.env.REDIS_URL);
    const dbConfigured = Boolean(process.env.DATABASE_URL || process.env.PRIMARY_DATABASE_URL);

    return {
      database: { ...flag(dbConfigured, true), detail: "SQL Server via Prisma" },
      redis: { ...flag(redisConfigured), detail: redisConfigured ? "Queue backend configured" : "Queues degrade gracefully" },
      erp: {
        ...(erpMock
          ? { status: "DISABLED" as const, label: "Disabled (mock)" }
          : flag(erpConfigured)),
        detail: erpMock ? "Mock provider — no real ERP writes" : "Bileeta / ERP mapping"
      },
      email: { ...flag(emailConfigured), detail: "Transactional email" },
      sms: { ...flag(smsConfigured), detail: "SMS notifications" },
      push: { ...flag(pushConfigured), detail: "Push notifications" },
      storage: { ...flag(storageConfigured), detail: "Object storage for attachments" },
      queues: {
        ...flag(redisConfigured),
        detail: "Background job queues"
      }
    };
  }
}
