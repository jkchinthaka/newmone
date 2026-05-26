import { Injectable, NotFoundException } from "@nestjs/common";
import { ComplianceStatus, Prisma, VehicleDocumentStatus, VehicleDocumentType } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { Phase4Actor, resolveTenantId } from "../_phase4/phase4-audit.helper";

export const REQUIRED_DOCUMENT_TYPES: VehicleDocumentType[] = [
  VehicleDocumentType.REGISTRATION,
  VehicleDocumentType.INSURANCE,
  VehicleDocumentType.FITNESS,
  VehicleDocumentType.POLLUTION,
  VehicleDocumentType.ROAD_TAX
];

const ATTENTION_DAYS = 30;

export interface ComplianceEvaluation {
  vehicleId: string;
  status: ComplianceStatus;
  evaluatedAt: Date;
  reasons: string[];
  details: Array<{
    documentType: VehicleDocumentType;
    state: "MISSING" | "EXPIRED" | "EXPIRING_SOON" | "VALID" | "PENDING" | "REJECTED";
    expiryDate?: Date | null;
    daysUntilExpiry?: number;
  }>;
}

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(vehicleId: string, asOf: Date = new Date()): Promise<ComplianceEvaluation> {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException("Vehicle not found");

    const docs = await this.prisma.vehicleDocument.findMany({
      where: { vehicleId },
      orderBy: { expiryDate: "desc" }
    });

    const reasons: string[] = [];
    const details: ComplianceEvaluation["details"] = [];
    let hasNonCompliant = false;
    let hasAttention = false;

    for (const type of REQUIRED_DOCUMENT_TYPES) {
      const latest = docs.find((d) => d.documentType === type);
      if (!latest) {
        reasons.push(`Missing required document: ${type}`);
        details.push({ documentType: type, state: "MISSING" });
        hasNonCompliant = true;
        continue;
      }
      if (latest.status === VehicleDocumentStatus.REJECTED) {
        reasons.push(`Document rejected: ${type}`);
        details.push({ documentType: type, state: "REJECTED", expiryDate: latest.expiryDate });
        hasNonCompliant = true;
        continue;
      }
      if (latest.status === VehicleDocumentStatus.PENDING_VERIFICATION) {
        details.push({ documentType: type, state: "PENDING", expiryDate: latest.expiryDate });
        hasAttention = true;
        continue;
      }
      const ms = latest.expiryDate.getTime() - asOf.getTime();
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      if (ms < 0) {
        reasons.push(`Document expired: ${type} (${latest.expiryDate.toISOString().slice(0, 10)})`);
        details.push({ documentType: type, state: "EXPIRED", expiryDate: latest.expiryDate, daysUntilExpiry: days });
        hasNonCompliant = true;
      } else if (days <= ATTENTION_DAYS) {
        reasons.push(`Document expiring soon: ${type} in ${days}d`);
        details.push({ documentType: type, state: "EXPIRING_SOON", expiryDate: latest.expiryDate, daysUntilExpiry: days });
        hasAttention = true;
      } else {
        details.push({ documentType: type, state: "VALID", expiryDate: latest.expiryDate, daysUntilExpiry: days });
      }
    }

    const status: ComplianceStatus = hasNonCompliant
      ? ComplianceStatus.NON_COMPLIANT
      : hasAttention
        ? ComplianceStatus.ATTENTION_REQUIRED
        : ComplianceStatus.COMPLIANT;

    return { vehicleId, status, evaluatedAt: asOf, reasons, details };
  }

  async refreshAndPersist(vehicleId: string): Promise<ComplianceEvaluation> {
    const result = await this.evaluate(vehicleId);
    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { complianceStatus: result.status, complianceLastEvaluatedAt: result.evaluatedAt }
    });
    return result;
  }

  async getVehicleCompliance(vehicleId: string): Promise<ComplianceEvaluation> {
    return this.evaluate(vehicleId);
  }

  async fleetSummary(actor?: Phase4Actor) {
    const tenantId = resolveTenantId(actor);
    const where: Prisma.VehicleWhereInput = tenantId !== undefined ? { tenantId } : {};
    const [compliant, attention, nonCompliant, total] = await Promise.all([
      this.prisma.vehicle.count({ where: { ...where, complianceStatus: ComplianceStatus.COMPLIANT } }),
      this.prisma.vehicle.count({ where: { ...where, complianceStatus: ComplianceStatus.ATTENTION_REQUIRED } }),
      this.prisma.vehicle.count({ where: { ...where, complianceStatus: ComplianceStatus.NON_COMPLIANT } }),
      this.prisma.vehicle.count({ where })
    ]);
    return { total, compliant, attention, nonCompliant };
  }

  async listExpiringDocuments(actor?: Phase4Actor, withinDays = 30) {
    const tenantId = resolveTenantId(actor);
    const until = new Date();
    until.setDate(until.getDate() + withinDays);
    return this.prisma.vehicleDocument.findMany({
      where: {
        ...(tenantId !== undefined ? { tenantId } : {}),
        status: VehicleDocumentStatus.VERIFIED,
        expiryDate: { lte: until }
      },
      include: { vehicle: { select: { id: true, registrationNo: true, make: true, vehicleModel: true } } },
      orderBy: { expiryDate: "asc" },
      take: 100
    });
  }

  /** Returns reasons that should block gate-out (NON_COMPLIANT or missing required docs). */
  async evaluateForGateOut(vehicleId: string): Promise<string[]> {
    const evaluation = await this.evaluate(vehicleId);
    if (evaluation.status === ComplianceStatus.NON_COMPLIANT) {
      return evaluation.reasons;
    }
    return [];
  }
}
