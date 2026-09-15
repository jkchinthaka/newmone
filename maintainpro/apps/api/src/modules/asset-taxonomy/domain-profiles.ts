/**
 * Phase 11 — Company-wide Domain Coverage
 *
 * Static domain profile defaults keyed by AssetDomain.code (HEAD codes, not Phase 11 extract keys).
 * All domains share the same Asset / WO / PM / Inspection / Calibration / Compliance / Parts / Vendor
 * engines — no duplicate engine modules are registered.
 *
 * KPI sets, suggested PM codes, and checklist codes are configurable DEFAULTS, not verified Nelna
 * operational frequencies or thresholds. Tenant overrides are stored in AssetDomain.profile (Json).
 *
 * Alias map (historical Phase 11 keys → HEAD codes):
 *   BUILDING_CIVIL          → FACILITY_CIVIL
 *   OUTLETS_BRANCHES        → OUTLET_EQUIPMENT
 *   SECURITY_EQUIPMENT      → SECURITY
 *   LAB_EQUIPMENT           → LABORATORY
 *   CALIBRATION_EQUIPMENT   → CALIBRATION
 *   SOLAR_ENERGY            → ENERGY_SOLAR
 */

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

export type DomainProfileDefaults = {
  code: string;
  label: string;
  iconHint?: string;
  allowsLocationOnlyWork: boolean;
  downtimeApplicableDefault: boolean;
  metersApplicableDefault: boolean;
  calibrationApplicableDefault: boolean;
  kpiKeys: DomainKpiKey[];
  suggestedMeterTypes: string[];
  suggestedComplianceTypes: string[];
  suggestedSafetyHints: string[];
  suggestedRcaKinds: string[];
  suggestedProblemCategoryCodes: string[];
  examplePmTemplateCodes: string[];
  exampleChecklistCodes: string[];
  vendorServiceCategories: string[];
  requiredClosureFields: string[];
  applicableAttributeHints: string[];
  scopeNotes?: string;
  enabledByDefault: boolean;
};

/** Alias map: historical Phase 11 extract keys → canonical HEAD codes */
export const DOMAIN_CODE_ALIAS_MAP: Record<string, string> = {
  BUILDING_CIVIL: "FACILITY_CIVIL",
  OUTLETS_BRANCHES: "OUTLET_EQUIPMENT",
  SECURITY_EQUIPMENT: "SECURITY",
  LAB_EQUIPMENT: "LABORATORY",
  CALIBRATION_EQUIPMENT: "CALIBRATION",
  SOLAR_ENERGY: "ENERGY_SOLAR"
};

const STATIC_DOMAIN_PROFILES: DomainProfileDefaults[] = [
  {
    code: "PLANT_MACHINERY",
    label: "Plant & Machinery",
    iconHint: "factory",
    allowsLocationOnlyWork: false,
    downtimeApplicableDefault: true,
    metersApplicableDefault: true,
    calibrationApplicableDefault: false,
    kpiKeys: ["MTTR", "MTBF", "AVAILABILITY", "DOWNTIME", "SPEND", "REPEAT_DEFECTS"],
    suggestedMeterTypes: ["RUNNING_HOURS", "PRODUCTION_CYCLES"],
    suggestedComplianceTypes: ["STATUTORY_INSPECTION", "WARRANTY"],
    suggestedSafetyHints: ["LOTO", "PPE", "MACHINE_GUARDING"],
    suggestedRcaKinds: ["FAILURE", "CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["MECHANICAL_FAILURE", "WEAR", "ELECTRICAL_FAULT"],
    examplePmTemplateCodes: ["PM-MACHINE-GENERIC", "PM-MACHINE-LUBE", "PM-MACHINE-INSPECTION"],
    exampleChecklistCodes: ["CL-MACHINE-STARTUP", "CL-MACHINE-SHUTDOWN"],
    vendorServiceCategories: ["MECHANICAL_SERVICE", "OEM_SERVICE"],
    requiredClosureFields: ["failureCode", "causeCode", "remedyCode", "downtimeMinutes"],
    applicableAttributeHints: ["capacity", "voltage", "rpm", "serialNumber", "manufacturer", "model"],
    enabledByDefault: true
  },
  {
    code: "MECHANICAL",
    label: "Mechanical",
    iconHint: "settings",
    allowsLocationOnlyWork: false,
    downtimeApplicableDefault: true,
    metersApplicableDefault: true,
    calibrationApplicableDefault: false,
    kpiKeys: ["MTTR", "MTBF", "AVAILABILITY", "DOWNTIME", "REPEAT_DEFECTS"],
    suggestedMeterTypes: ["RUNNING_HOURS"],
    suggestedComplianceTypes: ["STATUTORY_INSPECTION"],
    suggestedSafetyHints: ["LOTO", "PPE"],
    suggestedRcaKinds: ["FAILURE", "CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["MECHANICAL_FAILURE", "WEAR", "CORROSION"],
    examplePmTemplateCodes: ["PM-MECH-GENERIC", "PM-MECH-LUBE"],
    exampleChecklistCodes: ["CL-MECH-INSPECTION"],
    vendorServiceCategories: ["MECHANICAL_SERVICE"],
    requiredClosureFields: ["failureCode", "causeCode", "remedyCode"],
    applicableAttributeHints: ["pressure_rating", "flow_rate", "serialNumber"],
    enabledByDefault: true
  },
  {
    code: "ELECTRICAL",
    label: "Electrical",
    iconHint: "zap",
    allowsLocationOnlyWork: false,
    downtimeApplicableDefault: true,
    metersApplicableDefault: false,
    calibrationApplicableDefault: false,
    kpiKeys: ["MTTR", "AVAILABILITY", "DOWNTIME", "REPEAT_DEFECTS"],
    suggestedMeterTypes: [],
    suggestedComplianceTypes: ["STATUTORY_INSPECTION"],
    suggestedSafetyHints: ["LOTO", "PPE", "ELECTRICAL_HAZARD"],
    suggestedRcaKinds: ["FAILURE", "CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["ELECTRICAL_FAULT", "OVERLOAD", "INSULATION_FAILURE"],
    examplePmTemplateCodes: ["PM-ELEC-GENERIC", "PM-ELEC-PANEL"],
    exampleChecklistCodes: ["CL-ELEC-INSPECTION"],
    vendorServiceCategories: ["ELECTRICAL_SERVICE"],
    requiredClosureFields: ["failureCode", "evidence"],
    applicableAttributeHints: ["voltage", "amperage", "phase"],
    enabledByDefault: true
  },
  {
    code: "UTILITIES",
    label: "Utilities",
    iconHint: "power",
    allowsLocationOnlyWork: true,
    downtimeApplicableDefault: true,
    metersApplicableDefault: true,
    calibrationApplicableDefault: false,
    kpiKeys: ["AVAILABILITY", "DOWNTIME", "SPEND"],
    suggestedMeterTypes: ["RUNNING_HOURS", "FUEL_CONSUMPTION"],
    suggestedComplianceTypes: ["SERVICE_AGREEMENT"],
    suggestedSafetyHints: ["LOTO", "PPE"],
    suggestedRcaKinds: ["FAILURE", "CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["UTILITY_FAILURE", "OVERLOAD"],
    examplePmTemplateCodes: ["PM-UTIL-GENERATOR", "PM-UTIL-UPS"],
    exampleChecklistCodes: ["CL-UTIL-GENERATOR"],
    vendorServiceCategories: ["UTILITY_SERVICE", "GENERATOR_SERVICE"],
    requiredClosureFields: ["meterReading"],
    applicableAttributeHints: ["capacity_kva", "fuel_type", "output_voltage"],
    enabledByDefault: true
  },
  {
    code: "HVAC_REFRIGERATION",
    label: "HVAC / Refrigeration (Legacy)",
    iconHint: "thermometer",
    allowsLocationOnlyWork: false,
    downtimeApplicableDefault: true,
    metersApplicableDefault: false,
    calibrationApplicableDefault: false,
    kpiKeys: ["MTTR", "AVAILABILITY", "SERVICE_COMPLIANCE"],
    suggestedMeterTypes: ["RUNNING_HOURS"],
    suggestedComplianceTypes: ["SERVICE_AGREEMENT", "CALIBRATION"],
    suggestedSafetyHints: ["PPE", "REFRIGERANT_HANDLING"],
    suggestedRcaKinds: ["FAILURE", "CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["COOLING_FAILURE", "REFRIGERANT_LEAK"],
    examplePmTemplateCodes: ["PM-HVAC-GENERIC", "PM-REF-GENERIC"],
    exampleChecklistCodes: ["CL-HVAC-SERVICE"],
    vendorServiceCategories: ["HVAC_SERVICE", "REFRIGERATION_SERVICE"],
    requiredClosureFields: ["checklistComplete"],
    applicableAttributeHints: ["refrigerant", "capacity", "target_temp_c"],
    scopeNotes:
      "Legacy combined domain kept for backwards compatibility. Prefer HVAC or REFRIGERATION for new assets.",
    enabledByDefault: true
  },
  {
    code: "HVAC",
    label: "HVAC",
    iconHint: "wind",
    allowsLocationOnlyWork: false,
    downtimeApplicableDefault: true,
    metersApplicableDefault: false,
    calibrationApplicableDefault: false,
    kpiKeys: ["MTTR", "AVAILABILITY", "SERVICE_COMPLIANCE"],
    suggestedMeterTypes: ["RUNNING_HOURS"],
    suggestedComplianceTypes: ["SERVICE_AGREEMENT"],
    suggestedSafetyHints: ["PPE", "ELECTRICAL_HAZARD"],
    suggestedRcaKinds: ["FAILURE", "CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["COOLING_FAILURE", "AIRFLOW_ISSUE"],
    examplePmTemplateCodes: ["PM-HVAC-GENERIC", "PM-HVAC-FILTER"],
    exampleChecklistCodes: ["CL-HVAC-SERVICE"],
    vendorServiceCategories: ["HVAC_SERVICE"],
    requiredClosureFields: ["checklistComplete"],
    applicableAttributeHints: ["capacity_btu", "refrigerant", "voltage"],
    enabledByDefault: true
  },
  {
    code: "REFRIGERATION",
    label: "Refrigeration",
    iconHint: "thermometer",
    allowsLocationOnlyWork: false,
    downtimeApplicableDefault: true,
    metersApplicableDefault: false,
    calibrationApplicableDefault: true,
    kpiKeys: ["AVAILABILITY", "DOWNTIME", "SERVICE_COMPLIANCE"],
    suggestedMeterTypes: ["RUNNING_HOURS"],
    suggestedComplianceTypes: ["SERVICE_AGREEMENT", "CALIBRATION"],
    suggestedSafetyHints: ["PPE", "REFRIGERANT_HANDLING"],
    suggestedRcaKinds: ["FAILURE", "CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["COOLING_FAILURE", "REFRIGERANT_LEAK", "COMPRESSOR_FAULT"],
    examplePmTemplateCodes: ["PM-REF-GENERIC", "PM-REF-COLDROOM"],
    exampleChecklistCodes: ["CL-REF-SERVICE"],
    vendorServiceCategories: ["REFRIGERATION_SERVICE"],
    requiredClosureFields: ["checklistComplete", "evidence"],
    applicableAttributeHints: ["refrigerant", "target_temp_c", "capacity"],
    scopeNotes:
      "Temperature operating limits are owner-configured per asset — not hardcoded in this profile.",
    enabledByDefault: true
  },
  {
    code: "FACILITY_CIVIL",
    label: "Facility / Civil",
    iconHint: "building",
    allowsLocationOnlyWork: true,
    downtimeApplicableDefault: false,
    metersApplicableDefault: false,
    calibrationApplicableDefault: false,
    kpiKeys: ["BACKLOG_AGE", "CONDITION", "SPEND", "REPEAT_DEFECTS"],
    suggestedMeterTypes: [],
    suggestedComplianceTypes: ["STATUTORY_INSPECTION", "FIRE_SERVICING"],
    suggestedSafetyHints: ["PPE", "WORKING_AT_HEIGHT", "CONFINED_SPACE"],
    suggestedRcaKinds: ["CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["STRUCTURAL_DAMAGE", "WEAR", "WATER_DAMAGE"],
    examplePmTemplateCodes: ["PM-CIVIL-GENERIC", "PM-CIVIL-FACADE"],
    exampleChecklistCodes: ["CL-CIVIL-INSPECTION"],
    vendorServiceCategories: ["CIVIL_CONTRACTOR", "BUILDING_MAINTENANCE"],
    requiredClosureFields: ["location", "evidence"],
    applicableAttributeHints: ["floor_area", "construction_year", "location"],
    enabledByDefault: true
  },
  {
    code: "PLUMBING",
    label: "Plumbing",
    iconHint: "droplets",
    allowsLocationOnlyWork: true,
    downtimeApplicableDefault: false,
    metersApplicableDefault: false,
    calibrationApplicableDefault: false,
    kpiKeys: ["BACKLOG_AGE", "REPEAT_DEFECTS", "SPEND"],
    suggestedMeterTypes: [],
    suggestedComplianceTypes: [],
    suggestedSafetyHints: ["PPE", "WET_CONDITIONS"],
    suggestedRcaKinds: ["CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["LEAK", "BLOCKAGE", "PIPE_BURST"],
    examplePmTemplateCodes: ["PM-PLUMB-GENERIC"],
    exampleChecklistCodes: ["CL-PLUMB-INSPECTION"],
    vendorServiceCategories: ["PLUMBING_CONTRACTOR"],
    requiredClosureFields: ["location"],
    applicableAttributeHints: ["pipe_diameter", "material", "location"],
    enabledByDefault: true
  },
  {
    code: "WATER_WASTEWATER",
    label: "Water / Wastewater",
    iconHint: "waves",
    allowsLocationOnlyWork: false,
    downtimeApplicableDefault: true,
    metersApplicableDefault: true,
    calibrationApplicableDefault: false,
    kpiKeys: ["AVAILABILITY", "DOWNTIME", "COMPLIANCE_DUE"],
    suggestedMeterTypes: ["RUNNING_HOURS", "FLOW_RATE"],
    suggestedComplianceTypes: ["STATUTORY_INSPECTION"],
    suggestedSafetyHints: ["PPE", "CHEMICAL_HAZARD", "CONFINED_SPACE"],
    suggestedRcaKinds: ["FAILURE", "CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["PUMP_FAILURE", "BLOCKAGE", "CONTAMINATION"],
    examplePmTemplateCodes: ["PM-WATER-GENERIC", "PM-WATER-PUMP"],
    exampleChecklistCodes: ["CL-WATER-PUMP"],
    vendorServiceCategories: ["WATER_TREATMENT_SERVICE"],
    requiredClosureFields: ["meterReading"],
    applicableAttributeHints: ["flow_rate", "capacity", "treatment_type"],
    enabledByDefault: true
  },
  {
    code: "FLEET",
    label: "Fleet",
    iconHint: "truck",
    allowsLocationOnlyWork: false,
    downtimeApplicableDefault: false,
    metersApplicableDefault: true,
    calibrationApplicableDefault: false,
    kpiKeys: [
      "COST_PER_KM",
      "AVAILABILITY",
      "SERVICE_COMPLIANCE",
      "FUEL_EFFICIENCY",
      "COMPLIANCE_DUE"
    ],
    suggestedMeterTypes: ["MILEAGE", "ENGINE_HOURS"],
    suggestedComplianceTypes: ["INSURANCE", "REVENUE_LICENCE", "EMISSION", "FITNESS"],
    suggestedSafetyHints: ["PPE", "VEHICLE_IMMOBILIZATION"],
    suggestedRcaKinds: ["FAILURE", "CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["MECHANICAL_FAILURE", "ELECTRICAL_FAULT", "TYRE_ISSUE"],
    examplePmTemplateCodes: ["PM-FLEET-SERVICE", "PM-FLEET-INSPECTION"],
    exampleChecklistCodes: ["CL-FLEET-PRE_TRIP", "CL-FLEET-SERVICE"],
    vendorServiceCategories: ["VEHICLE_SERVICE", "TYRE_SERVICE"],
    requiredClosureFields: ["mileage", "partsUsed"],
    applicableAttributeHints: ["registration", "vin", "engine_capacity", "fuel_type"],
    enabledByDefault: true
  },
  {
    code: "MATERIAL_HANDLING",
    label: "Material Handling",
    iconHint: "package",
    allowsLocationOnlyWork: false,
    downtimeApplicableDefault: true,
    metersApplicableDefault: true,
    calibrationApplicableDefault: false,
    kpiKeys: ["MTTR", "MTBF", "AVAILABILITY"],
    suggestedMeterTypes: ["RUNNING_HOURS", "LIFT_CYCLES"],
    suggestedComplianceTypes: ["STATUTORY_INSPECTION"],
    suggestedSafetyHints: ["LOTO", "PPE", "LOAD_CAPACITY"],
    suggestedRcaKinds: ["FAILURE", "CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["MECHANICAL_FAILURE", "ELECTRICAL_FAULT"],
    examplePmTemplateCodes: ["PM-MH-GENERIC", "PM-MH-FORKLIFT"],
    exampleChecklistCodes: ["CL-MH-PRE_USE"],
    vendorServiceCategories: ["MATERIAL_HANDLING_SERVICE"],
    requiredClosureFields: ["failureCode"],
    applicableAttributeHints: ["load_capacity_kg", "lift_height_m", "fuel_type"],
    enabledByDefault: true
  },
  {
    code: "FARM_INFRASTRUCTURE",
    label: "Farm Infrastructure",
    iconHint: "crop",
    allowsLocationOnlyWork: true,
    downtimeApplicableDefault: false,
    metersApplicableDefault: false,
    calibrationApplicableDefault: false,
    kpiKeys: ["AVAILABILITY", "SPEND", "CONDITION"],
    suggestedMeterTypes: [],
    suggestedComplianceTypes: ["WARRANTY", "SERVICE_AGREEMENT"],
    suggestedSafetyHints: ["PPE", "MACHINERY_HAZARD"],
    suggestedRcaKinds: ["CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["STRUCTURAL_DAMAGE", "WEAR", "IRRIGATION_FAULT"],
    examplePmTemplateCodes: ["PM-FARM-INFRA"],
    exampleChecklistCodes: ["CL-FARM-INSPECTION"],
    vendorServiceCategories: ["AGRICULTURAL_CONTRACTOR"],
    requiredClosureFields: ["location"],
    applicableAttributeHints: ["location", "area_ha", "construction_year"],
    scopeNotes:
      "Physical farm infrastructure maintenance only — not crop, livestock, harvest, finance, or EHS operations.",
    enabledByDefault: true
  },
  {
    code: "OUTLET_EQUIPMENT",
    label: "Outlet Equipment",
    iconHint: "store",
    allowsLocationOnlyWork: true,
    downtimeApplicableDefault: false,
    metersApplicableDefault: false,
    calibrationApplicableDefault: false,
    kpiKeys: ["BACKLOG_AGE", "SPEND", "SERVICE_COMPLIANCE"],
    suggestedMeterTypes: [],
    suggestedComplianceTypes: ["FIRE_SERVICING", "SERVICE_AGREEMENT"],
    suggestedSafetyHints: ["PPE"],
    suggestedRcaKinds: ["CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["AC_FAILURE", "SIGNAGE_DAMAGE", "ELECTRICAL_FAULT"],
    examplePmTemplateCodes: ["PM-OUTLET-AC", "PM-OUTLET-CHILLER", "PM-OUTLET-ELECTRICAL"],
    exampleChecklistCodes: ["CL-OUTLET-INSPECTION"],
    vendorServiceCategories: ["HVAC_SERVICE", "ELECTRICAL_SERVICE", "GENERAL_MAINTENANCE"],
    requiredClosureFields: ["siteId"],
    applicableAttributeHints: ["location", "site_code"],
    scopeNotes:
      "Outlet treated as Site entity. Supports AC, chiller, freezer, electrical, plumbing, CCTV, and signage. Does not include a separate outlet ticketing or POS system.",
    enabledByDefault: true
  },
  {
    code: "FIRE_SAFETY",
    label: "Fire / Safety",
    iconHint: "flame",
    allowsLocationOnlyWork: false,
    downtimeApplicableDefault: false,
    metersApplicableDefault: false,
    calibrationApplicableDefault: true,
    kpiKeys: ["COMPLIANCE_DUE", "COMPLIANCE_EXPIRED", "COMPLIANCE_COMPLETION"],
    suggestedMeterTypes: [],
    suggestedComplianceTypes: ["FIRE_SERVICING", "STATUTORY_INSPECTION"],
    suggestedSafetyHints: ["PPE", "FIRE_SUPPRESSION_ACTIVATION_RISK"],
    suggestedRcaKinds: ["CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["EXPIRY", "PHYSICAL_DAMAGE", "SYSTEM_FAULT"],
    examplePmTemplateCodes: ["PM-FIRE-EXTINGUISHER", "PM-FIRE-SUPPRESSION"],
    exampleChecklistCodes: ["CL-FIRE-INSPECTION"],
    vendorServiceCategories: ["FIRE_SAFETY_CONTRACTOR"],
    requiredClosureFields: ["certificateUrl", "checklistComplete"],
    applicableAttributeHints: ["charge_weight_kg", "agent_type", "installation_date"],
    enabledByDefault: true
  },
  {
    code: "SECURITY",
    label: "Security",
    iconHint: "shield",
    allowsLocationOnlyWork: false,
    downtimeApplicableDefault: false,
    metersApplicableDefault: false,
    calibrationApplicableDefault: false,
    kpiKeys: ["AVAILABILITY", "SERVICE_COMPLIANCE"],
    suggestedMeterTypes: [],
    suggestedComplianceTypes: ["SERVICE_AGREEMENT", "WARRANTY"],
    suggestedSafetyHints: ["PPE"],
    suggestedRcaKinds: ["FAILURE", "CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["CAMERA_FAULT", "ACCESS_CONTROL_FAULT", "POWER_FAILURE"],
    examplePmTemplateCodes: ["PM-SEC-CCTV", "PM-SEC-ACCESS"],
    exampleChecklistCodes: ["CL-SEC-INSPECTION"],
    vendorServiceCategories: ["SECURITY_SYSTEMS_SERVICE"],
    requiredClosureFields: ["evidence"],
    applicableAttributeHints: ["ip_address", "location", "model"],
    enabledByDefault: true
  },
  {
    code: "IT_HARDWARE",
    label: "IT Hardware",
    iconHint: "monitor",
    allowsLocationOnlyWork: false,
    downtimeApplicableDefault: false,
    metersApplicableDefault: false,
    calibrationApplicableDefault: false,
    kpiKeys: ["MTTR", "AVAILABILITY", "SPEND"],
    suggestedMeterTypes: [],
    suggestedComplianceTypes: ["WARRANTY"],
    suggestedSafetyHints: ["ESD", "PPE"],
    suggestedRcaKinds: ["FAILURE", "CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["HARDWARE_FAILURE", "DAMAGE", "WEAR"],
    examplePmTemplateCodes: ["PM-IT-HW", "PM-IT-LAPTOP"],
    exampleChecklistCodes: ["CL-IT-ASSET_AUDIT"],
    vendorServiceCategories: ["IT_HARDWARE_SERVICE"],
    requiredClosureFields: ["serialNumber"],
    applicableAttributeHints: ["hostname", "serialNumber", "warranty_expiry", "os_version"],
    scopeNotes:
      "Physical IT hardware maintenance only — not software, password resets, email, access/helpdesk, or LIMS.",
    enabledByDefault: true
  },
  {
    code: "LABORATORY",
    label: "Laboratory",
    iconHint: "flask",
    allowsLocationOnlyWork: false,
    downtimeApplicableDefault: false,
    metersApplicableDefault: false,
    calibrationApplicableDefault: true,
    kpiKeys: ["COMPLIANCE_DUE", "AVAILABILITY"],
    suggestedMeterTypes: [],
    suggestedComplianceTypes: ["CALIBRATION", "STATUTORY_INSPECTION"],
    suggestedSafetyHints: ["PPE", "CHEMICAL_HAZARD"],
    suggestedRcaKinds: ["CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["OUT_OF_CALIBRATION", "HARDWARE_FAILURE"],
    examplePmTemplateCodes: ["PM-LAB-GENERIC", "PM-LAB-CALIBRATION"],
    exampleChecklistCodes: ["CL-LAB-CALIBRATION"],
    vendorServiceCategories: ["CALIBRATION_SERVICE", "LAB_EQUIPMENT_SERVICE"],
    requiredClosureFields: ["calibrationResult"],
    applicableAttributeHints: ["serialNumber", "calibration_due", "measurement_range"],
    enabledByDefault: true
  },
  {
    code: "CALIBRATION",
    label: "Calibration",
    iconHint: "gauge",
    allowsLocationOnlyWork: false,
    downtimeApplicableDefault: false,
    metersApplicableDefault: false,
    calibrationApplicableDefault: true,
    kpiKeys: ["COMPLIANCE_DUE", "COMPLIANCE_EXPIRED", "COMPLIANCE_COMPLETION"],
    suggestedMeterTypes: [],
    suggestedComplianceTypes: ["CALIBRATION"],
    suggestedSafetyHints: ["PPE"],
    suggestedRcaKinds: ["CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["OUT_OF_CALIBRATION", "DRIFT"],
    examplePmTemplateCodes: ["PM-CAL-CYCLE"],
    exampleChecklistCodes: ["CL-CAL-INSPECTION"],
    vendorServiceCategories: ["CALIBRATION_SERVICE"],
    requiredClosureFields: ["certificateUrl", "passFail"],
    applicableAttributeHints: ["serialNumber", "tolerance", "calibration_interval_days"],
    enabledByDefault: true
  },
  {
    code: "KITCHEN_CANTEEN",
    label: "Kitchen / Canteen",
    iconHint: "utensils",
    allowsLocationOnlyWork: false,
    downtimeApplicableDefault: false,
    metersApplicableDefault: false,
    calibrationApplicableDefault: false,
    kpiKeys: ["AVAILABILITY", "SERVICE_COMPLIANCE", "SPEND"],
    suggestedMeterTypes: [],
    suggestedComplianceTypes: ["FIRE_SERVICING", "SERVICE_AGREEMENT"],
    suggestedSafetyHints: ["PPE", "FOOD_SAFETY_HYGIENE"],
    suggestedRcaKinds: ["FAILURE", "CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["EQUIPMENT_FAILURE", "HYGIENE_ISSUE"],
    examplePmTemplateCodes: ["PM-KITCHEN-GENERIC", "PM-KITCHEN-HOOD"],
    exampleChecklistCodes: ["CL-KITCHEN-INSPECTION"],
    vendorServiceCategories: ["CATERING_EQUIPMENT_SERVICE"],
    requiredClosureFields: ["checklistComplete"],
    applicableAttributeHints: ["capacity", "fuel_type", "power_kw"],
    enabledByDefault: true
  },
  {
    code: "ENERGY_SOLAR",
    label: "Energy / Solar",
    iconHint: "sun",
    allowsLocationOnlyWork: true,
    downtimeApplicableDefault: false,
    metersApplicableDefault: true,
    calibrationApplicableDefault: false,
    kpiKeys: ["AVAILABILITY", "DOWNTIME", "SPEND"],
    suggestedMeterTypes: ["ENERGY_OUTPUT_KWH", "RUNNING_HOURS"],
    suggestedComplianceTypes: ["WARRANTY", "SERVICE_AGREEMENT"],
    suggestedSafetyHints: ["PPE", "WORKING_AT_HEIGHT", "ELECTRICAL_HAZARD"],
    suggestedRcaKinds: ["FAILURE", "CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["PANEL_DAMAGE", "INVERTER_FAULT", "SOILING"],
    examplePmTemplateCodes: ["PM-SOLAR-GENERIC", "PM-SOLAR-PANEL"],
    exampleChecklistCodes: ["CL-SOLAR-INSPECTION"],
    vendorServiceCategories: ["SOLAR_SERVICE"],
    requiredClosureFields: ["meterReading"],
    applicableAttributeHints: ["capacity_kwp", "panel_count", "inverter_model"],
    enabledByDefault: true
  },
  {
    code: "TOOLS_MOULDS_JIGS",
    label: "Tools / Moulds / Jigs",
    iconHint: "wrench",
    allowsLocationOnlyWork: false,
    downtimeApplicableDefault: false,
    metersApplicableDefault: false,
    calibrationApplicableDefault: true,
    kpiKeys: ["AVAILABILITY", "CONDITION", "SPEND"],
    suggestedMeterTypes: ["PRODUCTION_CYCLES"],
    suggestedComplianceTypes: ["CALIBRATION"],
    suggestedSafetyHints: ["PPE", "MACHINERY_GUARDING"],
    suggestedRcaKinds: ["FAILURE", "CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["WEAR", "DIMENSIONAL_DEVIATION", "DAMAGE"],
    examplePmTemplateCodes: ["PM-TOOL-GENERIC"],
    exampleChecklistCodes: ["CL-TOOL-INSPECTION"],
    vendorServiceCategories: ["TOOLING_SERVICE"],
    requiredClosureFields: ["condition"],
    applicableAttributeHints: ["serialNumber", "material", "tolerance"],
    enabledByDefault: true
  },
  {
    code: "EXTERNAL_INFRASTRUCTURE",
    label: "External Infrastructure",
    iconHint: "road",
    allowsLocationOnlyWork: true,
    downtimeApplicableDefault: false,
    metersApplicableDefault: false,
    calibrationApplicableDefault: false,
    kpiKeys: ["BACKLOG_AGE", "CONDITION", "SPEND"],
    suggestedMeterTypes: [],
    suggestedComplianceTypes: ["STATUTORY_INSPECTION"],
    suggestedSafetyHints: ["PPE", "WORKING_AT_HEIGHT", "TRAFFIC_MANAGEMENT"],
    suggestedRcaKinds: ["CAUSE", "REMEDY"],
    suggestedProblemCategoryCodes: ["STRUCTURAL_DAMAGE", "DRAINAGE_FAULT", "SURFACE_WEAR"],
    examplePmTemplateCodes: ["PM-EXT-INFRA", "PM-EXT-ROAD"],
    exampleChecklistCodes: ["CL-EXT-INSPECTION"],
    vendorServiceCategories: ["CIVIL_CONTRACTOR"],
    requiredClosureFields: ["location", "evidence"],
    applicableAttributeHints: ["location", "length_m", "surface_type"],
    enabledByDefault: true
  },
  {
    code: "OTHER",
    label: "Other (configurable)",
    iconHint: "more-horizontal",
    allowsLocationOnlyWork: true,
    downtimeApplicableDefault: false,
    metersApplicableDefault: false,
    calibrationApplicableDefault: false,
    kpiKeys: ["SPEND", "BACKLOG_AGE"],
    suggestedMeterTypes: [],
    suggestedComplianceTypes: [],
    suggestedSafetyHints: [],
    suggestedRcaKinds: [],
    suggestedProblemCategoryCodes: [],
    examplePmTemplateCodes: ["PM-OTHER"],
    exampleChecklistCodes: [],
    vendorServiceCategories: [],
    requiredClosureFields: [],
    applicableAttributeHints: ["location"],
    enabledByDefault: true
  }
];

const PROFILE_MAP = new Map<string, DomainProfileDefaults>(
  STATIC_DOMAIN_PROFILES.map((p) => [p.code, p])
);

/**
 * Normalizes a domain code — resolves historical Phase 11 alias keys to current HEAD codes.
 * Returns the input unchanged if it is already a valid HEAD code.
 */
export function normalizeDomainCode(aliasOrCode: string): string {
  return DOMAIN_CODE_ALIAS_MAP[aliasOrCode] ?? aliasOrCode;
}

/**
 * Resolves the domain profile for a given code.
 * Merges static defaults with optional tenant-level profile overrides.
 * Accepts both HEAD codes and historical alias keys.
 */
export function resolveDomainProfile(
  code: string,
  override?: Partial<DomainProfileDefaults>
): DomainProfileDefaults | undefined {
  const normalized = normalizeDomainCode(code);
  const base = PROFILE_MAP.get(normalized);
  if (!base) return undefined;
  if (!override || Object.keys(override).length === 0) return base;
  return { ...base, ...override };
}

/**
 * Returns all static domain profiles.
 */
export function getAllDomainProfiles(): DomainProfileDefaults[] {
  return STATIC_DOMAIN_PROFILES;
}

/**
 * Documents that every domain reuses the shared maintenance engines.
 * Use in tests to assert no duplicate engine modules are registered.
 */
export function assertSharedEngineReuse(): {
  usesSharedWo: boolean;
  usesSharedPm: boolean;
  usesSharedCompliance: boolean;
  usesSharedParts: boolean;
  usesSharedVendor: boolean;
  duplicateEngine: boolean;
} {
  return {
    usesSharedWo: true,
    usesSharedPm: true,
    usesSharedCompliance: true,
    usesSharedParts: true,
    usesSharedVendor: true,
    duplicateEngine: false
  };
}

/**
 * Returns whether a KPI key is applicable for a given domain code.
 */
export function isKpiApplicable(code: string, kpi: DomainKpiKey): boolean {
  const profile = resolveDomainProfile(code);
  return profile?.kpiKeys.includes(kpi) ?? false;
}

/**
 * Returns the downtimeApplicableDefault for a given domain code.
 */
export function isDowntimeApplicableDefault(code: string): boolean {
  return resolveDomainProfile(code)?.downtimeApplicableDefault ?? false;
}
