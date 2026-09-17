import { BadRequestException, Injectable } from "@nestjs/common";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { ALLOWED_STATUS_TRANSITIONS } from "../../common/utils/work-order-governance";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { canTransition, type StateMachineName } from "../policies/state-machines";

type Actor = Pick<JwtPayload, "sub" | "tenantId" | "role">;

const DEFAULT_WO_STATES = Object.keys(ALLOWED_STATUS_TRANSITIONS);

@Injectable()
export class WorkflowEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates a transition using published WorkflowVersion when present,
   * otherwise falls back to the code state machine (backward compatible).
   */
  async assertTransition(input: {
    tenantId: string;
    entityType: string;
    fromStatus: string;
    toStatus: string;
    jobDomain?: string | null;
    workflowVersionId?: string | null;
  }) {
    if (input.workflowVersionId) {
      const version = await this.prisma.workflowVersion.findFirst({
        where: { id: input.workflowVersionId, tenantId: input.tenantId, status: "PUBLISHED" }
      });
      if (version) {
        const transitions = JSON.parse(version.transitionsJson || "[]") as Array<{
          from: string;
          to: string;
        }>;
        const ok = transitions.some(
          (t) => t.from === input.fromStatus && t.to === input.toStatus
        );
        if (!ok) {
          throw new BadRequestException({
            code: "INVALID_TRANSITION",
            message: `Transition ${input.fromStatus} → ${input.toStatus} not allowed by workflow v${version.version}`
          });
        }
        return { source: "WORKFLOW_VERSION" as const, versionId: version.id, version: version.version };
      }
    }

    const machine = this.mapEntityToMachine(input.entityType);
    const decision = canTransition(machine, input.fromStatus, input.toStatus);
    if (!decision.allowed) {
      throw new BadRequestException({
        code: "INVALID_TRANSITION",
        message: decision.reason ?? "Invalid transition"
      });
    }
    return { source: "CODE_STATE_MACHINE" as const, versionId: null, version: null };
  }

  async ensureDefaultWorkOrderWorkflow(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    let def = await this.prisma.workflowDefinition.findUnique({
      where: { tenantId_code: { tenantId, code: "WORK_ORDER_DEFAULT" } }
    });
    if (!def) {
      def = await this.prisma.workflowDefinition.create({
        data: {
          tenantId,
          code: "WORK_ORDER_DEFAULT",
          name: "Default Work Order Workflow",
          entityType: "WORK_ORDER",
          description: "Enterprise baseline WO lifecycle"
        }
      });
    }

    const existing = await this.prisma.workflowVersion.findFirst({
      where: { definitionId: def.id, status: "PUBLISHED" },
      orderBy: { version: "desc" }
    });
    if (existing) return { definition: def, version: existing };

    const transitions = Object.entries(ALLOWED_STATUS_TRANSITIONS).flatMap(([from, tos]) =>
      [...tos].map((to) => ({ from, to }))
    );

    const version = await this.prisma.workflowVersion.create({
      data: {
        tenantId,
        definitionId: def.id,
        version: 1,
        status: "PUBLISHED",
        statesJson: JSON.stringify(DEFAULT_WO_STATES),
        transitionsJson: JSON.stringify(transitions),
        effectiveFrom: new Date(),
        publishedAt: new Date(),
        publishedById: actor.sub
      }
    });

    return { definition: def, version };
  }

  async listDefinitions(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.workflowDefinition.findMany({
      where: { tenantId },
      include: { versions: { orderBy: { version: "desc" }, take: 5 } },
      orderBy: { code: "asc" }
    });
  }

  async publishVersion(actor: Actor, definitionId: string, input: { reason?: string }) {
    const tenantId = requireTenantId(actor.tenantId);
    const def = await this.prisma.workflowDefinition.findFirst({
      where: { id: definitionId, tenantId }
    });
    if (!def) throw new BadRequestException("Workflow definition not found");

    const latest = await this.prisma.workflowVersion.findFirst({
      where: { definitionId },
      orderBy: { version: "desc" }
    });
    if (!latest || latest.status !== "DRAFT") {
      throw new BadRequestException("No DRAFT version to publish");
    }

    // retire previous published
    await this.prisma.workflowVersion.updateMany({
      where: { definitionId, status: "PUBLISHED" },
      data: { status: "RETIRED", effectiveTo: new Date() }
    });

    const published = await this.prisma.workflowVersion.update({
      where: { id: latest.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        publishedById: actor.sub,
        effectiveFrom: new Date()
      }
    });

    await this.prisma.configChangeHistory.create({
      data: {
        tenantId,
        entityType: "WorkflowVersion",
        entityId: published.id,
        version: published.version,
        action: "PUBLISH",
        reason: input.reason ?? "Workflow version published",
        afterJson: JSON.stringify({ definitionId, version: published.version }),
        actorId: actor.sub
      }
    });

    return published;
  }

  private mapEntityToMachine(entityType: string): StateMachineName {
    const map: Record<string, StateMachineName> = {
      WORK_ORDER: "WORK_ORDER",
      PURCHASE_ORDER: "PURCHASE_ORDER",
      PART_REQUEST: "PART_REQUEST",
      ASSET: "ASSET"
    };
    return map[entityType] ?? "WORK_ORDER";
  }
}
