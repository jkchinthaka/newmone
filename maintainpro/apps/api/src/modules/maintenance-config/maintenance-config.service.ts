import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalRequestStatus, Priority, WorkOrderStatus } from "@prisma/client";

import { JOB_DOMAINS, parseJobDomain, type JobDomain } from "../../common/utils/job-domain.util";
import {
  buildAttentionQueues,
  DASHBOARD_OPEN_STATUSES
} from "../../common/utils/maintenance-dashboard.util";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import {
  assertValidHoldReason,
  DEFAULT_CAUSE_CODES,
  DEFAULT_FAILURE_CODES,
  DEFAULT_REMEDY_CODES,
  HOLD_REASON_CODES
} from "../work-orders/work-order-lifecycle";

type Actor = Pick<JwtPayload, "sub" | "tenantId" | "role">;

const OPEN_STATUSES = DASHBOARD_OPEN_STATUSES;

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

  /**
   * D6 Maintenance Dashboard aggregates — server-side counts only.
   * Read/decision-support; does not mutate Work Order state.
   */
  async opsOverview(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const now = new Date();
    const role = String(actor.role ?? "").toUpperCase();
    const canViewInventory = [
      "SUPER_ADMIN",
      "ADMIN",
      "MANAGER",
      "OPERATIONS_MANAGER",
      "INVENTORY_KEEPER",
      "ASSET_MANAGER"
    ].includes(role);
    const canViewApprovals = [
      "SUPER_ADMIN",
      "ADMIN",
      "MANAGER",
      "OPERATIONS_MANAGER",
      "SUPERVISOR",
      "MAINTENANCE_SUPERVISOR"
    ].includes(role);

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
      requestsOpen,
      unplannedJobs,
      unassignedJobs,
      inProgressJobs,
      onHoldJobs,
      verificationRequired,
      reworkRequired
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
      canViewApprovals
        ? this.prisma.approvalRequest.count({
            where: { tenantId, status: ApprovalRequestStatus.PENDING }
          })
        : Promise.resolve(null as number | null),
      this.prisma.pmPlan
        .count({
          where: {
            tenantId,
            nextDueAt: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }
          }
        })
        .catch(() => 0),
      this.prisma.maintenanceRequest.count({
        where: {
          tenantId,
          status: { in: ["NEW", "UNDER_REVIEW", "APPROVED"] }
        }
      }),
      // Unplanned = OPEN with no plan linkage (plannedAt null / status still OPEN intake)
      this.prisma.workOrder.count({
        where: { tenantId, status: WorkOrderStatus.OPEN }
      }),
      this.prisma.workOrder.count({
        where: {
          tenantId,
          status: { in: [WorkOrderStatus.OPEN, WorkOrderStatus.PLANNED] },
          technicianId: null
        }
      }),
      this.prisma.workOrder.count({
        where: { tenantId, status: WorkOrderStatus.IN_PROGRESS }
      }),
      this.prisma.workOrder.count({
        where: { tenantId, status: WorkOrderStatus.ON_HOLD }
      }),
      this.prisma.workOrder.count({
        where: { tenantId, status: WorkOrderStatus.TECHNICIAN_COMPLETED }
      }),
      this.prisma.workOrder.count({
        where: { tenantId, status: WorkOrderStatus.REWORK_REQUIRED }
      })
    ]);

    // Priority work list: same overdue/critical definition as the counts above,
    // but returns the actual work orders so supervisors can act directly from
    // the dashboard instead of only seeing a count.
    const priorityWorkOrders = await this.prisma.workOrder.findMany({
      where: {
        tenantId,
        status: { in: OPEN_STATUSES },
        OR: [
          { status: WorkOrderStatus.OVERDUE },
          { dueDate: { lt: now } },
          { priority: Priority.CRITICAL }
        ]
      },
      select: {
        id: true,
        woNumber: true,
        title: true,
        jobDomain: true,
        status: true,
        priority: true,
        dueDate: true
      },
      orderBy: [{ dueDate: "asc" }],
      take: 8
    });

    let lowStock: number | null = null;
    if (canViewInventory) {
      const parts = await this.prisma.sparePart.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, quantityInStock: true, minimumStock: true, reorderPoint: true },
        take: 500
      });
      lowStock = parts.filter((p) => {
        const min = p.reorderPoint ?? p.minimumStock ?? 0;
        return (p.quantityInStock ?? 0) <= min;
      }).length;
    }

    const attentionQueues = buildAttentionQueues({
      overdue: overdueJobs,
      unplanned: unplannedJobs,
      unassigned: unassignedJobs,
      inProgress: inProgressJobs,
      onHold: onHoldJobs,
      verificationRequired,
      reworkRequired,
      critical: criticalJobs,
      requestsOpen
    });

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
      lowStock,
      requestsOpen,
      unplannedJobs,
      unassignedJobs,
      inProgressJobs,
      onHoldJobs,
      verificationRequired,
      reworkRequired,
      attentionQueues,
      priorityWorkList: priorityWorkOrders.map((wo) => ({
        id: wo.id,
        woNumber: wo.woNumber,
        title: wo.title,
        jobDomain: wo.jobDomain,
        status: wo.status,
        priority: wo.priority,
        dueDate: wo.dueDate ? wo.dueDate.toISOString() : null
      })),
      availability: {
        inventory: canViewInventory,
        approvals: canViewApprovals,
        mttr: false,
        mtbf: false,
        erpExceptions: false,
        gateBlocks: false
      },
      notAvailable: {
        mttr: "Not Configured",
        mtbf: "Not Configured",
        erpExceptions: "Not Available",
        gateBlocks: "Not Available"
      },
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

  /**
   * Selectable categories for direct Work Order create dropdowns.
   * Defaults to active SUB rows for the domain (problem / service category leaves).
   */
  async listSelectableJobCategories(
    actor: Actor,
    input: { jobDomain: string; level?: "MAIN" | "SUB"; activeOnly?: boolean }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const domain = parseJobDomain(input.jobDomain);
    if (!domain) throw new BadRequestException("Invalid jobDomain");
    const level = input.level ?? "SUB";
    const activeOnly = input.activeOnly !== false;
    return this.prisma.maintenanceJobCategory.findMany({
      where: {
        tenantId,
        jobDomain: domain,
        level,
        ...(activeOnly ? { active: true } : {})
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        jobDomain: true,
        level: true,
        active: true,
        sortOrder: true,
        parentId: true
      }
    });
  }

  async assertJobCategoryForDomain(
    tenantId: string,
    jobCategoryId: string | null | undefined,
    jobDomain: JobDomain,
    options?: { required?: boolean }
  ): Promise<{ id: string; code: string; name: string } | null> {
    const required = options?.required === true;
    const id = jobCategoryId?.trim() || "";
    if (!id) {
      if (required) {
        throw new BadRequestException(
          jobDomain === "SERVICE"
            ? "Service Category is required."
            : "Problem Category is required."
        );
      }
      return null;
    }
    const row = await this.prisma.maintenanceJobCategory.findFirst({
      where: { id, tenantId },
      select: { id: true, code: true, name: true, jobDomain: true, active: true, level: true }
    });
    if (!row) {
      throw new BadRequestException("Selected category was not found for this tenant.");
    }
    if (!row.active) {
      throw new BadRequestException("Selected category is inactive.");
    }
    if (row.jobDomain !== jobDomain) {
      throw new BadRequestException(
        `Selected category is not applicable to ${jobDomain} work orders.`
      );
    }
    return { id: row.id, code: row.code, name: row.name };
  }

  async findJobCategoryMatch(
    tenantId: string,
    jobDomain: JobDomain,
    input: { code?: string | null; name?: string | null }
  ): Promise<{ id: string; code: string; name: string } | null> {
    const code = input.code?.trim().toUpperCase();
    const name = input.name?.trim();
    if (!code && !name) return null;
    const row = await this.prisma.maintenanceJobCategory.findFirst({
      where: {
        tenantId,
        jobDomain,
        active: true,
        OR: [
          ...(code ? [{ code }] : []),
          ...(name
            ? [
                { name: { equals: name } },
                { code: name.toUpperCase().replace(/\s+/g, "_") }
              ]
            : [])
        ]
      },
      select: { id: true, code: true, name: true },
      orderBy: [{ level: "desc" }, { sortOrder: "asc" }]
    });
    return row;
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

    const created = await this.prisma.maintenanceJobCategory.create({
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

    await this.recordConfigChange(actor, {
      entityType: "MaintenanceJobCategory",
      entityId: created.id,
      action: "CREATE",
      reason: "Job category created",
      beforeJson: null,
      afterJson: created
    });

    return created;
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
    }).then(async (updated) => {
      await this.recordConfigChange(actor, {
        entityType: "MaintenanceJobCategory",
        entityId: id,
        action: "UPDATE",
        beforeJson: existing,
        afterJson: updated
      });
      return updated;
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

    await this.seedAnalysisAndReasonDefaults(actor);

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
      reason?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const priority = input.priority.trim().toUpperCase();
    const allowed = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
    if (!(allowed as readonly string[]).includes(priority)) {
      throw new BadRequestException("Invalid priority");
    }

    const before = await this.prisma.prioritySlaRule.findUnique({
      where: { tenantId_priority: { tenantId, priority } }
    });

    const saved = await this.prisma.prioritySlaRule.upsert({
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

    await this.recordConfigChange(actor, {
      entityType: "PrioritySlaRule",
      entityId: saved.id,
      action: before ? "UPDATE" : "CREATE",
      reason: input.reason ?? "Priority SLA configuration change",
      beforeJson: before,
      afterJson: saved
    });

    return saved;
  }

  /**
   * Resolve completion SLA hours from Admin PrioritySlaRule.
   * Falls back to software defaults when no active rule exists.
   */
  async resolveCompletionHours(tenantId: string, priority: string): Promise<number> {
    const normalized = priority.trim().toUpperCase();
    const rule = await this.prisma.prioritySlaRule.findFirst({
      where: { tenantId, priority: normalized, active: true }
    });
    if (rule?.completionMinutes != null && rule.completionMinutes > 0) {
      return rule.completionMinutes / 60;
    }
    switch (normalized) {
      case "CRITICAL":
        return 4;
      case "HIGH":
        return 24;
      case "MEDIUM":
        return 72;
      case "LOW":
      default:
        return 168;
    }
  }

  async resolveResponseMinutes(tenantId: string, priority: string): Promise<number | null> {
    const rule = await this.prisma.prioritySlaRule.findFirst({
      where: { tenantId, priority: priority.trim().toUpperCase(), active: true }
    });
    return rule?.responseMinutes ?? null;
  }

  async listAnalysisCodes(actor: Actor, kind?: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const count = await this.prisma.maintenanceAnalysisCode.count({ where: { tenantId } });
    if (count === 0) {
      await this.seedAnalysisAndReasonDefaults(actor);
    }
    return this.prisma.maintenanceAnalysisCode.findMany({
      where: {
        tenantId,
        ...(kind ? { kind: kind.trim().toUpperCase() } : {})
      },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
    });
  }

  async upsertAnalysisCode(
    actor: Actor,
    input: {
      kind: string;
      code: string;
      name: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
      reason?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const kind = input.kind.trim().toUpperCase();
    const code = input.code.trim().toUpperCase();
    if (!["FAILURE", "CAUSE", "REMEDY"].includes(kind)) {
      throw new BadRequestException("kind must be FAILURE, CAUSE, or REMEDY");
    }
    if (!code || !input.name?.trim()) {
      throw new BadRequestException("code and name are required");
    }

    const before = await this.prisma.maintenanceAnalysisCode.findUnique({
      where: { tenantId_kind_code: { tenantId, kind, code } }
    });

    const saved = await this.prisma.maintenanceAnalysisCode.upsert({
      where: { tenantId_kind_code: { tenantId, kind, code } },
      update: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true
      },
      create: {
        tenantId,
        kind,
        code,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true
      }
    });

    await this.recordConfigChange(actor, {
      entityType: "MaintenanceAnalysisCode",
      entityId: saved.id,
      action: before ? "UPDATE" : "CREATE",
      reason: input.reason ?? "Analysis code configuration change",
      beforeJson: before,
      afterJson: saved
    });

    return saved;
  }

  async listReasonCodes(actor: Actor, kind?: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const count = await this.prisma.maintenanceReasonCode.count({ where: { tenantId } });
    if (count === 0) {
      await this.seedAnalysisAndReasonDefaults(actor);
    }
    return this.prisma.maintenanceReasonCode.findMany({
      where: {
        tenantId,
        ...(kind ? { kind: kind.trim().toUpperCase() } : {})
      },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
    });
  }

  async upsertReasonCode(
    actor: Actor,
    input: {
      kind: string;
      code: string;
      name: string;
      description?: string;
      requiresNotes?: boolean;
      sortOrder?: number;
      active?: boolean;
      reason?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const kind = input.kind.trim().toUpperCase();
    const code = input.code.trim().toUpperCase();
    if (!["HOLD", "DELAY"].includes(kind)) {
      throw new BadRequestException("kind must be HOLD or DELAY");
    }
    if (!code || !input.name?.trim()) {
      throw new BadRequestException("code and name are required");
    }

    const before = await this.prisma.maintenanceReasonCode.findUnique({
      where: { tenantId_kind_code: { tenantId, kind, code } }
    });

    const saved = await this.prisma.maintenanceReasonCode.upsert({
      where: { tenantId_kind_code: { tenantId, kind, code } },
      update: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        requiresNotes: input.requiresNotes ?? false,
        sortOrder: input.sortOrder ?? 0,
        active: input.active ?? true
      },
      create: {
        tenantId,
        kind,
        code,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        requiresNotes: input.requiresNotes ?? false,
        sortOrder: input.sortOrder ?? 0,
        active: input.active ?? true
      }
    });

    await this.recordConfigChange(actor, {
      entityType: "MaintenanceReasonCode",
      entityId: saved.id,
      action: before ? "UPDATE" : "CREATE",
      reason: input.reason ?? "Reason code configuration change",
      beforeJson: before,
      afterJson: saved
    });

    return saved;
  }

  async assertHoldReason(tenantId: string, code: string, notes?: string | null) {
    const normalized = code.trim().toUpperCase();
    const row = await this.prisma.maintenanceReasonCode.findFirst({
      where: { tenantId, kind: "HOLD", code: normalized, active: true }
    });
    if (!row) {
      // Fallback to software defaults if tenant has not seeded masters yet
      assertValidHoldReason(normalized, notes);
      return;
    }
    if (row.requiresNotes && (!notes || notes.trim().length < 3)) {
      throw new BadRequestException(`Hold notes are required when reason is ${row.code}`);
    }
  }

  async listConfigHistory(
    actor: Actor,
    query: { entityType?: string; entityId?: string; limit?: number } = {}
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.configChangeHistory.findMany({
      where: {
        tenantId,
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {})
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(query.limit ?? 50, 200),
      include: {
        actor: { select: { id: true, email: true, firstName: true, lastName: true } }
      }
    });
  }

  async seedAnalysisAndReasonDefaults(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);

    const seedKind = async (
      kind: string,
      items: ReadonlyArray<{ code: string; name: string }>
    ) => {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        await this.prisma.maintenanceAnalysisCode.upsert({
          where: {
            tenantId_kind_code: { tenantId, kind, code: item.code }
          },
          update: { name: item.name, isActive: true, sortOrder: (i + 1) * 10 },
          create: {
            tenantId,
            kind,
            code: item.code,
            name: item.name,
            sortOrder: (i + 1) * 10
          }
        });
      }
    };

    await seedKind("FAILURE", DEFAULT_FAILURE_CODES);
    await seedKind("CAUSE", DEFAULT_CAUSE_CODES);
    await seedKind("REMEDY", DEFAULT_REMEDY_CODES);

    const holdLabels: Record<string, string> = {
      WAITING_PARTS: "Waiting for Parts",
      WAITING_VENDOR: "Waiting for Vendor",
      WAITING_PRODUCTION: "Waiting for Production",
      WAITING_APPROVAL: "Waiting for Approval",
      WAITING_TOOL: "Waiting for Tool",
      WAITING_ACCESS: "Waiting for Access",
      SAFETY_HOLD: "Safety Hold",
      OTHER: "Other"
    };

    for (let i = 0; i < HOLD_REASON_CODES.length; i += 1) {
      const code = HOLD_REASON_CODES[i];
      await this.prisma.maintenanceReasonCode.upsert({
        where: { tenantId_kind_code: { tenantId, kind: "HOLD", code } },
        update: {
          name: holdLabels[code] ?? code,
          requiresNotes: code === "OTHER",
          active: true,
          sortOrder: (i + 1) * 10
        },
        create: {
          tenantId,
          kind: "HOLD",
          code,
          name: holdLabels[code] ?? code,
          requiresNotes: code === "OTHER",
          sortOrder: (i + 1) * 10
        }
      });
    }

    const delayDefaults = [
      { code: "WAITING_PARTS", name: "Waiting for Parts" },
      { code: "WAITING_APPROVAL", name: "Waiting for Approval" },
      { code: "WAITING_VENDOR", name: "Waiting for Vendor" },
      { code: "ASSET_IN_USE", name: "Asset In Use" },
      { code: "TECHNICIAN_UNAVAILABLE", name: "Technician Unavailable" },
      { code: "OPERATIONAL_CONSTRAINT", name: "Operational Constraint" },
      { code: "OTHER", name: "Other" }
    ];
    for (let i = 0; i < delayDefaults.length; i += 1) {
      const item = delayDefaults[i];
      await this.prisma.maintenanceReasonCode.upsert({
        where: { tenantId_kind_code: { tenantId, kind: "DELAY", code: item.code } },
        update: {
          name: item.name,
          requiresNotes: item.code === "OTHER",
          active: true,
          sortOrder: (i + 1) * 10
        },
        create: {
          tenantId,
          kind: "DELAY",
          code: item.code,
          name: item.name,
          requiresNotes: item.code === "OTHER",
          sortOrder: (i + 1) * 10
        }
      });
    }

    return { ok: true };
  }

  private async recordConfigChange(
    actor: Actor,
    input: {
      entityType: string;
      entityId: string;
      action: string;
      reason?: string;
      beforeJson?: unknown;
      afterJson?: unknown;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const priorCount = await this.prisma.configChangeHistory.count({
      where: {
        tenantId,
        entityType: input.entityType,
        entityId: input.entityId
      }
    });
    await this.prisma.configChangeHistory.create({
      data: {
        tenantId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        reason: input.reason ?? null,
        beforeJson: input.beforeJson != null ? JSON.stringify(input.beforeJson) : null,
        afterJson: input.afterJson != null ? JSON.stringify(input.afterJson) : null,
        version: priorCount + 1,
        actorId: actor.sub ?? null
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
