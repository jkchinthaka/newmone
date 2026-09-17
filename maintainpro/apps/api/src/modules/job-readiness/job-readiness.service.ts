import { Injectable, NotFoundException } from "@nestjs/common";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { ReliabilityService } from "../reliability/reliability.service";

type Actor = Pick<JwtPayload, "sub" | "tenantId" | "role">;

export type ReadinessBlocker = {
  code: string;
  severity: "BLOCK" | "WARN";
  message: string;
  detail?: string;
};

@Injectable()
export class JobReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reliability: ReliabilityService
  ) {}

  async evaluate(actor: Actor, workOrderId: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      include: {
        parts: true,
        assignees: { where: { assignmentStatus: { not: "REMOVED" } } }
      }
    });
    if (!wo) throw new NotFoundException("Work order not found");

    const blockers: ReadinessBlocker[] = [];

    if (wo.approvalStatus && !["APPROVED", "", "NOT_REQUIRED"].includes(wo.approvalStatus)) {
      blockers.push({
        code: "APPROVAL_REQUIRED",
        severity: "BLOCK",
        message: "Work order approval is incomplete",
        detail: `approvalStatus=${wo.approvalStatus}`
      });
    }

    if (!wo.technicianId && (wo.assignees?.length ?? 0) === 0) {
      blockers.push({
        code: "ASSIGNMENT_REQUIRED",
        severity: "BLOCK",
        message: "No technician or crew assigned"
      });
    }

    try {
      await this.reliability.assertPermitReadyForStart({
        tenantId,
        workOrderId,
        assetId: wo.assetId
      });
    } catch (err) {
      const reasons =
        err && typeof err === "object" && "response" in err
          ? ((err as { response?: { reasons?: string[] } }).response?.reasons ?? [])
          : [];
      blockers.push({
        code: "PERMIT_REQUIRED",
        severity: "BLOCK",
        message: "Mandatory permit requirements incomplete",
        detail: reasons.join("; ") || undefined
      });
    }

    try {
      await this.reliability.assertLotoReadyForStart({ tenantId, workOrderId });
    } catch {
      blockers.push({
        code: "LOTO_REQUIRED",
        severity: "BLOCK",
        message: "LOTO isolation must be verified before start"
      });
    }

    const reservedLines = (wo.parts ?? []).filter((p) => (p.reservedQuantity ?? 0) > 0);
    const pendingParts = (wo.parts ?? []).filter(
      (p) => (p.requestedQuantity ?? 0) > (p.reservedQuantity ?? 0) + (p.issuedQuantity ?? 0)
    );
    if (pendingParts.length > 0) {
      blockers.push({
        code: "PARTS_NOT_READY",
        severity: "WARN",
        message: "Some requested parts are not fully reserved/issued",
        detail: `${pendingParts.length} line(s); reserved lines=${reservedLines.length}`
      });
    }

    if (wo.temporaryRepair && wo.temporaryRepairExpiry && wo.temporaryRepairExpiry < new Date()) {
      blockers.push({
        code: "TEMPORARY_REPAIR_EXPIRED",
        severity: "WARN",
        message: "Temporary repair follow-up is overdue"
      });
    }

    const ready = !blockers.some((b) => b.severity === "BLOCK");
    return {
      workOrderId,
      ready,
      status: ready ? "READY" : "NOT_READY",
      blockers,
      checkedAt: new Date().toISOString()
    };
  }
}
