export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type WorkOrderRiskFactors = {
  completedWithoutEvidence?: boolean;
  partsIssuedJobNotCompleted?: boolean;
  pendingReturn?: boolean;
  highCostPartIssue?: boolean;
  repeatedBreakdown?: boolean;
  reopened?: boolean;
  cancelledAfterPartsIssued?: boolean;
  assignedDuringLeave?: boolean;
  editedAfterCompletion?: boolean;
  overdue?: boolean;
};

export function calculateWorkOrderRiskScore(factors: WorkOrderRiskFactors): number {
  let score = 0;
  if (factors.completedWithoutEvidence) score += 20;
  if (factors.partsIssuedJobNotCompleted) score += 20;
  if (factors.pendingReturn) score += 15;
  if (factors.highCostPartIssue) score += 15;
  if (factors.repeatedBreakdown) score += 15;
  if (factors.reopened) score += 10;
  if (factors.cancelledAfterPartsIssued) score += 10;
  if (factors.assignedDuringLeave) score += 10;
  if (factors.editedAfterCompletion) score += 10;
  if (factors.overdue) score += 5;
  return score;
}

export function resolveRiskSeverity(score: number): RiskSeverity {
  if (score >= 60) return "CRITICAL";
  if (score >= 40) return "HIGH";
  if (score >= 20) return "MEDIUM";
  return "LOW";
}

export function cardSeverityFromCount(type: string, count: number): RiskSeverity {
  if (count <= 0) return "LOW";
  const highImpact = new Set([
    "completed-without-evidence",
    "open-high-risk",
    "parts-issued-not-completed",
    "closed-without-supervisor-verification"
  ]);
  if (highImpact.has(type)) {
    if (count >= 5) return "CRITICAL";
    return count >= 1 ? "HIGH" : "LOW";
  }
  if (count >= 10) return "CRITICAL";
  if (count >= 5) return "HIGH";
  if (count >= 2) return "MEDIUM";
  return "LOW";
}

export const RISK_SCORE_DISCLAIMER =
  "Rule-based operational risk score for maintenance supervision — not AI fraud detection.";
