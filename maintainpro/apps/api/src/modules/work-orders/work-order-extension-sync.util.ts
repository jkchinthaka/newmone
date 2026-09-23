/**
 * DB-3 dual-write: keep WorkOrder extension tables synchronized with legacy
 * WorkOrder columns inside the same Prisma transaction / write path.
 *
 * Existence rules (lazy upsert — do not create empty rows):
 * - Planning: any planning/SLA field set, or slaBreached === true
 * - Execution: non-empty executionMode, vendor, approval, ops timestamps, hold, correction
 * - Completion: completion / verification / QR / requester / domain test fields beyond defaults
 * - Safety: riskLevel, permitReference, non-default PPE, or any safety flag true
 * - Classification: template, analysis codes, taxonomy, snapshots, or triage state
 *
 * jobCategoryId stays on WorkOrder base (Category HCI) — never mirrored here.
 * DowntimeSegment / TemporaryRepairRecord remain authoritative for those concepts.
 */

export type WorkOrderExtensionSource = {
  id: string;
  tenantId: string;
  expectedCompletionDate?: Date | null;
  plannedStartAt?: Date | null;
  plannedEndAt?: Date | null;
  delayReason?: string | null;
  cancelledReason?: string | null;
  estimatedHours?: number | null;
  estimatedDurationMinutes?: number | null;
  slaDeadline?: Date | null;
  slaBreached?: boolean | null;
  executionMode?: string | null;
  vendorSupplierId?: string | null;
  approvedById?: string | null;
  approvedAt?: Date | null;
  rejectionReason?: string | null;
  startDate?: Date | null;
  failedAt?: Date | null;
  reportedAt?: Date | null;
  acknowledgedAt?: Date | null;
  technicianArrivedAt?: Date | null;
  repairStartedAt?: Date | null;
  repairCompletedAt?: Date | null;
  productionResumedAt?: Date | null;
  holdReasonCode?: string | null;
  holdNotes?: string | null;
  heldAt?: Date | null;
  expectedResumeAt?: Date | null;
  resumedAt?: Date | null;
  correctionReason?: string | null;
  completedDate?: Date | null;
  technicianCompletionNote?: string | null;
  verificationStatus?: string | null;
  verifiedById?: string | null;
  verifiedAt?: Date | null;
  verificationNote?: string | null;
  verificationRejectionReason?: string | null;
  reopenReason?: string | null;
  reopenedAt?: Date | null;
  reopenedById?: string | null;
  actualHours?: number | null;
  completionCondition?: string | null;
  followUpRequired?: boolean | null;
  followUpNote?: string | null;
  qrVerificationStatus?: string | null;
  qrVerifiedAt?: Date | null;
  qrVerifiedById?: string | null;
  qrVerifiedAssetId?: string | null;
  qrVerifiedVehicleId?: string | null;
  qrOverrideReason?: string | null;
  requesterConfirmationStatus?: string | null;
  requesterConfirmationDueAt?: Date | null;
  requesterConfirmedAt?: Date | null;
  requesterConfirmedById?: string | null;
  requesterConfirmationNote?: string | null;
  requesterConfirmationOutcome?: string | null;
  requesterConfirmationPolicyHours?: number | null;
  functionalTestResult?: string | null;
  roadTestResult?: string | null;
  completionMeterReading?: number | null;
  operatingRestriction?: string | null;
  productionImpact?: string | null;
  riskLevel?: string | null;
  ppeRequired?: string | null;
  lotoRequired?: boolean | null;
  hotWorkRequired?: boolean | null;
  workingAtHeight?: boolean | null;
  electricalIsolation?: boolean | null;
  confinedSpace?: boolean | null;
  permitReference?: string | null;
  maintenanceTemplateId?: string | null;
  maintenanceTemplateVersion?: number | null;
  maintenanceTemplateSnapshot?: string | null;
  failureCodeId?: string | null;
  causeCodeId?: string | null;
  remedyCodeId?: string | null;
  failureCodeSnapshot?: string | null;
  causeCodeSnapshot?: string | null;
  remedyCodeSnapshot?: string | null;
  taxonomyCategoryId?: string | null;
  taxonomyTypeId?: string | null;
  taxonomyIssueId?: string | null;
  categoryNameSnapshot?: string | null;
  typeNameSnapshot?: string | null;
  issueNameSnapshot?: string | null;
  isTriage?: boolean | null;
  triageReason?: string | null;
  triageClassifiedAt?: Date | null;
  triageClassifiedById?: string | null;
};

type ExtensionDb = {
  workOrderPlanning: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<{ id: string } | null>;
  };
  workOrderExecution: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<{ id: string } | null>;
  };
  workOrderCompletion: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<{ id: string } | null>;
  };
  workOrderSafety: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<{ id: string } | null>;
  };
  workOrderClassification: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<{ id: string } | null>;
  };
};

function present(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function hasMeaningfulPlanning(wo: WorkOrderExtensionSource): boolean {
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

export function hasMeaningfulExecution(wo: WorkOrderExtensionSource): boolean {
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

export function hasMeaningfulCompletion(wo: WorkOrderExtensionSource): boolean {
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
    (present(wo.requesterConfirmationStatus) &&
      wo.requesterConfirmationStatus !== "NOT_REQUIRED") ||
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

export function hasMeaningfulSafety(wo: WorkOrderExtensionSource): boolean {
  const ppe = wo.ppeRequired?.trim() ?? "";
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

export function hasMeaningfulClassification(wo: WorkOrderExtensionSource): boolean {
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

/**
 * Upsert extension rows from a WorkOrder snapshot. Safe to call repeatedly.
 * Creates rows only when the field group has meaningful state (or the row already exists).
 */
export async function syncWorkOrderExtensions(
  db: ExtensionDb,
  wo: WorkOrderExtensionSource
): Promise<{
  planning: boolean;
  execution: boolean;
  completion: boolean;
  safety: boolean;
  classification: boolean;
}> {
  const result = {
    planning: false,
    execution: false,
    completion: false,
    safety: false,
    classification: false
  };

  // Partial Prisma mocks (unit tests) may omit extension delegates — no-op safely.
  if (
    typeof db?.workOrderPlanning?.findUnique !== "function" ||
    typeof db?.workOrderExecution?.findUnique !== "function" ||
    typeof db?.workOrderCompletion?.findUnique !== "function" ||
    typeof db?.workOrderSafety?.findUnique !== "function" ||
    typeof db?.workOrderClassification?.findUnique !== "function"
  ) {
    return result;
  }

  const existingPlanning = await db.workOrderPlanning.findUnique({
    where: { workOrderId: wo.id },
    select: { id: true }
  });
  if (existingPlanning || hasMeaningfulPlanning(wo)) {
    await db.workOrderPlanning.upsert({
      where: { workOrderId: wo.id },
      create: {
        tenantId: wo.tenantId,
        workOrderId: wo.id,
        expectedCompletionDate: wo.expectedCompletionDate ?? null,
        plannedStartAt: wo.plannedStartAt ?? null,
        plannedEndAt: wo.plannedEndAt ?? null,
        delayReason: wo.delayReason ?? null,
        cancelledReason: wo.cancelledReason ?? null,
        estimatedHours: wo.estimatedHours ?? null,
        estimatedDurationMinutes: wo.estimatedDurationMinutes ?? null,
        slaDeadline: wo.slaDeadline ?? null,
        slaBreached: wo.slaBreached ?? false
      },
      update: {
        expectedCompletionDate: wo.expectedCompletionDate ?? null,
        plannedStartAt: wo.plannedStartAt ?? null,
        plannedEndAt: wo.plannedEndAt ?? null,
        delayReason: wo.delayReason ?? null,
        cancelledReason: wo.cancelledReason ?? null,
        estimatedHours: wo.estimatedHours ?? null,
        estimatedDurationMinutes: wo.estimatedDurationMinutes ?? null,
        slaDeadline: wo.slaDeadline ?? null,
        slaBreached: wo.slaBreached ?? false
      }
    });
    result.planning = true;
  }

  const existingExecution = await db.workOrderExecution.findUnique({
    where: { workOrderId: wo.id },
    select: { id: true }
  });
  if (existingExecution || hasMeaningfulExecution(wo)) {
    await db.workOrderExecution.upsert({
      where: { workOrderId: wo.id },
      create: {
        tenantId: wo.tenantId,
        workOrderId: wo.id,
        executionMode: wo.executionMode ?? "",
        vendorSupplierId: wo.vendorSupplierId ?? null,
        approvedById: wo.approvedById ?? null,
        approvedAt: wo.approvedAt ?? null,
        rejectionReason: wo.rejectionReason ?? null,
        startDate: wo.startDate ?? null,
        failedAt: wo.failedAt ?? null,
        reportedAt: wo.reportedAt ?? null,
        acknowledgedAt: wo.acknowledgedAt ?? null,
        technicianArrivedAt: wo.technicianArrivedAt ?? null,
        repairStartedAt: wo.repairStartedAt ?? null,
        repairCompletedAt: wo.repairCompletedAt ?? null,
        productionResumedAt: wo.productionResumedAt ?? null,
        holdReasonCode: wo.holdReasonCode ?? null,
        holdNotes: wo.holdNotes ?? null,
        heldAt: wo.heldAt ?? null,
        expectedResumeAt: wo.expectedResumeAt ?? null,
        resumedAt: wo.resumedAt ?? null,
        correctionReason: wo.correctionReason ?? null
      },
      update: {
        executionMode: wo.executionMode ?? "",
        vendorSupplierId: wo.vendorSupplierId ?? null,
        approvedById: wo.approvedById ?? null,
        approvedAt: wo.approvedAt ?? null,
        rejectionReason: wo.rejectionReason ?? null,
        startDate: wo.startDate ?? null,
        failedAt: wo.failedAt ?? null,
        reportedAt: wo.reportedAt ?? null,
        acknowledgedAt: wo.acknowledgedAt ?? null,
        technicianArrivedAt: wo.technicianArrivedAt ?? null,
        repairStartedAt: wo.repairStartedAt ?? null,
        repairCompletedAt: wo.repairCompletedAt ?? null,
        productionResumedAt: wo.productionResumedAt ?? null,
        holdReasonCode: wo.holdReasonCode ?? null,
        holdNotes: wo.holdNotes ?? null,
        heldAt: wo.heldAt ?? null,
        expectedResumeAt: wo.expectedResumeAt ?? null,
        resumedAt: wo.resumedAt ?? null,
        correctionReason: wo.correctionReason ?? null
      }
    });
    result.execution = true;
  }

  const existingCompletion = await db.workOrderCompletion.findUnique({
    where: { workOrderId: wo.id },
    select: { id: true }
  });
  if (existingCompletion || hasMeaningfulCompletion(wo)) {
    await db.workOrderCompletion.upsert({
      where: { workOrderId: wo.id },
      create: {
        tenantId: wo.tenantId,
        workOrderId: wo.id,
        completedDate: wo.completedDate ?? null,
        technicianCompletionNote: wo.technicianCompletionNote ?? null,
        verificationStatus: wo.verificationStatus ?? "",
        verifiedById: wo.verifiedById ?? null,
        verifiedAt: wo.verifiedAt ?? null,
        verificationNote: wo.verificationNote ?? null,
        verificationRejectionReason: wo.verificationRejectionReason ?? null,
        reopenReason: wo.reopenReason ?? null,
        reopenedAt: wo.reopenedAt ?? null,
        reopenedById: wo.reopenedById ?? null,
        actualHours: wo.actualHours ?? null,
        completionCondition: wo.completionCondition ?? null,
        followUpRequired: wo.followUpRequired ?? false,
        followUpNote: wo.followUpNote ?? null,
        qrVerificationStatus: wo.qrVerificationStatus ?? "",
        qrVerifiedAt: wo.qrVerifiedAt ?? null,
        qrVerifiedById: wo.qrVerifiedById ?? null,
        qrVerifiedAssetId: wo.qrVerifiedAssetId ?? null,
        qrVerifiedVehicleId: wo.qrVerifiedVehicleId ?? null,
        qrOverrideReason: wo.qrOverrideReason ?? null,
        requesterConfirmationStatus: wo.requesterConfirmationStatus ?? "NOT_REQUIRED",
        requesterConfirmationDueAt: wo.requesterConfirmationDueAt ?? null,
        requesterConfirmedAt: wo.requesterConfirmedAt ?? null,
        requesterConfirmedById: wo.requesterConfirmedById ?? null,
        requesterConfirmationNote: wo.requesterConfirmationNote ?? null,
        requesterConfirmationOutcome: wo.requesterConfirmationOutcome ?? null,
        requesterConfirmationPolicyHours: wo.requesterConfirmationPolicyHours ?? null,
        functionalTestResult: wo.functionalTestResult ?? null,
        roadTestResult: wo.roadTestResult ?? null,
        completionMeterReading: wo.completionMeterReading ?? null,
        operatingRestriction: wo.operatingRestriction ?? null,
        productionImpact: wo.productionImpact ?? null
      },
      update: {
        completedDate: wo.completedDate ?? null,
        technicianCompletionNote: wo.technicianCompletionNote ?? null,
        verificationStatus: wo.verificationStatus ?? "",
        verifiedById: wo.verifiedById ?? null,
        verifiedAt: wo.verifiedAt ?? null,
        verificationNote: wo.verificationNote ?? null,
        verificationRejectionReason: wo.verificationRejectionReason ?? null,
        reopenReason: wo.reopenReason ?? null,
        reopenedAt: wo.reopenedAt ?? null,
        reopenedById: wo.reopenedById ?? null,
        actualHours: wo.actualHours ?? null,
        completionCondition: wo.completionCondition ?? null,
        followUpRequired: wo.followUpRequired ?? false,
        followUpNote: wo.followUpNote ?? null,
        qrVerificationStatus: wo.qrVerificationStatus ?? "",
        qrVerifiedAt: wo.qrVerifiedAt ?? null,
        qrVerifiedById: wo.qrVerifiedById ?? null,
        qrVerifiedAssetId: wo.qrVerifiedAssetId ?? null,
        qrVerifiedVehicleId: wo.qrVerifiedVehicleId ?? null,
        qrOverrideReason: wo.qrOverrideReason ?? null,
        requesterConfirmationStatus: wo.requesterConfirmationStatus ?? "NOT_REQUIRED",
        requesterConfirmationDueAt: wo.requesterConfirmationDueAt ?? null,
        requesterConfirmedAt: wo.requesterConfirmedAt ?? null,
        requesterConfirmedById: wo.requesterConfirmedById ?? null,
        requesterConfirmationNote: wo.requesterConfirmationNote ?? null,
        requesterConfirmationOutcome: wo.requesterConfirmationOutcome ?? null,
        requesterConfirmationPolicyHours: wo.requesterConfirmationPolicyHours ?? null,
        functionalTestResult: wo.functionalTestResult ?? null,
        roadTestResult: wo.roadTestResult ?? null,
        completionMeterReading: wo.completionMeterReading ?? null,
        operatingRestriction: wo.operatingRestriction ?? null,
        productionImpact: wo.productionImpact ?? null
      }
    });
    result.completion = true;
  }

  const existingSafety = await db.workOrderSafety.findUnique({
    where: { workOrderId: wo.id },
    select: { id: true }
  });
  if (existingSafety || hasMeaningfulSafety(wo)) {
    await db.workOrderSafety.upsert({
      where: { workOrderId: wo.id },
      create: {
        tenantId: wo.tenantId,
        workOrderId: wo.id,
        riskLevel: wo.riskLevel ?? null,
        ppeRequired: wo.ppeRequired ?? "[]",
        lotoRequired: wo.lotoRequired ?? false,
        hotWorkRequired: wo.hotWorkRequired ?? false,
        workingAtHeight: wo.workingAtHeight ?? false,
        electricalIsolation: wo.electricalIsolation ?? false,
        confinedSpace: wo.confinedSpace ?? false,
        permitReference: wo.permitReference ?? null
      },
      update: {
        riskLevel: wo.riskLevel ?? null,
        ppeRequired: wo.ppeRequired ?? "[]",
        lotoRequired: wo.lotoRequired ?? false,
        hotWorkRequired: wo.hotWorkRequired ?? false,
        workingAtHeight: wo.workingAtHeight ?? false,
        electricalIsolation: wo.electricalIsolation ?? false,
        confinedSpace: wo.confinedSpace ?? false,
        permitReference: wo.permitReference ?? null
      }
    });
    result.safety = true;
  }

  const existingClassification = await db.workOrderClassification.findUnique({
    where: { workOrderId: wo.id },
    select: { id: true }
  });
  if (existingClassification || hasMeaningfulClassification(wo)) {
    await db.workOrderClassification.upsert({
      where: { workOrderId: wo.id },
      create: {
        tenantId: wo.tenantId,
        workOrderId: wo.id,
        maintenanceTemplateId: wo.maintenanceTemplateId ?? null,
        maintenanceTemplateVersion: wo.maintenanceTemplateVersion ?? null,
        maintenanceTemplateSnapshot: wo.maintenanceTemplateSnapshot ?? null,
        failureCodeId: wo.failureCodeId ?? null,
        causeCodeId: wo.causeCodeId ?? null,
        remedyCodeId: wo.remedyCodeId ?? null,
        failureCodeSnapshot: wo.failureCodeSnapshot ?? null,
        causeCodeSnapshot: wo.causeCodeSnapshot ?? null,
        remedyCodeSnapshot: wo.remedyCodeSnapshot ?? null,
        taxonomyCategoryId: wo.taxonomyCategoryId ?? null,
        taxonomyTypeId: wo.taxonomyTypeId ?? null,
        taxonomyIssueId: wo.taxonomyIssueId ?? null,
        categoryNameSnapshot: wo.categoryNameSnapshot ?? null,
        typeNameSnapshot: wo.typeNameSnapshot ?? null,
        issueNameSnapshot: wo.issueNameSnapshot ?? null,
        isTriage: wo.isTriage ?? false,
        triageReason: wo.triageReason ?? null,
        triageClassifiedAt: wo.triageClassifiedAt ?? null,
        triageClassifiedById: wo.triageClassifiedById ?? null
      },
      update: {
        maintenanceTemplateId: wo.maintenanceTemplateId ?? null,
        maintenanceTemplateVersion: wo.maintenanceTemplateVersion ?? null,
        maintenanceTemplateSnapshot: wo.maintenanceTemplateSnapshot ?? null,
        failureCodeId: wo.failureCodeId ?? null,
        causeCodeId: wo.causeCodeId ?? null,
        remedyCodeId: wo.remedyCodeId ?? null,
        failureCodeSnapshot: wo.failureCodeSnapshot ?? null,
        causeCodeSnapshot: wo.causeCodeSnapshot ?? null,
        remedyCodeSnapshot: wo.remedyCodeSnapshot ?? null,
        taxonomyCategoryId: wo.taxonomyCategoryId ?? null,
        taxonomyTypeId: wo.taxonomyTypeId ?? null,
        taxonomyIssueId: wo.taxonomyIssueId ?? null,
        categoryNameSnapshot: wo.categoryNameSnapshot ?? null,
        typeNameSnapshot: wo.typeNameSnapshot ?? null,
        issueNameSnapshot: wo.issueNameSnapshot ?? null,
        isTriage: wo.isTriage ?? false,
        triageReason: wo.triageReason ?? null,
        triageClassifiedAt: wo.triageClassifiedAt ?? null,
        triageClassifiedById: wo.triageClassifiedById ?? null
      }
    });
    result.classification = true;
  }

  return result;
}

/**
 * Prefer extension value when the extension row exists; otherwise legacy.
 * Uses null/undefined semantics — does not treat false/0/"" as missing.
 */
export function preferExtensionValue<T>(
  extensionRow: object | null | undefined,
  extensionValue: T | null | undefined,
  legacyValue: T | null | undefined
): T | null | undefined {
  if (extensionRow == null) return legacyValue;
  return extensionValue === undefined ? legacyValue : extensionValue;
}
