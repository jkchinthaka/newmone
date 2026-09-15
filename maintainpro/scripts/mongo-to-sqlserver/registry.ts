/**
 * Phase 15A — model coverage + Mongo collection mapping + dependency order.
 */
export type ModelClass =
  | "MIGRATE"
  | "CONFIG_RECREATE"
  | "DERIVED_REGENERATE"
  | "LEGACY_READ_ONLY_RETAIN"
  | "EXPLICITLY_SKIP";

export type ModelEntry = {
  model: string;
  /** Prisma Mongo default collection (model name as-is — Prisma Mongo uses exact model name) */
  collection: string;
  classification: ModelClass;
  reason?: string;
  /** Scalar list fields that become junction rows (stripped from parent upsert). */
  junctionArrays?: string[];
};

/**
 * Prisma MongoDB provider stores collections as the **model name** (PascalCase),
 * not camelCase — unless @@map is set (none in current schema).
 */
export function defaultMongoCollection(model: string): string {
  return model;
}

/** Ordered parents-before-children for active CMMS path. */
export const DEPENDENCY_ORDER: string[] = [
  "Tenant",
  "Permission",
  "Role",
  "RolePermission",
  "Department",
  "User",
  "UserSkill",
  "RefreshToken",
  "PasswordResetToken",
  "Site",
  "FunctionalLocation",
  "AssetDomain",
  "AssetCategoryMaster",
  "AssetTypeMaster",
  "AssetAttributeDefinition",
  "Asset",
  "AssetLocationHistory",
  "Vehicle",
  "Driver",
  "Supplier",
  "Warehouse",
  "SparePart",
  "WarehouseItemBalance",
  "JobCode",
  "JobCodeRequiredPart",
  "RequestProblemCategory",
  "MaintenanceAnalysisCode",
  "MaintenanceRequest",
  "MaintenanceRequestHistory",
  "WorkOrder",
  "WorkOrderAssignee",
  "WorkOrderStatusHistory",
  "WorkOrderHoldHistory",
  "WorkOrderLabourEntry",
  "WorkOrderPart",
  "ApprovalRule",
  "ApprovalRuleLevel",
  "ApprovalRequest",
  "ApprovalStep",
  "ApprovalDecision",
  "PmPlan",
  "PmPlanRequiredPart",
  "PmPlanRevision",
  "PmTrigger",
  "PmAutoGeneration",
  "AssetMeter",
  "MeterReading",
  "ChecklistTemplate",
  "ChecklistTemplateItem",
  "ChecklistExecution",
  "InspectionTemplate",
  "Inspection",
  "InspectionFinding",
  "CalibrationRecord",
  "ComplianceRequirement",
  "PartRequest",
  "PartIssue",
  "StockMovement",
  "WorkOrderCostSnapshot",
  "VendorContract",
  "VendorContractAsset",
  "VendorContractSite",
  "RepairWarranty",
  "VehicleTyre",
  "VehicleBattery",
  "VehicleAssignment",
  "VehicleGateMovement",
  "FuelLog",
  "AccidentReport",
  "EvidenceAttachment",
  "Notification",
  "AuditLog",
  "SecurityEvent",
  "AppSetting",
  "ReplicationOutbox",
  "DomainEventOutbox"
];

const SKIP: Record<string, string> = {
  Subscription: "Billing soft-retired — CONFIG/skip for CMMS rehearsal",
  UsageMetric: "Billing soft-retired",
  UsageEvent: "Billing soft-retired",
  StripeCustomer: "Billing soft-retired",
  StripeInvoice: "Billing soft-retired",
  Plan: "Billing soft-retired",
  Entitlement: "Billing soft-retired",
  SoftwareRelease: "Go-live soft-retired",
  ChangeRequest: "Go-live soft-retired",
  PilotRollout: "Go-live soft-retired",
  RolloutWave: "Go-live soft-retired",
  HypercarePlan: "Go-live soft-retired",
  GoLiveDecision: "Go-live soft-retired",
  CropCycle: "Farm soft-retired — LEGACY retain source only",
  Field: "Farm soft-retired",
  HarvestRecord: "Farm soft-retired",
  SprayLog: "Farm soft-retired",
  TraceabilityRecord: "Farm soft-retired — junction listed but parent skip unless present",
  CleaningVisit: "Cleaning soft-retired",
  CleaningLocation: "Cleaning soft-retired",
  FacilityIssue: "LEGACY_READ_ONLY_RETAIN — migrate bridge separately if present",
  CopilotConversation: "Predictive AI soft-retired",
  CopilotMessage: "Predictive AI soft-retired"
};

export function buildRegistry(allModelNames: string[]): ModelEntry[] {
  const ordered = [...DEPENDENCY_ORDER];
  const seen = new Set(ordered);
  for (const m of allModelNames) {
    if (!seen.has(m)) ordered.push(m);
  }
  return ordered.map((model) => {
    if (SKIP[model]) {
      return {
        model,
        collection: defaultMongoCollection(model),
        classification: SKIP[model].startsWith("LEGACY")
          ? "LEGACY_READ_ONLY_RETAIN"
          : ("EXPLICITLY_SKIP" as ModelClass),
        reason: SKIP[model]
      };
    }
    if (!DEPENDENCY_ORDER.includes(model) && !allModelNames.includes(model)) {
      return {
        model,
        collection: defaultMongoCollection(model),
        classification: "EXPLICITLY_SKIP",
        reason: "Not in active dependency path"
      };
    }
    const junctionArrays: string[] | undefined = {
      Role: ["permissionIds"],
      Permission: ["roleIds"],
      User: ["skills"],
      JobCode: ["requiredPartIds"],
      PmPlan: ["requiredPartIds"],
      VendorContract: ["assetIds", "siteIds"],
      TraceabilityRecord: ["sprayLogIds"]
    }[model];

    return {
      model,
      collection: defaultMongoCollection(model),
      classification: DEPENDENCY_ORDER.includes(model) ? "MIGRATE" : "EXPLICITLY_SKIP",
      reason: DEPENDENCY_ORDER.includes(model) ? undefined : "Outside Phase 15A CMMS rehearsal set — add deliberately to migrate",
      junctionArrays
    };
  });
}

export const JUNCTION_EXTRACTORS: Record<
  string,
  Array<{
    arrayField: string;
    junctionModel: string;
    mapRow: (parentId: string, value: string, parent: Record<string, unknown>) => Record<string, unknown>;
  }>
> = {
  Role: [
    {
      arrayField: "permissionIds",
      junctionModel: "RolePermission",
      mapRow: (roleId, permissionId) => ({
        roleId,
        permissionId
      })
    }
  ],
  User: [
    {
      arrayField: "skills",
      junctionModel: "UserSkill",
      mapRow: (userId, skill) => ({
        userId,
        skill: String(skill).slice(0, 128)
      })
    }
  ],
  JobCode: [
    {
      arrayField: "requiredPartIds",
      junctionModel: "JobCodeRequiredPart",
      mapRow: (jobCodeId, sparePartId) => ({
        jobCodeId,
        sparePartId
      })
    }
  ],
  PmPlan: [
    {
      arrayField: "requiredPartIds",
      junctionModel: "PmPlanRequiredPart",
      mapRow: (pmPlanId, sparePartId) => ({
        pmPlanId,
        sparePartId
      })
    }
  ],
  VendorContract: [
    {
      arrayField: "assetIds",
      junctionModel: "VendorContractAsset",
      mapRow: (vendorContractId, assetId) => ({
        vendorContractId,
        assetId
      })
    },
    {
      arrayField: "siteIds",
      junctionModel: "VendorContractSite",
      mapRow: (vendorContractId, siteId) => ({
        vendorContractId,
        siteId
      })
    }
  ],
  TraceabilityRecord: [
    {
      arrayField: "sprayLogIds",
      junctionModel: "TraceabilitySprayLink",
      mapRow: (traceabilityRecordId, sprayLogId) => ({
        traceabilityRecordId,
        sprayLogId
      })
    }
  ]
};
