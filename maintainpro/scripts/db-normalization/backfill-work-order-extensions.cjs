#!/usr/bin/env node
/**
 * DB-4 — Controlled WorkOrder extension backfill.
 *
 * DRY RUN by default. Apply only with --apply.
 *
 * Usage (from maintainpro/):
 *   node scripts/db-normalization/backfill-work-order-extensions.mjs
 *   node scripts/db-normalization/backfill-work-order-extensions.mjs --tenant <tenantId>
 *   node scripts/db-normalization/backfill-work-order-extensions.mjs --apply --tenant <tenantId>
 *   node scripts/db-normalization/backfill-work-order-extensions.mjs --apply --batch-size 50
 *
 * Does not delete data, does not mutate legacy WorkOrder columns, does not print secrets.
 */

const { PrismaClient } = require("@prisma/client");

// Re-implement existence checks inline (script cannot import TS util without compile).
function present(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function hasPlanning(wo) {
  return (
    present(wo.expectedCompletionDate) ||
    present(wo.plannedStartAt) ||
    present(wo.plannedEndAt) ||
    present(wo.delayReason) ||
    present(wo.cancelledReason) ||
    present(wo.estimatedHours) ||
    present(wo.estimatedDurationMinutes) ||
    present(wo.slaDeadline) ||
    wo.slaBreached === true
  );
}

function hasExecution(wo) {
  return (
    present(wo.executionMode) ||
    present(wo.vendorSupplierId) ||
    present(wo.approvedById) ||
    present(wo.approvedAt) ||
    present(wo.rejectionReason) ||
    present(wo.startDate) ||
    present(wo.failedAt) ||
    present(wo.reportedAt) ||
    present(wo.acknowledgedAt) ||
    present(wo.technicianArrivedAt) ||
    present(wo.repairStartedAt) ||
    present(wo.repairCompletedAt) ||
    present(wo.productionResumedAt) ||
    present(wo.holdReasonCode) ||
    present(wo.holdNotes) ||
    present(wo.heldAt) ||
    present(wo.expectedResumeAt) ||
    present(wo.resumedAt) ||
    present(wo.correctionReason)
  );
}

function hasCompletion(wo) {
  return (
    present(wo.completedDate) ||
    present(wo.technicianCompletionNote) ||
    present(wo.verificationStatus) ||
    present(wo.verifiedById) ||
    present(wo.verifiedAt) ||
    present(wo.verificationNote) ||
    present(wo.verificationRejectionReason) ||
    present(wo.reopenReason) ||
    present(wo.reopenedAt) ||
    present(wo.reopenedById) ||
    present(wo.actualHours) ||
    present(wo.completionCondition) ||
    wo.followUpRequired === true ||
    present(wo.followUpNote) ||
    present(wo.qrVerificationStatus) ||
    present(wo.qrVerifiedAt) ||
    present(wo.qrVerifiedById) ||
    present(wo.qrVerifiedAssetId) ||
    present(wo.qrVerifiedVehicleId) ||
    present(wo.qrOverrideReason) ||
    (present(wo.requesterConfirmationStatus) && wo.requesterConfirmationStatus !== "NOT_REQUIRED") ||
    present(wo.requesterConfirmationDueAt) ||
    present(wo.requesterConfirmedAt) ||
    present(wo.requesterConfirmedById) ||
    present(wo.requesterConfirmationNote) ||
    present(wo.requesterConfirmationOutcome) ||
    present(wo.requesterConfirmationPolicyHours) ||
    present(wo.functionalTestResult) ||
    present(wo.roadTestResult) ||
    present(wo.completionMeterReading) ||
    present(wo.operatingRestriction) ||
    present(wo.productionImpact)
  );
}

function hasSafety(wo) {
  const ppe = (wo.ppeRequired || "").trim();
  return (
    present(wo.riskLevel) ||
    present(wo.permitReference) ||
    (ppe.length > 0 && ppe !== "[]") ||
    wo.lotoRequired === true ||
    wo.hotWorkRequired === true ||
    wo.workingAtHeight === true ||
    wo.electricalIsolation === true ||
    wo.confinedSpace === true
  );
}

function hasClassification(wo) {
  return (
    present(wo.maintenanceTemplateId) ||
    present(wo.maintenanceTemplateVersion) ||
    present(wo.maintenanceTemplateSnapshot) ||
    present(wo.failureCodeId) ||
    present(wo.causeCodeId) ||
    present(wo.remedyCodeId) ||
    present(wo.failureCodeSnapshot) ||
    present(wo.causeCodeSnapshot) ||
    present(wo.remedyCodeSnapshot) ||
    present(wo.taxonomyCategoryId) ||
    present(wo.taxonomyTypeId) ||
    present(wo.taxonomyIssueId) ||
    present(wo.categoryNameSnapshot) ||
    present(wo.typeNameSnapshot) ||
    present(wo.issueNameSnapshot) ||
    wo.isTriage === true ||
    present(wo.triageReason) ||
    present(wo.triageClassifiedAt) ||
    present(wo.triageClassifiedById)
  );
}

function parseArgs(argv) {
  const out = { apply: false, tenant: null, batchSize: 100 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--tenant") out.tenant = argv[++i];
    else if (a === "--batch-size") out.batchSize = Math.max(1, Number(argv[++i]) || 100);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  const summary = {
    mode: args.apply ? "APPLY" : "DRY_RUN",
    scanned: 0,
    candidates: { planning: 0, execution: 0, completion: 0, safety: 0, classification: 0 },
    wouldCreate: { planning: 0, execution: 0, completion: 0, safety: 0, classification: 0 },
    wouldUpdate: { planning: 0, execution: 0, completion: 0, safety: 0, classification: 0 },
    alreadySynced: 0,
    conflicts: 0,
    failures: 0,
    created: { planning: 0, execution: 0, completion: 0, safety: 0, classification: 0 },
    updated: { planning: 0, execution: 0, completion: 0, safety: 0, classification: 0 }
  };

  try {
    let cursor = null;
    for (;;) {
      const batch = await prisma.workOrder.findMany({
        where: args.tenant ? { tenantId: args.tenant } : undefined,
        take: args.batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
        include: {
          planning: true,
          execution: true,
          completion: true,
          safety: true,
          classification: true
        }
      });
      if (batch.length === 0) break;
      cursor = batch[batch.length - 1].id;

      for (const wo of batch) {
        summary.scanned += 1;
        try {
          const groups = [
            ["planning", hasPlanning(wo), wo.planning, prisma.workOrderPlanning],
            ["execution", hasExecution(wo), wo.execution, prisma.workOrderExecution],
            ["completion", hasCompletion(wo), wo.completion, prisma.workOrderCompletion],
            ["safety", hasSafety(wo), wo.safety, prisma.workOrderSafety],
            ["classification", hasClassification(wo), wo.classification, prisma.workOrderClassification]
          ];

          let touched = false;
          for (const [name, meaningful, existing] of groups) {
            if (!meaningful && !existing) continue;
            if (!meaningful && existing) {
              // Existing row with empty legacy snapshot — leave alone; dual-write owns updates.
              continue;
            }
            summary.candidates[name] += 1;
            if (existing) {
              if (existing.tenantId !== wo.tenantId) {
                summary.conflicts += 1;
                console.error(`CONFLICT tenant mismatch wo=${wo.id} group=${name}`);
                continue;
              }
              summary.wouldUpdate[name] += 1;
            } else {
              summary.wouldCreate[name] += 1;
            }
            touched = true;
          }

          if (!touched) {
            summary.alreadySynced += 1;
            continue;
          }

          if (!args.apply) continue;

          await prisma.$transaction(async (tx) => {
            const r = await syncViaTx(tx, wo);
            for (const k of Object.keys(r)) {
              if (r[k] === "created") summary.created[k] += 1;
              if (r[k] === "updated") summary.updated[k] += 1;
            }
          });
        } catch (err) {
          summary.failures += 1;
          console.error(`FAIL wo=${wo.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    if (summary.conflicts > 0 && args.apply) {
      console.error("STOP: conflicts detected during apply — aborting further use.");
      process.exitCode = 2;
    }

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function syncViaTx(tx, wo) {
  const result = {};
  async function upsertGroup(name, model, meaningful, existing, data) {
    if (!meaningful && !existing) return;
    if (!meaningful) return;
    if (existing && existing.tenantId !== wo.tenantId) {
      throw new Error(`tenant mismatch on ${name}`);
    }
    if (existing) {
      await model.update({ where: { workOrderId: wo.id }, data });
      result[name] = "updated";
    } else {
      await model.create({ data: { tenantId: wo.tenantId, workOrderId: wo.id, ...data } });
      result[name] = "created";
    }
  }

  await upsertGroup("planning", tx.workOrderPlanning, hasPlanning(wo), wo.planning, {
    expectedCompletionDate: wo.expectedCompletionDate,
    plannedStartAt: wo.plannedStartAt,
    plannedEndAt: wo.plannedEndAt,
    delayReason: wo.delayReason,
    cancelledReason: wo.cancelledReason,
    estimatedHours: wo.estimatedHours,
    estimatedDurationMinutes: wo.estimatedDurationMinutes,
    slaDeadline: wo.slaDeadline,
    slaBreached: wo.slaBreached ?? false
  });
  await upsertGroup("execution", tx.workOrderExecution, hasExecution(wo), wo.execution, {
    executionMode: wo.executionMode ?? "",
    vendorSupplierId: wo.vendorSupplierId,
    approvedById: wo.approvedById,
    approvedAt: wo.approvedAt,
    rejectionReason: wo.rejectionReason,
    startDate: wo.startDate,
    failedAt: wo.failedAt,
    reportedAt: wo.reportedAt,
    acknowledgedAt: wo.acknowledgedAt,
    technicianArrivedAt: wo.technicianArrivedAt,
    repairStartedAt: wo.repairStartedAt,
    repairCompletedAt: wo.repairCompletedAt,
    productionResumedAt: wo.productionResumedAt,
    holdReasonCode: wo.holdReasonCode,
    holdNotes: wo.holdNotes,
    heldAt: wo.heldAt,
    expectedResumeAt: wo.expectedResumeAt,
    resumedAt: wo.resumedAt,
    correctionReason: wo.correctionReason
  });
  await upsertGroup("completion", tx.workOrderCompletion, hasCompletion(wo), wo.completion, {
    completedDate: wo.completedDate,
    technicianCompletionNote: wo.technicianCompletionNote,
    verificationStatus: wo.verificationStatus ?? "",
    verifiedById: wo.verifiedById,
    verifiedAt: wo.verifiedAt,
    verificationNote: wo.verificationNote,
    verificationRejectionReason: wo.verificationRejectionReason,
    reopenReason: wo.reopenReason,
    reopenedAt: wo.reopenedAt,
    reopenedById: wo.reopenedById,
    actualHours: wo.actualHours,
    completionCondition: wo.completionCondition,
    followUpRequired: wo.followUpRequired ?? false,
    followUpNote: wo.followUpNote,
    qrVerificationStatus: wo.qrVerificationStatus ?? "",
    qrVerifiedAt: wo.qrVerifiedAt,
    qrVerifiedById: wo.qrVerifiedById,
    qrVerifiedAssetId: wo.qrVerifiedAssetId,
    qrVerifiedVehicleId: wo.qrVerifiedVehicleId,
    qrOverrideReason: wo.qrOverrideReason,
    requesterConfirmationStatus: wo.requesterConfirmationStatus ?? "NOT_REQUIRED",
    requesterConfirmationDueAt: wo.requesterConfirmationDueAt,
    requesterConfirmedAt: wo.requesterConfirmedAt,
    requesterConfirmedById: wo.requesterConfirmedById,
    requesterConfirmationNote: wo.requesterConfirmationNote,
    requesterConfirmationOutcome: wo.requesterConfirmationOutcome,
    requesterConfirmationPolicyHours: wo.requesterConfirmationPolicyHours,
    functionalTestResult: wo.functionalTestResult,
    roadTestResult: wo.roadTestResult,
    completionMeterReading: wo.completionMeterReading,
    operatingRestriction: wo.operatingRestriction,
    productionImpact: wo.productionImpact
  });
  await upsertGroup("safety", tx.workOrderSafety, hasSafety(wo), wo.safety, {
    riskLevel: wo.riskLevel,
    ppeRequired: wo.ppeRequired ?? "[]",
    lotoRequired: wo.lotoRequired ?? false,
    hotWorkRequired: wo.hotWorkRequired ?? false,
    workingAtHeight: wo.workingAtHeight ?? false,
    electricalIsolation: wo.electricalIsolation ?? false,
    confinedSpace: wo.confinedSpace ?? false,
    permitReference: wo.permitReference
  });
  await upsertGroup(
    "classification",
    tx.workOrderClassification,
    hasClassification(wo),
    wo.classification,
    {
      maintenanceTemplateId: wo.maintenanceTemplateId,
      maintenanceTemplateVersion: wo.maintenanceTemplateVersion,
      maintenanceTemplateSnapshot: wo.maintenanceTemplateSnapshot,
      failureCodeId: wo.failureCodeId,
      causeCodeId: wo.causeCodeId,
      remedyCodeId: wo.remedyCodeId,
      failureCodeSnapshot: wo.failureCodeSnapshot,
      causeCodeSnapshot: wo.causeCodeSnapshot,
      remedyCodeSnapshot: wo.remedyCodeSnapshot,
      taxonomyCategoryId: wo.taxonomyCategoryId,
      taxonomyTypeId: wo.taxonomyTypeId,
      taxonomyIssueId: wo.taxonomyIssueId,
      categoryNameSnapshot: wo.categoryNameSnapshot,
      typeNameSnapshot: wo.typeNameSnapshot,
      issueNameSnapshot: wo.issueNameSnapshot,
      isTriage: wo.isTriage ?? false,
      triageReason: wo.triageReason,
      triageClassifiedAt: wo.triageClassifiedAt,
      triageClassifiedById: wo.triageClassifiedById
    }
  );
  return result;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
