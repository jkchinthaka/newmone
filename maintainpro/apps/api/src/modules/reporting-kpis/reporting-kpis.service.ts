import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import {
  computeAvailability,
  computeBacklogCount,
  computeComplianceRate,
  computeCostPerKm,
  computeDowntimeMinutes,
  computeFleetServiceCompliance,
  computeMaintenanceCost,
  computeMtbf,
  computeMttr,
  computeOverdueCount,
  computePmCompliance,
  computePlannedVsReactive,
  computeRepeatFailures,
  computeResponseTimeHours,
  getKpiDefinition,
  KPI_DEFINITIONS,
  KPI_FORMULA_VERSION,
  KpiDefinition,
  listKpiDefinitions
} from "./kpi-definitions";
import { resolveRoleHome, RoleHomeProfile } from "./role-home";

export type KpiOverviewResult = {
  code: string;
  displayName: string;
  formulaSummary: string;
  unit: string;
  value: number | null;
  dataWarning?: string;
};

export type EvaluateKpisInput = {
  tenantId: string;
  /** Pre-aggregated counts; if absent, service will do a lightweight DB count. */
  woOverdueCount?: number;
  woBacklogCount?: number;
  pmComplianceNumerator?: number;
  pmComplianceDenominator?: number;
  mttrDurationsHours?: number[];
  /** null means operating hours not available → INSUFFICIENT_DATA */
  mtbfOperatingHours?: number | null;
  mtbfFailureCount?: number;
  availabilityScheduledHours?: number;
  availabilityDowntimeHours?: number;
  downtimeIntervals?: Array<{ startMs: number; endMs: number }>;
  responsePairs?: Array<{ reportedAt: Date; acknowledgedAt: Date }>;
  repeatEvents?: Array<{ assetId: string; failureCode: string; occurredAt: Date }>;
  repeatWindowDays?: number;
  maintenanceCostSnapshots?: number[];
  costPerKmDistance?: number;
  fleetServiceOnTime?: number;
  fleetServiceDue?: number;
  complianceValid?: number;
  complianceTotal?: number;
};

@Injectable()
export class ReportingKpisService {
  constructor(private readonly prisma: PrismaService) {}

  listDefinitions(): { version: string; definitions: KpiDefinition[] } {
    return { version: KPI_FORMULA_VERSION, definitions: listKpiDefinitions() };
  }

  getDefinition(code: string): KpiDefinition | null {
    return getKpiDefinition(code.toUpperCase()) ?? null;
  }

  resolveHome(roleName: string): RoleHomeProfile {
    return resolveRoleHome(roleName);
  }

  /**
   * Evaluates a lightweight KPI overview using pre-aggregated inputs or simple
   * Prisma counts for the tenant. DB queries are count-only (bounded).
   * Returns dataWarnings for INSUFFICIENT_DATA or stale states.
   */
  async evaluateKpis(input: EvaluateKpisInput): Promise<KpiOverviewResult[]> {
    const warnings: string[] = [];
    const results: KpiOverviewResult[] = [];

    // ── WO Overdue ──
    let overdueCount = input.woOverdueCount;
    if (overdueCount === undefined) {
      const now = new Date();
      overdueCount = await this.prisma.workOrder
        .count({
          where: {
            tenantId: input.tenantId,
            dueDate: { lt: now },
            status: { notIn: ["CLOSED", "CANCELLED"] }
          }
        })
        .catch(() => 0);
    }
    results.push({
      code: "WO_OVERDUE",
      displayName: "Overdue Work Orders",
      formulaSummary: getKpiDefinition("WO_OVERDUE")!.formulaSummary,
      unit: "count",
      value: overdueCount
    });

    // ── WO Backlog ──
    let backlogCount = input.woBacklogCount;
    if (backlogCount === undefined) {
      backlogCount = await this.prisma.workOrder
        .count({
          where: {
            tenantId: input.tenantId,
            status: { notIn: ["CLOSED", "CANCELLED"] }
          }
        })
        .catch(() => 0);
    }
    results.push({
      code: "WO_BACKLOG",
      displayName: "Work Order Backlog",
      formulaSummary: getKpiDefinition("WO_BACKLOG")!.formulaSummary,
      unit: "count",
      value: backlogCount
    });

    // ── PM Compliance ──
    const pmValue = computePmCompliance(
      input.pmComplianceNumerator ?? 0,
      input.pmComplianceDenominator ?? 0
    );
    results.push({
      code: "PM_COMPLIANCE",
      displayName: "PM Compliance",
      formulaSummary: getKpiDefinition("PM_COMPLIANCE")!.formulaSummary,
      unit: "%",
      value: pmValue,
      dataWarning: pmValue === null ? "No PM data available for period" : undefined
    });

    // ── MTTR ──
    const mttrValue = computeMttr(input.mttrDurationsHours ?? []);
    results.push({
      code: "MTTR",
      displayName: "Mean Time To Repair",
      formulaSummary: getKpiDefinition("MTTR")!.formulaSummary,
      unit: "hours",
      value: mttrValue,
      dataWarning: mttrValue === null ? "No valid repair durations in period" : undefined
    });

    // ── MTBF ──
    const mtbfOperatingHours = input.mtbfOperatingHours ?? null;
    const mtbfValue = computeMtbf(mtbfOperatingHours, input.mtbfFailureCount ?? 0);
    const mtbfWarning =
      mtbfOperatingHours === null
        ? "Operating hours (meter data) not available — MTBF cannot be computed (N/A ≠ 0)"
        : mtbfValue === null
        ? "Insufficient data for MTBF (no failures or zero operating hours)"
        : undefined;
    results.push({
      code: "MTBF",
      displayName: "Mean Time Between Failures",
      formulaSummary: getKpiDefinition("MTBF")!.formulaSummary,
      unit: "hours",
      value: mtbfValue,
      dataWarning: mtbfWarning
    });

    // ── Availability ──
    const availValue = computeAvailability(
      input.availabilityScheduledHours ?? 0,
      input.availabilityDowntimeHours ?? 0
    );
    results.push({
      code: "AVAILABILITY",
      displayName: "Availability",
      formulaSummary: getKpiDefinition("AVAILABILITY")!.formulaSummary,
      unit: "ratio",
      value: availValue,
      dataWarning: availValue === null ? "Scheduled hours not provided" : undefined
    });

    // ── Downtime ──
    const downtimeValue = computeDowntimeMinutes(input.downtimeIntervals ?? []);
    results.push({
      code: "DOWNTIME",
      displayName: "Downtime",
      formulaSummary: getKpiDefinition("DOWNTIME")!.formulaSummary,
      unit: "minutes",
      value: downtimeValue
    });

    // ── Response Time ──
    const responseValue = computeResponseTimeHours(input.responsePairs ?? []);
    results.push({
      code: "RESPONSE_TIME",
      displayName: "Response Time",
      formulaSummary: getKpiDefinition("RESPONSE_TIME")!.formulaSummary,
      unit: "hours",
      value: responseValue,
      dataWarning: responseValue === null ? "No response time data available" : undefined
    });

    // ── Repeat Failure ──
    const repeatValue = computeRepeatFailures(
      input.repeatEvents ?? [],
      input.repeatWindowDays ?? 30
    );
    results.push({
      code: "REPEAT_FAILURE",
      displayName: "Repeat Failure",
      formulaSummary: getKpiDefinition("REPEAT_FAILURE")!.formulaSummary,
      unit: "count",
      value: repeatValue
    });

    // ── Maintenance Cost ──
    const costValue = computeMaintenanceCost(input.maintenanceCostSnapshots ?? []);
    results.push({
      code: "MAINTENANCE_COST",
      displayName: "Maintenance Cost",
      formulaSummary: getKpiDefinition("MAINTENANCE_COST")!.formulaSummary,
      unit: "currency",
      value: costValue
    });

    // ── Cost per KM ──
    const costPerKmValue = computeCostPerKm(costValue, input.costPerKmDistance ?? 0);
    results.push({
      code: "COST_PER_KM",
      displayName: "Cost per KM",
      formulaSummary: getKpiDefinition("COST_PER_KM")!.formulaSummary,
      unit: "currency/km",
      value: costPerKmValue,
      dataWarning:
        costPerKmValue === null ? "Distance data not available or zero" : undefined
    });

    // ── Fleet Service Compliance ──
    const fleetSvcValue = computeFleetServiceCompliance(
      input.fleetServiceOnTime ?? 0,
      input.fleetServiceDue ?? 0
    );
    results.push({
      code: "FLEET_SERVICE_COMPLIANCE",
      displayName: "Fleet Service Compliance",
      formulaSummary: getKpiDefinition("FLEET_SERVICE_COMPLIANCE")!.formulaSummary,
      unit: "%",
      value: fleetSvcValue,
      dataWarning: fleetSvcValue === null ? "No fleet service data for period" : undefined
    });

    // ── Compliance Rate ──
    const complianceRateValue = computeComplianceRate(
      input.complianceValid ?? 0,
      input.complianceTotal ?? 0
    );
    results.push({
      code: "COMPLIANCE_RATE",
      displayName: "Compliance Rate",
      formulaSummary: getKpiDefinition("COMPLIANCE_RATE")!.formulaSummary,
      unit: "%",
      value: complianceRateValue,
      dataWarning:
        complianceRateValue === null ? "No compliance items available" : undefined
    });

    return results;
  }
}
