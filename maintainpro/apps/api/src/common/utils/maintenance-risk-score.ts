export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type WorkOrderRiskFactors = {
  completedWithoutEvidence?: boolean;
  requiredEvidenceMissing?: boolean;
  qrMismatch?: boolean;
  qrOverride?: boolean;
  evidenceRejected?: boolean;
  offlineSyncFailed?: boolean;
  partsIssuedJobNotCompleted?: boolean;
  partsIssueWithoutWorkOrderAttempt?: boolean;
  pendingReturn?: boolean;
  highCostPartIssue?: boolean;
  repeatedBreakdown?: boolean;
  reopened?: boolean;
  cancelledAfterPartsIssued?: boolean;
  assignedDuringLeave?: boolean;
  editedAfterCompletion?: boolean;
  overdue?: boolean;
  invoiceExceedsQuotation?: boolean;
  duplicateInvoice?: boolean;
  blacklistedVendorUsed?: boolean;
  vendorRepairWithoutQuotation?: boolean;
  vendorRepairWithoutInvoice?: boolean;
  highCostVendorRepair?: boolean;
  repeatedVendorRepair?: boolean;
  emergencyVendorOverride?: boolean;
  financeApprovalPending?: boolean;
  sameUserVendorApproval?: boolean;
  makerCheckerViolation?: boolean;
  missingEvidenceCompletionAttempt?: boolean;
  noSupervisorVerificationClosureAttempt?: boolean;
  gateOutOverrideCritical?: boolean;
  adminOverride?: boolean;
  emergencyOverride?: boolean;
  unaccountedParts?: boolean;
};

export function calculateWorkOrderRiskScore(factors: WorkOrderRiskFactors): number {
  let score = 0;
  if (factors.partsIssueWithoutWorkOrderAttempt) score += 30;
  if (factors.duplicateInvoice) score += 25;
  if (factors.invoiceExceedsQuotation) score += 25;
  if (factors.blacklistedVendorUsed) score += 25;
  if (factors.gateOutOverrideCritical) score += 25;
  if (factors.completedWithoutEvidence) score += 20;
  if (factors.requiredEvidenceMissing) score += 20;
  if (factors.partsIssuedJobNotCompleted) score += 20;
  if (factors.missingEvidenceCompletionAttempt) score += 20;
  if (factors.noSupervisorVerificationClosureAttempt) score += 20;
  if (factors.makerCheckerViolation) score += 20;
  if (factors.vendorRepairWithoutInvoice) score += 20;
  if (factors.highCostVendorRepair) score += 20;
  if (factors.qrMismatch) score += 15;
  if (factors.pendingReturn) score += 15;
  if (factors.highCostPartIssue) score += 15;
  if (factors.repeatedBreakdown) score += 15;
  if (factors.repeatedVendorRepair) score += 15;
  if (factors.vendorRepairWithoutQuotation) score += 15;
  if (factors.unaccountedParts) score += 15;
  if (factors.qrOverride) score += 10;
  if (factors.evidenceRejected) score += 10;
  if (factors.reopened) score += 10;
  if (factors.cancelledAfterPartsIssued) score += 10;
  if (factors.assignedDuringLeave) score += 10;
  if (factors.editedAfterCompletion) score += 10;
  if (factors.emergencyVendorOverride) score += 10;
  if (factors.financeApprovalPending) score += 10;
  if (factors.sameUserVendorApproval) score += 10;
  if (factors.adminOverride) score += 10;
  if (factors.emergencyOverride) score += 10;
  if (factors.offlineSyncFailed) score += 5;
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
    "required-evidence-missing",
    "open-high-risk",
    "parts-issued-not-completed",
    "parts-issue-without-work-order",
    "closed-without-supervisor-verification",
    "qr-mismatch",
    "invoice-exceeds-quotation",
    "duplicate-vendor-invoice",
    "blacklisted-vendor-used",
    "vendor-repair-without-quotation",
    "vendor-repair-without-invoice",
    "high-cost-vendor-repair",
    "maker-checker-violation"
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
