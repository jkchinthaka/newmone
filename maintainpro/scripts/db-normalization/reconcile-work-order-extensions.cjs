#!/usr/bin/env node
/**
 * DB-5 — Reconcile WorkOrder legacy fields vs extension tables.
 *
 * Usage (from maintainpro/):
 *   node scripts/db-normalization/reconcile-work-order-extensions.mjs
 *   node scripts/db-normalization/reconcile-work-order-extensions.mjs --tenant <id>
 *
 * Exit code 2 if VALUE_MISMATCH or TENANT_MISMATCH > 0.
 */

const { PrismaClient } = require("@prisma/client");

const PLANNING_FIELDS = [
  "expectedCompletionDate",
  "plannedStartAt",
  "plannedEndAt",
  "delayReason",
  "cancelledReason",
  "estimatedHours",
  "estimatedDurationMinutes",
  "slaDeadline",
  "slaBreached"
];
const EXECUTION_FIELDS = [
  "executionMode",
  "vendorSupplierId",
  "approvedById",
  "approvedAt",
  "rejectionReason",
  "startDate",
  "failedAt",
  "reportedAt",
  "acknowledgedAt",
  "technicianArrivedAt",
  "repairStartedAt",
  "repairCompletedAt",
  "productionResumedAt",
  "holdReasonCode",
  "holdNotes",
  "heldAt",
  "expectedResumeAt",
  "resumedAt",
  "correctionReason"
];
const COMPLETION_FIELDS = [
  "completedDate",
  "technicianCompletionNote",
  "verificationStatus",
  "verifiedById",
  "verifiedAt",
  "verificationNote",
  "verificationRejectionReason",
  "reopenReason",
  "reopenedAt",
  "reopenedById",
  "actualHours",
  "completionCondition",
  "followUpRequired",
  "followUpNote",
  "qrVerificationStatus",
  "qrVerifiedAt",
  "qrVerifiedById",
  "qrVerifiedAssetId",
  "qrVerifiedVehicleId",
  "qrOverrideReason",
  "requesterConfirmationStatus",
  "requesterConfirmationDueAt",
  "requesterConfirmedAt",
  "requesterConfirmedById",
  "requesterConfirmationNote",
  "requesterConfirmationOutcome",
  "requesterConfirmationPolicyHours",
  "functionalTestResult",
  "roadTestResult",
  "completionMeterReading",
  "operatingRestriction",
  "productionImpact"
];
const SAFETY_FIELDS = [
  "riskLevel",
  "ppeRequired",
  "lotoRequired",
  "hotWorkRequired",
  "workingAtHeight",
  "electricalIsolation",
  "confinedSpace",
  "permitReference"
];
const CLASSIFICATION_FIELDS = [
  "maintenanceTemplateId",
  "maintenanceTemplateVersion",
  "maintenanceTemplateSnapshot",
  "failureCodeId",
  "causeCodeId",
  "remedyCodeId",
  "failureCodeSnapshot",
  "causeCodeSnapshot",
  "remedyCodeSnapshot",
  "taxonomyCategoryId",
  "taxonomyTypeId",
  "taxonomyIssueId",
  "categoryNameSnapshot",
  "typeNameSnapshot",
  "issueNameSnapshot",
  "isTriage",
  "triageReason",
  "triageClassifiedAt",
  "triageClassifiedById"
];

function eq(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date || b instanceof Date) {
    const ta = a instanceof Date ? a.getTime() : a ? new Date(a).getTime() : null;
    const tb = b instanceof Date ? b.getTime() : b ? new Date(b).getTime() : null;
    return ta === tb;
  }
  if (typeof a === "number" || typeof b === "number") {
    if (a == null && b == null) return true;
    return Number(a) === Number(b);
  }
  if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) === Boolean(b);
  const sa = a == null ? null : String(a);
  const sb = b == null ? null : String(b);
  return sa === sb;
}

function classify(legacy, ext, field) {
  const lv = legacy[field];
  if (!ext) {
    if (lv == null || lv === "" || lv === false || (typeof lv === "string" && lv === "[]")) {
      return "EXPECTED_NULL";
    }
    return "LEGACY_ONLY";
  }
  if (ext.tenantId !== legacy.tenantId) return "TENANT_MISMATCH";
  const ev = ext[field];
  if (ev === undefined) return "EXPECTED_NULL";
  if (lv == null && ev == null) return "MATCH";
  if (lv == null && ev != null) return "EXTENSION_ONLY";
  if (lv != null && ev == null) return "LEGACY_ONLY";
  return eq(lv, ev) ? "MATCH" : "VALUE_MISMATCH";
}

async function main() {
  const tenantIdx = process.argv.indexOf("--tenant");
  const tenant = tenantIdx >= 0 ? process.argv[tenantIdx + 1] : null;
  const prisma = new PrismaClient();
  const counts = {
    MATCH: 0,
    EXPECTED_NULL: 0,
    LEGACY_ONLY: 0,
    EXTENSION_ONLY: 0,
    VALUE_MISMATCH: 0,
    TENANT_MISMATCH: 0
  };
  let comparedWos = 0;
  let fieldComparisons = 0;
  let missingExtensions = 0;
  let orphanExtensions = 0;
  const samples = [];

  try {
    const workOrders = await prisma.workOrder.findMany({
      where: tenant ? { tenantId: tenant } : undefined,
      include: {
        planning: true,
        execution: true,
        completion: true,
        safety: true,
        classification: true
      }
    });

    for (const wo of workOrders) {
      comparedWos += 1;
      const groups = [
        ["planning", PLANNING_FIELDS, wo.planning],
        ["execution", EXECUTION_FIELDS, wo.execution],
        ["completion", COMPLETION_FIELDS, wo.completion],
        ["safety", SAFETY_FIELDS, wo.safety],
        ["classification", CLASSIFICATION_FIELDS, wo.classification]
      ];
      for (const [, fields, ext] of groups) {
        if (!ext) {
          // Only count missing if legacy has meaningful values later via LEGACY_ONLY
        }
        for (const field of fields) {
          fieldComparisons += 1;
          const c = classify(wo, ext, field);
          counts[c] += 1;
          if (c === "VALUE_MISMATCH" || c === "TENANT_MISMATCH") {
            if (samples.length < 20) {
              samples.push({
                woId: wo.id,
                field,
                legacy: wo[field],
                extension: ext ? ext[field] : null,
                class: c
              });
            }
          }
          if (c === "LEGACY_ONLY" && !ext) missingExtensions += 1;
        }
      }
    }

    // Orphan check: extension without parent (should be impossible with FK).
    for (const model of [
      "workOrderPlanning",
      "workOrderExecution",
      "workOrderCompletion",
      "workOrderSafety",
      "workOrderClassification"
    ]) {
      const rows = await prisma[model].findMany({ select: { id: true, workOrderId: true, tenantId: true } });
      for (const row of rows) {
        const parent = await prisma.workOrder.findUnique({
          where: { id: row.workOrderId },
          select: { id: true, tenantId: true }
        });
        if (!parent) orphanExtensions += 1;
        else if (parent.tenantId !== row.tenantId) counts.TENANT_MISMATCH += 1;
      }
    }

    const report = {
      comparedWos,
      fieldComparisons,
      counts,
      missingExtensionFieldHits: missingExtensions,
      orphanExtensions,
      samples
    };
    console.log(JSON.stringify(report, null, 2));
    if (counts.VALUE_MISMATCH > 0 || counts.TENANT_MISMATCH > 0 || orphanExtensions > 0) {
      process.exitCode = 2;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
