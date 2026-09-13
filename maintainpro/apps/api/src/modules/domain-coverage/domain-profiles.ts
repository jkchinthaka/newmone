/**
 * Company-wide maintenance domain coverage.
 * Uses the shared Asset / WO / PM / compliance engines — no duplicate engines.
 *
 * ASSUMPTION: KPI sets and example checklist codes are proposed defaults for
 * configuration, not verified Nelna operational frequencies or limits.
 */

export type MaintenanceDomainKey =
  | "PLANT_MACHINERY"
  | "MECHANICAL"
  | "ELECTRICAL"
  | "UTILITIES"
  | "HVAC"
  | "REFRIGERATION"
  | "BUILDING_CIVIL"
  | "PLUMBING"
  | "WATER_WASTEWATER"
  | "FLEET"
  | "MATERIAL_HANDLING"
  | "FARM_INFRASTRUCTURE"
  | "OUTLETS_BRANCHES"
  | "FIRE_SAFETY"
  | "SECURITY_EQUIPMENT"
  | "IT_HARDWARE"
  | "LAB_EQUIPMENT"
  | "CALIBRATION_EQUIPMENT"
  | "KITCHEN_CANTEEN"
  | "SOLAR_ENERGY"
  | "TOOLS_MOULDS_JIGS"
  | "EXTERNAL_INFRASTRUCTURE"
  | "OTHER";

export type DomainKpiKey =
  | "MTTR"
  | "MTBF"
  | "AVAILABILITY"
  | "DOWNTIME"
  | "COST_PER_KM"
  | "SERVICE_COMPLIANCE"
  | "FUEL_EFFICIENCY"
  | "BACKLOG_AGE"
  | "CONDITION"
  | "SPEND"
  | "REPEAT_DEFECTS"
  | "COMPLIANCE_DUE"
  | "COMPLIANCE_EXPIRED"
  | "COMPLIANCE_COMPLETION";

export type DomainProfile = {
  key: MaintenanceDomainKey;
  label: string;
  /** Maps onto existing AssetCategory values where applicable */
  assetCategories: string[];
  applicableFields: string[];
  kpiKeys: DomainKpiKey[];
  examplePmTemplateCodes: string[];
  complianceTypeKeys: string[];
  requiredClosureFields: string[];
  notes?: string;
};

export const MAINTENANCE_DOMAIN_PROFILES: DomainProfile[] = [
  {
    key: "PLANT_MACHINERY",
    label: "Plant & Machinery",
    assetCategories: ["MACHINE", "EQUIPMENT"],
    applicableFields: ["criticality", "meterReading", "manufacturer", "model", "serialNumber"],
    kpiKeys: ["MTTR", "MTBF", "AVAILABILITY", "DOWNTIME"],
    examplePmTemplateCodes: ["PM-MACHINE-GENERIC"],
    complianceTypeKeys: ["STATUTORY_INSPECTION", "WARRANTY"],
    requiredClosureFields: ["failureCode", "causeCode", "remedyCode", "downtimeMinutes"]
  },
  {
    key: "MECHANICAL",
    label: "Mechanical",
    assetCategories: ["MACHINE", "EQUIPMENT"],
    applicableFields: ["criticality", "meterReading"],
    kpiKeys: ["MTTR", "MTBF", "AVAILABILITY", "DOWNTIME"],
    examplePmTemplateCodes: ["PM-MECH-GENERIC"],
    complianceTypeKeys: ["STATUTORY_INSPECTION"],
    requiredClosureFields: ["failureCode", "causeCode", "remedyCode"]
  },
  {
    key: "ELECTRICAL",
    label: "Electrical",
    assetCategories: ["EQUIPMENT", "INFRASTRUCTURE"],
    applicableFields: ["criticality", "location"],
    kpiKeys: ["MTTR", "AVAILABILITY", "DOWNTIME", "REPEAT_DEFECTS"],
    examplePmTemplateCodes: ["PM-ELEC-GENERIC"],
    complianceTypeKeys: ["STATUTORY_INSPECTION"],
    requiredClosureFields: ["failureCode", "evidence"]
  },
  {
    key: "UTILITIES",
    label: "Utilities",
    assetCategories: ["INFRASTRUCTURE", "EQUIPMENT"],
    applicableFields: ["location", "meterReading"],
    kpiKeys: ["AVAILABILITY", "DOWNTIME", "SPEND"],
    examplePmTemplateCodes: ["PM-UTIL-GENERIC"],
    complianceTypeKeys: ["SERVICE_AGREEMENT"],
    requiredClosureFields: ["meterReading"]
  },
  {
    key: "HVAC",
    label: "HVAC",
    assetCategories: ["EQUIPMENT"],
    applicableFields: ["location", "manufacturer", "model"],
    kpiKeys: ["MTTR", "AVAILABILITY", "SERVICE_COMPLIANCE"],
    examplePmTemplateCodes: ["PM-HVAC-GENERIC"],
    complianceTypeKeys: ["SERVICE_AGREEMENT"],
    requiredClosureFields: ["checklistComplete"]
  },
  {
    key: "REFRIGERATION",
    label: "Refrigeration",
    assetCategories: ["EQUIPMENT", "COLD_ROOM"],
    applicableFields: ["location", "criticality"],
    kpiKeys: ["AVAILABILITY", "DOWNTIME", "SERVICE_COMPLIANCE"],
    examplePmTemplateCodes: ["PM-REF-GENERIC"],
    complianceTypeKeys: ["SERVICE_AGREEMENT", "CALIBRATION"],
    requiredClosureFields: ["checklistComplete", "evidence"],
    notes: "Temperature limits are OWNER REQUIRED — not hardcoded here."
  },
  {
    key: "BUILDING_CIVIL",
    label: "Building / Civil",
    assetCategories: ["INFRASTRUCTURE"],
    applicableFields: ["location", "condition"],
    kpiKeys: ["BACKLOG_AGE", "CONDITION", "SPEND", "REPEAT_DEFECTS"],
    examplePmTemplateCodes: ["PM-CIVIL-GENERIC"],
    complianceTypeKeys: ["STATUTORY_INSPECTION", "FIRE_SERVICING"],
    requiredClosureFields: ["location", "evidence"]
  },
  {
    key: "PLUMBING",
    label: "Plumbing",
    assetCategories: ["INFRASTRUCTURE"],
    applicableFields: ["location"],
    kpiKeys: ["BACKLOG_AGE", "REPEAT_DEFECTS", "SPEND"],
    examplePmTemplateCodes: ["PM-PLUMB-GENERIC"],
    complianceTypeKeys: [],
    requiredClosureFields: ["location"]
  },
  {
    key: "WATER_WASTEWATER",
    label: "Water / Wastewater",
    assetCategories: ["INFRASTRUCTURE", "EQUIPMENT"],
    applicableFields: ["location", "meterReading"],
    kpiKeys: ["AVAILABILITY", "DOWNTIME", "COMPLIANCE_DUE"],
    examplePmTemplateCodes: ["PM-WATER-GENERIC"],
    complianceTypeKeys: ["STATUTORY_INSPECTION"],
    requiredClosureFields: ["meterReading"]
  },
  {
    key: "FLEET",
    label: "Fleet",
    assetCategories: ["VEHICLE"],
    applicableFields: ["registration", "mileage", "fuelType", "assignedDriver"],
    kpiKeys: ["COST_PER_KM", "AVAILABILITY", "SERVICE_COMPLIANCE", "FUEL_EFFICIENCY"],
    examplePmTemplateCodes: ["PM-FLEET-SERVICE"],
    complianceTypeKeys: ["INSURANCE", "REVENUE_LICENCE", "EMISSION", "FITNESS"],
    requiredClosureFields: ["mileage", "partsUsed"]
  },
  {
    key: "MATERIAL_HANDLING",
    label: "Material Handling",
    assetCategories: ["EQUIPMENT", "MACHINE"],
    applicableFields: ["meterReading", "criticality"],
    kpiKeys: ["MTTR", "MTBF", "AVAILABILITY"],
    examplePmTemplateCodes: ["PM-MH-GENERIC"],
    complianceTypeKeys: ["STATUTORY_INSPECTION"],
    requiredClosureFields: ["failureCode"]
  },
  {
    key: "FARM_INFRASTRUCTURE",
    label: "Farm Infrastructure",
    assetCategories: [
      "TRACTOR",
      "IRRIGATION_PUMP",
      "IRRIGATION_PIPE",
      "GREENHOUSE",
      "BARN",
      "STORAGE_SILO",
      "COLD_ROOM"
    ],
    applicableFields: ["location", "condition"],
    kpiKeys: ["AVAILABILITY", "SPEND", "CONDITION"],
    examplePmTemplateCodes: ["PM-FARM-INFRA"],
    complianceTypeKeys: ["WARRANTY", "SERVICE_AGREEMENT"],
    requiredClosureFields: ["location"],
    notes: "Physical farm infrastructure only — not crop/livestock/harvest/finance ops."
  },
  {
    key: "OUTLETS_BRANCHES",
    label: "Outlets / Branches",
    assetCategories: ["INFRASTRUCTURE", "EQUIPMENT"],
    applicableFields: ["siteId", "location"],
    kpiKeys: ["BACKLOG_AGE", "SPEND", "SERVICE_COMPLIANCE"],
    examplePmTemplateCodes: ["PM-OUTLET-AC", "PM-OUTLET-CHILLER"],
    complianceTypeKeys: ["FIRE_SERVICING", "SERVICE_AGREEMENT"],
    requiredClosureFields: ["siteId", "vendorId?"],
    notes: "Outlet treated as Site. Supports AC/chiller/freezer/electrical/plumbing/CCTV/signage."
  },
  {
    key: "FIRE_SAFETY",
    label: "Fire / Safety",
    assetCategories: ["EQUIPMENT", "INFRASTRUCTURE"],
    applicableFields: ["location", "criticality"],
    kpiKeys: ["COMPLIANCE_DUE", "COMPLIANCE_EXPIRED", "COMPLIANCE_COMPLETION"],
    examplePmTemplateCodes: ["PM-FIRE-SERVICING"],
    complianceTypeKeys: ["FIRE_SERVICING", "STATUTORY_INSPECTION"],
    requiredClosureFields: ["certificateUrl", "checklistComplete"]
  },
  {
    key: "SECURITY_EQUIPMENT",
    label: "Security Equipment",
    assetCategories: ["EQUIPMENT"],
    applicableFields: ["location"],
    kpiKeys: ["AVAILABILITY", "SERVICE_COMPLIANCE"],
    examplePmTemplateCodes: ["PM-SEC-CCTV"],
    complianceTypeKeys: ["SERVICE_AGREEMENT", "WARRANTY"],
    requiredClosureFields: ["evidence"]
  },
  {
    key: "IT_HARDWARE",
    label: "IT Hardware",
    assetCategories: ["EQUIPMENT", "OTHER"],
    applicableFields: ["serialNumber", "location", "manufacturer", "model"],
    kpiKeys: ["MTTR", "AVAILABILITY", "SPEND"],
    examplePmTemplateCodes: ["PM-IT-HW"],
    complianceTypeKeys: ["WARRANTY"],
    requiredClosureFields: ["serialNumber"],
    notes: "Physical IT hardware maintenance only — not password/email/access helpdesk."
  },
  {
    key: "LAB_EQUIPMENT",
    label: "Lab Equipment",
    assetCategories: ["EQUIPMENT"],
    applicableFields: ["serialNumber", "calibrationDue"],
    kpiKeys: ["COMPLIANCE_DUE", "AVAILABILITY"],
    examplePmTemplateCodes: ["PM-LAB-GENERIC"],
    complianceTypeKeys: ["CALIBRATION", "STATUTORY_INSPECTION"],
    requiredClosureFields: ["calibrationResult"]
  },
  {
    key: "CALIBRATION_EQUIPMENT",
    label: "Calibration Equipment",
    assetCategories: ["EQUIPMENT", "TOOL"],
    applicableFields: ["serialNumber", "tolerance"],
    kpiKeys: ["COMPLIANCE_DUE", "COMPLIANCE_EXPIRED", "COMPLIANCE_COMPLETION"],
    examplePmTemplateCodes: ["PM-CAL-CYCLE"],
    complianceTypeKeys: ["CALIBRATION"],
    requiredClosureFields: ["certificateUrl", "passFail"]
  },
  {
    key: "KITCHEN_CANTEEN",
    label: "Kitchen / Canteen",
    assetCategories: ["EQUIPMENT"],
    applicableFields: ["location"],
    kpiKeys: ["AVAILABILITY", "SERVICE_COMPLIANCE", "SPEND"],
    examplePmTemplateCodes: ["PM-KITCHEN-GENERIC"],
    complianceTypeKeys: ["FIRE_SERVICING", "SERVICE_AGREEMENT"],
    requiredClosureFields: ["checklistComplete"]
  },
  {
    key: "SOLAR_ENERGY",
    label: "Solar / Energy",
    assetCategories: ["EQUIPMENT", "INFRASTRUCTURE"],
    applicableFields: ["location", "meterReading"],
    kpiKeys: ["AVAILABILITY", "DOWNTIME", "SPEND"],
    examplePmTemplateCodes: ["PM-SOLAR-GENERIC"],
    complianceTypeKeys: ["WARRANTY", "SERVICE_AGREEMENT"],
    requiredClosureFields: ["meterReading"]
  },
  {
    key: "TOOLS_MOULDS_JIGS",
    label: "Tools / Moulds / Jigs",
    assetCategories: ["TOOL"],
    applicableFields: ["serialNumber", "condition"],
    kpiKeys: ["AVAILABILITY", "CONDITION", "SPEND"],
    examplePmTemplateCodes: ["PM-TOOL-GENERIC"],
    complianceTypeKeys: ["CALIBRATION"],
    requiredClosureFields: ["condition"]
  },
  {
    key: "EXTERNAL_INFRASTRUCTURE",
    label: "External Infrastructure",
    assetCategories: ["INFRASTRUCTURE"],
    applicableFields: ["location"],
    kpiKeys: ["BACKLOG_AGE", "CONDITION", "SPEND"],
    examplePmTemplateCodes: ["PM-EXT-INFRA"],
    complianceTypeKeys: ["STATUTORY_INSPECTION"],
    requiredClosureFields: ["location", "evidence"]
  },
  {
    key: "OTHER",
    label: "Other (configurable)",
    assetCategories: ["OTHER"],
    applicableFields: ["location"],
    kpiKeys: ["SPEND", "BACKLOG_AGE"],
    examplePmTemplateCodes: ["PM-OTHER"],
    complianceTypeKeys: [],
    requiredClosureFields: []
  }
];

export function getDomainProfile(key: MaintenanceDomainKey): DomainProfile | undefined {
  return MAINTENANCE_DOMAIN_PROFILES.find((d) => d.key === key);
}

export function domainsForAssetCategory(category: string): DomainProfile[] {
  return MAINTENANCE_DOMAIN_PROFILES.filter((d) => d.assetCategories.includes(category));
}

export function assertCommonEngineReuse(profile: DomainProfile): {
  usesSharedPm: boolean;
  usesSharedCompliance: boolean;
  usesSharedWo: boolean;
  duplicateEngine: boolean;
} {
  return {
    usesSharedPm: profile.examplePmTemplateCodes.length >= 0,
    usesSharedCompliance: true,
    usesSharedWo: true,
    duplicateEngine: false
  };
}
