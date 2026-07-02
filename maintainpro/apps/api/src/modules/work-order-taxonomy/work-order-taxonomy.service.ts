import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, Priority, RoleName, WorkOrderStatus, WorkOrderTaxonomyLevel } from "@prisma/client";

import {
  searchTaxonomyRows,
  suggestWorkOrderTaxonomy,
  type TaxonomySuggestCandidate
} from "../../common/utils/work-order-taxonomy-suggest";
import { PrismaService } from "../../database/prisma.service";
import {
  TRIAGE_CATEGORY_CODE,
  WORK_ORDER_TAXONOMY_SEED,
  type TaxonomySeedCategory,
  type TaxonomySeedIssue,
  type TaxonomySeedRules,
  type TaxonomySeedType
} from "../../database/work-order-taxonomy-seed";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

export type UpsertTaxonomyInput = {
  code?: string;
  name: string;
  description?: string;
  parentId?: string | null;
  level: WorkOrderTaxonomyLevel;
  sortOrder?: number;
  departmentScope?: string;
  defaultPriority?: Priority;
  defaultSlaHours?: number;
  requiresAsset?: boolean;
  requiresVehicle?: boolean;
  requiresLocation?: boolean;
  requiresEvidence?: boolean;
  requiresSupervisorVerification?: boolean;
  requiresPartsReview?: boolean;
  requiresFinanceApproval?: boolean;
  gateOutBlockingRisk?: boolean;
  downtimeTrackingRequired?: boolean;
  allowedRoles?: string[];
  aliases?: string[];
  keywords?: string[];
  commonMistakes?: string[];
  sinhalaKeywords?: string[];
  departmentHints?: string[];
  active?: boolean;
};

const ADMIN_ROLES = new Set<RoleName>([RoleName.SUPER_ADMIN, RoleName.ADMIN]);
const TAXONOMY_MANAGER_ROLES = new Set<RoleName>([
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN,
  RoleName.MANAGER,
  RoleName.OPERATIONS_MANAGER,
  RoleName.ASSET_MANAGER
]);

@Injectable()
export class WorkOrderTaxonomyService {
  private readonly logger = new Logger(WorkOrderTaxonomyService.name);
  private readonly seededTenants = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  private resolveTenantId(actor?: Actor): string | null | undefined {
    return actor?.tenantId === undefined ? undefined : actor.tenantId ?? null;
  }

  async ensureSeed(tenantId: string | null | undefined) {
    const key = tenantId ?? "__global__";
    if (this.seededTenants.has(key)) return;
    const existing = await this.prisma.workOrderTaxonomy.count({
      where: { tenantId: tenantId ?? null, level: WorkOrderTaxonomyLevel.CATEGORY }
    });
    if (existing > 0) {
      this.seededTenants.add(key);
      return;
    }
    await this.seedTenant(tenantId ?? null);
    this.seededTenants.add(key);
  }

  private async seedTenant(tenantId: string | null) {
    for (const category of WORK_ORDER_TAXONOMY_SEED) {
      await this.createSeedCategory(tenantId, category);
    }
  }

  private async createSeedCategory(tenantId: string | null, category: TaxonomySeedCategory) {
    const createdCategory = await this.prisma.workOrderTaxonomy.create({
      data: this.buildSeedData(tenantId, category, WorkOrderTaxonomyLevel.CATEGORY, null, category.rules)
    });

    for (const [typeIndex, type] of category.types.entries()) {
      const createdType = await this.prisma.workOrderTaxonomy.create({
        data: {
          ...this.buildSeedData(tenantId, type, WorkOrderTaxonomyLevel.TYPE, createdCategory.id, type.rules),
          sortOrder: typeIndex
        }
      });

      for (const [issueIndex, issue] of (type.issues ?? []).entries()) {
        await this.prisma.workOrderTaxonomy.create({
          data: {
            ...this.buildSeedData(tenantId, issue, WorkOrderTaxonomyLevel.ISSUE, createdType.id, issue.rules),
            sortOrder: issueIndex
          }
        });
      }
    }
  }

  private buildSeedData(
    tenantId: string | null,
    node: TaxonomySeedCategory | TaxonomySeedType | TaxonomySeedIssue,
    level: WorkOrderTaxonomyLevel,
    parentId: string | null,
    rules?: TaxonomySeedRules
  ): Prisma.WorkOrderTaxonomyCreateInput {
    return {
      tenant: tenantId ? { connect: { id: tenantId } } : undefined,
      code: node.code,
      name: node.name,
      level,
      parent: parentId ? { connect: { id: parentId } } : undefined,
      sortOrder: "sortOrder" in node ? (node as TaxonomySeedCategory).sortOrder : 0,
      active: true,
      aliases: "aliases" in node ? (node.aliases ?? []) : [],
      keywords: "keywords" in node ? (node.keywords ?? []) : [],
      sinhalaKeywords: "sinhalaKeywords" in node ? (node.sinhalaKeywords ?? []) : [],
      commonMistakes: "commonMistakes" in node ? (node.commonMistakes ?? []) : [],
      defaultPriority: rules?.defaultPriority,
      defaultSlaHours: rules?.defaultSlaHours,
      requiresAsset: rules?.requiresAsset ?? false,
      requiresVehicle: rules?.requiresVehicle ?? false,
      requiresLocation: rules?.requiresLocation ?? false,
      requiresEvidence: rules?.requiresEvidence ?? false,
      requiresSupervisorVerification: rules?.requiresSupervisorVerification ?? false,
      requiresPartsReview: rules?.requiresPartsReview ?? false,
      requiresFinanceApproval: rules?.requiresFinanceApproval ?? false,
      gateOutBlockingRisk: rules?.gateOutBlockingRisk ?? false,
      downtimeTrackingRequired: rules?.downtimeTrackingRequired ?? false,
      allowedRoles: rules?.allowedRoles ?? []
    };
  }

  async list(actor: Actor, params: { includeInactive?: boolean; level?: WorkOrderTaxonomyLevel; parentId?: string | "null" } = {}) {
    const tenantId = this.resolveTenantId(actor);
    await this.ensureSeed(tenantId ?? null);

    const parentFilter =
      params.parentId === undefined
        ? {}
        : params.parentId === "null"
          ? { parentId: null }
          : { parentId: params.parentId };

    const rows = await this.prisma.workOrderTaxonomy.findMany({
      where: {
        tenantId: tenantId ?? null,
        active: params.includeInactive ? undefined : true,
        level: params.level,
        ...parentFilter
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });

    return this.attachUsageCounts(tenantId ?? null, rows);
  }

  async search(actor: Actor, q: string, limit = 25) {
    const tenantId = this.resolveTenantId(actor);
    await this.ensureSeed(tenantId ?? null);
    const candidates = await this.loadSuggestCandidates(tenantId ?? null, false);
    return searchTaxonomyRows(q, candidates, limit);
  }

  async suggest(actor: Actor, q: string) {
    const query = q.trim();
    try {
      const tenantId = this.resolveTenantId(actor);
      await this.ensureSeed(tenantId ?? null);
      const candidates = await this.loadSuggestCandidates(tenantId ?? null, true);
      const suggestion = query.length >= 2 ? suggestWorkOrderTaxonomy(query, candidates) : null;
      const suggestions =
        query.length >= 2
          ? searchTaxonomyRows(query, candidates, 5).map((row) => ({
              categoryId: row.categoryId,
              typeId: row.typeId,
              issueId: row.issueId,
              categoryName: row.categoryName,
              typeName: row.typeName,
              issueName: row.issueName,
              pathLabel: row.pathLabel,
              confidence: row.score,
              matchedKeywords: row.matchedKeywords,
              defaultPriority: row.defaultPriority ?? undefined,
              requiresAsset: row.requiresAsset ?? false,
              requiresVehicle: row.requiresVehicle ?? false,
              requiresLocation: row.requiresLocation ?? false,
              requiresEvidence: row.requiresEvidence ?? false,
              gateOutBlockingRisk: row.gateOutBlockingRisk ?? false,
              warnings: [] as string[]
            }))
          : [];

      return {
        query,
        suggestion,
        suggestions,
        method: "rule_based_keyword_matching",
        roadmapNote: "Future AI-assisted classification can augment rule-based suggestions."
      };
    } catch (error) {
      this.logger.warn(
        `Taxonomy suggestion failed for query "${query}"`,
        error instanceof Error ? error.message : String(error)
      );
      return {
        query,
        suggestion: null,
        suggestions: [],
        method: "unavailable",
        roadmapNote: "Taxonomy suggestions temporarily unavailable."
      };
    }
  }

  private async loadSuggestCandidates(tenantId: string | null, activeOnly: boolean): Promise<TaxonomySuggestCandidate[]> {
    const rows = await this.prisma.workOrderTaxonomy.findMany({
      where: { tenantId, ...(activeOnly ? { active: true } : {}) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
    const byId = new Map(rows.map((row) => [row.id, row]));

    return rows.map((row) => {
      const category =
        row.level === WorkOrderTaxonomyLevel.CATEGORY
          ? row
          : row.level === WorkOrderTaxonomyLevel.TYPE
            ? (row.parentId ? byId.get(row.parentId) : undefined)
            : (() => {
                const type = row.parentId ? byId.get(row.parentId) : undefined;
                return type?.parentId ? byId.get(type.parentId) : undefined;
              })();
      const type =
        row.level === WorkOrderTaxonomyLevel.TYPE
          ? row
          : row.level === WorkOrderTaxonomyLevel.ISSUE
            ? (row.parentId ? byId.get(row.parentId) : undefined)
            : undefined;

      return {
        id: row.id,
        code: row.code,
        name: row.name,
        level: row.level,
        parentId: row.parentId,
        categoryName: category?.name,
        typeName: type?.name,
        aliases: row.aliases,
        keywords: row.keywords,
        sinhalaKeywords: row.sinhalaKeywords,
        defaultPriority: row.defaultPriority,
        requiresAsset: row.requiresAsset,
        requiresVehicle: row.requiresVehicle,
        requiresLocation: row.requiresLocation,
        requiresEvidence: row.requiresEvidence,
        gateOutBlockingRisk: row.gateOutBlockingRisk
      };
    });
  }

  async resolveTaxonomySelection(
    tenantId: string | null | undefined,
    input: {
      taxonomyCategoryId?: string;
      taxonomyTypeId?: string;
      taxonomyIssueId?: string;
      isTriage?: boolean;
    }
  ) {
    await this.ensureSeed(tenantId ?? null);

    if (input.isTriage) {
      const triageCategory = await this.prisma.workOrderTaxonomy.findFirst({
        where: { tenantId: tenantId ?? null, code: TRIAGE_CATEGORY_CODE, level: WorkOrderTaxonomyLevel.CATEGORY }
      });
      const triageType = triageCategory
        ? await this.prisma.workOrderTaxonomy.findFirst({
            where: {
              tenantId: tenantId ?? null,
              parentId: triageCategory.id,
              level: WorkOrderTaxonomyLevel.TYPE
            },
            orderBy: { sortOrder: "asc" }
          })
        : null;

      return {
        taxonomyCategoryId: triageCategory?.id,
        taxonomyTypeId: triageType?.id,
        taxonomyIssueId: undefined,
        categoryNameSnapshot: triageCategory?.name ?? "Not Sure / Triage",
        typeNameSnapshot: triageType?.name ?? "Need Triage Classification",
        issueNameSnapshot: undefined,
        isTriage: true,
        rules: triageType ?? triageCategory
      };
    }

    const issue = input.taxonomyIssueId
      ? await this.findTaxonomyNode(tenantId, input.taxonomyIssueId, WorkOrderTaxonomyLevel.ISSUE)
      : null;
    const type = issue
      ? await this.findTaxonomyNode(tenantId, issue.parentId!, WorkOrderTaxonomyLevel.TYPE)
      : input.taxonomyTypeId
        ? await this.findTaxonomyNode(tenantId, input.taxonomyTypeId, WorkOrderTaxonomyLevel.TYPE)
        : null;
    const category = type
      ? await this.findTaxonomyNode(tenantId, type.parentId!, WorkOrderTaxonomyLevel.CATEGORY)
      : input.taxonomyCategoryId
        ? await this.findTaxonomyNode(tenantId, input.taxonomyCategoryId, WorkOrderTaxonomyLevel.CATEGORY)
        : null;

    if (!category || !type) {
      throw new BadRequestException("Work order category and type are required unless submitting to triage.");
    }

    return {
      taxonomyCategoryId: category.id,
      taxonomyTypeId: type.id,
      taxonomyIssueId: issue?.id,
      categoryNameSnapshot: category.name,
      typeNameSnapshot: type.name,
      issueNameSnapshot: issue?.name,
      isTriage: category.code === TRIAGE_CATEGORY_CODE,
      rules: issue ?? type
    };
  }

  private async findTaxonomyNode(
    tenantId: string | null | undefined,
    id: string,
    level: WorkOrderTaxonomyLevel
  ) {
    const row = await this.prisma.workOrderTaxonomy.findFirst({
      where: { id, tenantId: tenantId ?? null, level }
    });
    if (!row) throw new BadRequestException(`Invalid taxonomy ${level.toLowerCase()} selection`);
    return row;
  }

  assertCanManageTaxonomy(actor: Actor) {
    if (!TAXONOMY_MANAGER_ROLES.has(actor.role as RoleName)) {
      throw new ForbiddenException("You do not have permission to manage work order taxonomy.");
    }
  }

  async create(actor: Actor, input: UpsertTaxonomyInput) {
    this.assertCanManageTaxonomy(actor);
    const tenantId = this.resolveTenantId(actor) ?? null;
    const code = (input.code ?? this.slugCode(input.name)).toUpperCase();

    const existing = await this.prisma.workOrderTaxonomy.findFirst({
      where: { tenantId, code }
    });
    if (existing) throw new BadRequestException("Taxonomy code already exists");

    if (input.parentId) {
      await this.findTaxonomyNode(tenantId, input.parentId, this.expectedParentLevel(input.level));
    }

    const created = await this.prisma.workOrderTaxonomy.create({
      data: this.buildUpsertData(tenantId, input, code, actor.sub)
    });

    await this.recordTaxonomyAudit(actor, "taxonomy_created", created.id, null, created);
    return created;
  }

  async update(actor: Actor, id: string, input: Partial<UpsertTaxonomyInput>) {
    this.assertCanManageTaxonomy(actor);
    const tenantId = this.resolveTenantId(actor) ?? null;
    const before = await this.prisma.workOrderTaxonomy.findFirst({ where: { id, tenantId } });
    if (!before) throw new NotFoundException("Taxonomy entry not found");

    const updated = await this.prisma.workOrderTaxonomy.update({
      where: { id },
      data: {
        name: input.name?.trim() ?? before.name,
        description: input.description ?? before.description,
        sortOrder: input.sortOrder ?? before.sortOrder,
        departmentScope: input.departmentScope ?? before.departmentScope,
        defaultPriority: input.defaultPriority ?? before.defaultPriority,
        defaultSlaHours: input.defaultSlaHours ?? before.defaultSlaHours,
        requiresAsset: input.requiresAsset ?? before.requiresAsset,
        requiresVehicle: input.requiresVehicle ?? before.requiresVehicle,
        requiresLocation: input.requiresLocation ?? before.requiresLocation,
        requiresEvidence: input.requiresEvidence ?? before.requiresEvidence,
        requiresSupervisorVerification: input.requiresSupervisorVerification ?? before.requiresSupervisorVerification,
        requiresPartsReview: input.requiresPartsReview ?? before.requiresPartsReview,
        requiresFinanceApproval: input.requiresFinanceApproval ?? before.requiresFinanceApproval,
        gateOutBlockingRisk: input.gateOutBlockingRisk ?? before.gateOutBlockingRisk,
        downtimeTrackingRequired: input.downtimeTrackingRequired ?? before.downtimeTrackingRequired,
        allowedRoles: input.allowedRoles ?? before.allowedRoles,
        aliases: input.aliases ?? before.aliases,
        keywords: input.keywords ?? before.keywords,
        commonMistakes: input.commonMistakes ?? before.commonMistakes,
        sinhalaKeywords: input.sinhalaKeywords ?? before.sinhalaKeywords,
        departmentHints: input.departmentHints ?? before.departmentHints,
        active: input.active ?? before.active,
        updatedById: actor.sub
      }
    });

    const action =
      before.active && input.active === false
        ? "taxonomy_deactivated"
        : !before.active && input.active === true
          ? "taxonomy_reactivated"
          : "taxonomy_updated";

    await this.recordTaxonomyAudit(actor, action, id, before, updated);
    return updated;
  }

  async deactivate(actor: Actor, id: string) {
    return this.update(actor, id, { active: false });
  }

  async getUsage(actor: Actor, id: string) {
    const tenantId = this.resolveTenantId(actor) ?? null;
    const row = await this.prisma.workOrderTaxonomy.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Taxonomy entry not found");
    return this.usageForNode(id, tenantId);
  }

  private async usageForNode(id: string, tenantId: string | null) {
    const [categoryCount, typeCount, issueCount, activeCount, completedCount] = await Promise.all([
      this.prisma.workOrder.count({ where: { tenantId: tenantId ?? undefined, taxonomyCategoryId: id } }),
      this.prisma.workOrder.count({ where: { tenantId: tenantId ?? undefined, taxonomyTypeId: id } }),
      this.prisma.workOrder.count({ where: { tenantId: tenantId ?? undefined, taxonomyIssueId: id } }),
      this.prisma.workOrder.count({
        where: {
          tenantId: tenantId ?? undefined,
          OR: [{ taxonomyCategoryId: id }, { taxonomyTypeId: id }, { taxonomyIssueId: id }],
          status: { notIn: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED] }
        }
      }),
      this.prisma.workOrder.count({
        where: {
          tenantId: tenantId ?? undefined,
          OR: [{ taxonomyCategoryId: id }, { taxonomyTypeId: id }, { taxonomyIssueId: id }],
          status: WorkOrderStatus.COMPLETED
        }
      })
    ]);

    return {
      totalWorkOrders: categoryCount + typeCount + issueCount,
      activeWorkOrders: activeCount,
      completedWorkOrders: completedCount
    };
  }

  private async attachUsageCounts(tenantId: string | null, rows: Array<{ id: string }>) {
    const usageEntries = await Promise.all(rows.map(async (row) => [row.id, await this.usageForNode(row.id, tenantId)] as const));
    const usageMap = Object.fromEntries(usageEntries);
    return rows.map((row) => ({ ...row, usage: usageMap[row.id] }));
  }

  private buildUpsertData(
    tenantId: string | null,
    input: UpsertTaxonomyInput,
    code: string,
    actorId?: string,
    isUpdate = false
  ): Prisma.WorkOrderTaxonomyCreateInput {
    return {
      tenant: tenantId ? { connect: { id: tenantId } } : undefined,
      code,
      name: input.name.trim(),
      description: input.description,
      level: input.level,
      parent: input.parentId ? { connect: { id: input.parentId } } : undefined,
      sortOrder: input.sortOrder ?? 0,
      departmentScope: input.departmentScope,
      defaultPriority: input.defaultPriority,
      defaultSlaHours: input.defaultSlaHours,
      requiresAsset: input.requiresAsset ?? false,
      requiresVehicle: input.requiresVehicle ?? false,
      requiresLocation: input.requiresLocation ?? false,
      requiresEvidence: input.requiresEvidence ?? false,
      requiresSupervisorVerification: input.requiresSupervisorVerification ?? false,
      requiresPartsReview: input.requiresPartsReview ?? false,
      requiresFinanceApproval: input.requiresFinanceApproval ?? false,
      gateOutBlockingRisk: input.gateOutBlockingRisk ?? false,
      downtimeTrackingRequired: input.downtimeTrackingRequired ?? false,
      allowedRoles: input.allowedRoles ?? [],
      aliases: input.aliases ?? [],
      keywords: input.keywords ?? [],
      commonMistakes: input.commonMistakes ?? [],
      sinhalaKeywords: input.sinhalaKeywords ?? [],
      departmentHints: input.departmentHints ?? [],
      active: input.active ?? true,
      ...(isUpdate ? {} : { createdById: actorId })
    };
  }

  private expectedParentLevel(level: WorkOrderTaxonomyLevel): WorkOrderTaxonomyLevel {
    if (level === WorkOrderTaxonomyLevel.TYPE) return WorkOrderTaxonomyLevel.CATEGORY;
    if (level === WorkOrderTaxonomyLevel.ISSUE) return WorkOrderTaxonomyLevel.TYPE;
    throw new BadRequestException("Categories cannot have a parent");
  }

  private slugCode(name: string) {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48);
  }

  private async recordTaxonomyAudit(
    actor: Actor,
    action: string,
    entityId: string,
    before: unknown,
    after: unknown
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: actor.tenantId ?? null,
        entity: "WorkOrderTaxonomy",
        entityId,
        action: action.includes("created") ? AuditAction.CREATE : AuditAction.UPDATE,
        module: "work-order-taxonomy",
        actorId: actor.sub,
        metadata: { event: action },
        beforeData: before ? (before as Prisma.InputJsonValue) : undefined,
        afterData: after ? (after as Prisma.InputJsonValue) : undefined
      }
    });
  }
}
