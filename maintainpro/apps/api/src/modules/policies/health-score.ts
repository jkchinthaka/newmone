export type HealthBand = "HEALTHY" | "ATTENTION" | "HIGH_RISK" | "CRITICAL";

export type HealthFactorInput = {
  maintenanceOverdueKm?: number | null;
  maintenanceOverdueDays?: number | null;
  criticalOpenWorkOrders?: number;
  recentBreakdowns90d?: number;
  repeatFailures?: number;
  complianceExpiringDays?: number | null;
  complianceExpired?: boolean;
  availabilityBlocked?: boolean;
  downtimeDays90?: number | null;
  meterAnomalies?: number;
  recentRepairCount90d?: number;
};

export type HealthScoreResult = {
  score: number;
  band: HealthBand;
  reasons: string[];
  deductions: Array<{ code: string; points: number; detail: string }>;
  coverage: "COMPLETE" | "INSUFFICIENT_DATA";
};

export function scoreVehicleHealth(input: HealthFactorInput): HealthScoreResult {
  let score = 100;
  const deductions: HealthScoreResult["deductions"] = [];
  const reasons: string[] = [];

  const deduct = (code: string, points: number, detail: string) => {
    if (points <= 0) {
      return;
    }
    score -= points;
    deductions.push({ code, points, detail });
    reasons.push(detail);
  };

  if ((input.maintenanceOverdueKm ?? 0) > 0) {
    deduct("MAINTENANCE_OVERDUE_KM", Math.min(25, 8 + Math.floor(Number(input.maintenanceOverdueKm) / 200)), `Service overdue ${Math.round(Number(input.maintenanceOverdueKm))} km`);
  }
  if ((input.maintenanceOverdueDays ?? 0) > 0) {
    deduct("MAINTENANCE_OVERDUE_DAYS", Math.min(20, 6 + Math.floor(Number(input.maintenanceOverdueDays) / 7)), `Service overdue ${Math.round(Number(input.maintenanceOverdueDays))} days`);
  }
  if ((input.criticalOpenWorkOrders ?? 0) > 0) {
    deduct("CRITICAL_WO", Math.min(30, Number(input.criticalOpenWorkOrders) * 12), `${input.criticalOpenWorkOrders} critical open work orders`);
  }
  if ((input.recentBreakdowns90d ?? 0) > 0) {
    deduct("BREAKDOWNS", Math.min(20, Number(input.recentBreakdowns90d) * 6), `${input.recentBreakdowns90d} breakdowns in 90 days`);
  }
  if ((input.repeatFailures ?? 0) >= 3) {
    deduct("REPEAT_FAILURE", Math.min(20, (Number(input.repeatFailures) - 2) * 6), `Repeat failure count ${input.repeatFailures}`);
  }
  if (input.complianceExpired) {
    deduct("COMPLIANCE_EXPIRED", 25, "Mandatory compliance expired");
  } else if (input.complianceExpiringDays != null && input.complianceExpiringDays <= 14) {
    deduct("COMPLIANCE_EXPIRING", 10, `Insurance/compliance expires in ${Math.round(input.complianceExpiringDays)} days`);
  }
  if (input.availabilityBlocked) {
    deduct("UNAVAILABLE", 15, "Vehicle is not available for operation");
  }
  if ((input.downtimeDays90 ?? 0) > 0) {
    deduct("DOWNTIME", Math.min(15, Math.floor(Number(input.downtimeDays90))), `${Math.round(Number(input.downtimeDays90))} downtime days in 90 days`);
  }
  if ((input.meterAnomalies ?? 0) > 0) {
    deduct("METER_ANOMALY", Math.min(10, Number(input.meterAnomalies) * 4), `${input.meterAnomalies} meter anomalies`);
  }
  if ((input.recentRepairCount90d ?? 0) >= 4) {
    deduct("REPAIR_FREQUENCY", 10, `${input.recentRepairCount90d} repairs in 90 days`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const band: HealthBand = score >= 80 ? "HEALTHY" : score >= 60 ? "ATTENTION" : score >= 40 ? "HIGH_RISK" : "CRITICAL";
  const coverage: HealthScoreResult["coverage"] =
    input.maintenanceOverdueKm == null &&
    input.criticalOpenWorkOrders == null &&
    input.recentBreakdowns90d == null
      ? "INSUFFICIENT_DATA"
      : "COMPLETE";

  return { score, band, reasons, deductions, coverage };
}
