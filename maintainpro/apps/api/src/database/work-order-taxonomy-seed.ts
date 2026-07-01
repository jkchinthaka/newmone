import { Priority } from "@prisma/client";

export type TaxonomySeedRules = {
  defaultPriority?: Priority;
  defaultSlaHours?: number;
  requiresAsset?: boolean;
  requiresVehicle?: boolean;
  requiresLocation?: boolean;
  requiresEvidence?: boolean;
  requiresSupervisorVerification?: boolean;
  requiresPartsReview?: boolean;
  requiresFinanceApproval?: boolean;
  gateOutBlockingRisk?: boolean;
  downtimeTrackingRequired?: boolean;
  allowedRoles?: string[];
};

export type TaxonomySeedIssue = {
  code: string;
  name: string;
  aliases?: string[];
  keywords?: string[];
  sinhalaKeywords?: string[];
  commonMistakes?: string[];
  rules?: TaxonomySeedRules;
};

export type TaxonomySeedType = {
  code: string;
  name: string;
  aliases?: string[];
  keywords?: string[];
  sinhalaKeywords?: string[];
  issues?: TaxonomySeedIssue[];
  rules?: TaxonomySeedRules;
};

export type TaxonomySeedCategory = {
  code: string;
  name: string;
  sortOrder: number;
  types: TaxonomySeedType[];
  rules?: TaxonomySeedRules;
};

const fleetVehicle: TaxonomySeedCategory = {
  code: "FLEET_VEHICLE",
  name: "Fleet / Vehicle",
  sortOrder: 1,
  types: [
    {
      code: "VEHICLE_SERVICE",
      name: "Vehicle Service",
      keywords: ["service", "oil change", "maintenance"]
    },
    {
      code: "BREAKDOWN_REPAIR",
      name: "Breakdown Repair",
      keywords: ["breakdown", "not starting", "engine failure"]
    },
    {
      code: "TYRE_REPLACEMENT",
      name: "Tyre Replacement",
      aliases: ["tire replacement", "tyre change", "tire change"],
      keywords: ["tyre", "tire", "wheel", "puncture"],
      sinhalaKeywords: ["ටයර්"],
      rules: { requiresVehicle: true, defaultPriority: Priority.HIGH }
    },
    {
      code: "BATTERY_REPLACEMENT",
      name: "Battery Replacement",
      keywords: ["battery", "dead battery"]
    },
    {
      code: "ACCIDENT_REPAIR",
      name: "Accident Repair",
      keywords: ["accident", "collision", "crash"],
      rules: { requiresVehicle: true, requiresEvidence: true, defaultPriority: Priority.CRITICAL }
    },
    {
      code: "INSURANCE_REPAIR",
      name: "Insurance Repair",
      keywords: ["insurance", "claim"]
    },
    {
      code: "VEHICLE_DOCUMENT_RENEWAL",
      name: "Vehicle Document Renewal",
      keywords: ["license", "registration", "document renewal"]
    },
    {
      code: "FUEL_SYSTEM_ISSUE",
      name: "Fuel System Issue",
      keywords: ["fuel", "petrol", "diesel", "leak"]
    },
    {
      code: "BRAKE_REPAIR",
      name: "Brake Repair",
      aliases: ["brake pad", "brake issue"],
      keywords: ["brake", "braking", "brake pad", "lorry brake"],
      sinhalaKeywords: ["බ්‍රේක්"],
      rules: {
        requiresVehicle: true,
        gateOutBlockingRisk: true,
        defaultPriority: Priority.CRITICAL,
        requiresEvidence: true
      },
      issues: [
        {
          code: "BRAKE_PAD_ISSUE",
          name: "Brake Pad Issue",
          keywords: ["brake pad", "pad worn"]
        }
      ]
    },
    {
      code: "AC_REPAIR",
      name: "AC Repair",
      keywords: ["ac", "air condition", "cooling"]
    },
    {
      code: "BODY_REPAIR",
      name: "Body Repair",
      keywords: ["dent", "body work", "panel"]
    },
    {
      code: "GATE_PASS_INSPECTION",
      name: "Gate Pass Inspection",
      keywords: ["gate pass", "vehicle inspection", "exit pass"]
    }
  ]
};

const buildingFacility: TaxonomySeedCategory = {
  code: "BUILDING_FACILITY",
  name: "Building / Facility",
  sortOrder: 2,
  types: [
    { code: "ELECTRICAL_REPAIR", name: "Electrical Repair", keywords: ["electrical", "power", "light", "socket"] },
    {
      code: "PLUMBING_REPAIR",
      name: "Plumbing Repair",
      keywords: ["plumbing", "water leak", "tap", "toilet", "pipe", "leak"],
      sinhalaKeywords: ["නළ"],
      rules: { requiresLocation: true, defaultPriority: Priority.HIGH }
    },
    { code: "ROOF_REPAIR", name: "Roof Repair", keywords: ["roof", "leak", "ceiling"] },
    { code: "DOOR_WINDOW_REPAIR", name: "Door/Window Repair", keywords: ["door", "window", "lock"] },
    { code: "PAINTING_WORK", name: "Painting Work", keywords: ["paint", "painting"] },
    { code: "AC_SERVICE", name: "Air Conditioner Service", keywords: ["ac service", "air conditioner"] },
    { code: "GENERATOR_MAINTENANCE", name: "Generator Maintenance", keywords: ["generator", "genset"] },
    { code: "CCTV_REPAIR", name: "CCTV Repair", keywords: ["cctv", "camera"] },
    { code: "FIRE_SAFETY_WORK", name: "Fire Safety Work", keywords: ["fire", "extinguisher", "alarm"] },
    { code: "PEST_CONTROL", name: "Pest Control", keywords: ["pest", "rats", "insects", "rodent"] },
    { code: "CIVIL_WORK", name: "Civil Work", keywords: ["civil", "masonry", "concrete"] },
    { code: "OFFICE_FURNITURE_REPAIR", name: "Office Furniture Repair", keywords: ["furniture", "chair", "desk"] }
  ]
};

const machineryEquipment: TaxonomySeedCategory = {
  code: "MACHINERY_EQUIPMENT",
  name: "Machinery / Equipment",
  sortOrder: 3,
  types: [
    { code: "MACHINE_BREAKDOWN", name: "Machine Breakdown", keywords: ["machine down", "breakdown"] },
    { code: "PREVENTIVE_MAINTENANCE", name: "Preventive Maintenance", keywords: ["pm", "preventive"] },
    { code: "CALIBRATION", name: "Calibration", keywords: ["calibration", "calibrate"] },
    { code: "MOTOR_REPAIR", name: "Motor Repair", keywords: ["motor", "engine"] },
    { code: "CONVEYOR_REPAIR", name: "Conveyor Repair", keywords: ["conveyor", "belt"] },
    { code: "COMPRESSOR_SERVICE", name: "Compressor Service", keywords: ["compressor", "air compressor"] },
    { code: "PUMP_REPAIR", name: "Pump Repair", keywords: ["pump", "water pump"] },
    { code: "WELDING_WORK", name: "Welding Work", keywords: ["welding", "weld"] },
    { code: "SPARE_PART_REPLACEMENT", name: "Spare Part Replacement", keywords: ["spare part", "replacement part"] },
    { code: "SAFETY_GUARD_REPAIR", name: "Safety Guard Repair", keywords: ["guard", "safety guard"] }
  ]
};

const itErpNetwork: TaxonomySeedCategory = {
  code: "IT_ERP_NETWORK",
  name: "IT / ERP / Network",
  sortOrder: 4,
  types: [
    { code: "COMPUTER_REPAIR", name: "Computer Repair", keywords: ["computer", "pc", "laptop"] },
    {
      code: "PRINTER_ISSUE",
      name: "Printer Issue",
      keywords: ["printer", "not printing", "print error"],
      rules: { defaultPriority: Priority.MEDIUM }
    },
    {
      code: "NETWORK_ISSUE",
      name: "Network Issue",
      aliases: ["wifi issue", "internet issue"],
      keywords: ["wifi", "internet", "network", "router", "lan", "connection"],
      issues: [
        {
          code: "ROUTER_WIFI_ISSUE",
          name: "Router / Wi-Fi Issue",
          keywords: ["wifi", "router", "wireless"]
        }
      ]
    },
    {
      code: "ERP_ISSUE",
      name: "ERP Issue",
      keywords: ["erp", "login", "sync", "bileeta", "software error"]
    },
    { code: "EMAIL_ISSUE", name: "Email Issue", keywords: ["email", "outlook", "mail"] },
    { code: "CCTV_NVR_ISSUE", name: "CCTV/NVR Issue", keywords: ["nvr", "dvr", "cctv server"] },
    { code: "USER_ACCOUNT_CREATION", name: "User Account Creation", keywords: ["account", "user creation", "access"] },
    { code: "SOFTWARE_INSTALLATION", name: "Software Installation", keywords: ["install", "software"] },
    { code: "DATA_BACKUP_REQUEST", name: "Data Backup Request", keywords: ["backup", "restore"] },
    { code: "DEVICE_HANDOVER", name: "Device Handover", keywords: ["handover", "device return"] }
  ]
};

const inventorySpareParts: TaxonomySeedCategory = {
  code: "INVENTORY_SPARE_PARTS",
  name: "Inventory / Spare Parts",
  sortOrder: 5,
  types: [
    { code: "SPARE_PART_REQUEST", name: "Spare Part Request", keywords: ["spare part request", "part request"] },
    { code: "STOCK_ISSUE_REQUEST", name: "Stock Issue Request", keywords: ["stock issue"] },
    { code: "EMERGENCY_PURCHASE_REQUEST", name: "Emergency Purchase Request", keywords: ["emergency purchase"] },
    { code: "RETURN_UNUSED_PARTS", name: "Return Unused Parts", keywords: ["return parts", "unused parts"] },
    { code: "DAMAGED_PART_RECORD", name: "Damaged Part Record", keywords: ["damaged part"] },
    { code: "TOOL_ISSUE_RETURN", name: "Tool Issue / Return", keywords: ["tool issue", "tool return"] }
  ]
};

const cleaningHousekeeping: TaxonomySeedCategory = {
  code: "CLEANING_HOUSEKEEPING",
  name: "Cleaning / Housekeeping",
  sortOrder: 6,
  types: [
    { code: "DAILY_CLEANING", name: "Daily Cleaning Task", keywords: ["daily cleaning"] },
    { code: "DEEP_CLEANING", name: "Deep Cleaning", keywords: ["deep clean"] },
    { code: "WASHROOM_CLEANING", name: "Washroom Cleaning", keywords: ["washroom", "toilet cleaning"] },
    { code: "WASTE_REMOVAL", name: "Waste Removal", keywords: ["waste", "garbage", "rubbish"] },
    { code: "DRAIN_CLEANING", name: "Drain Cleaning", keywords: ["drain"] },
    { code: "YARD_CLEANING", name: "Yard Cleaning", keywords: ["yard", "compound"] },
    { code: "DISINFECTION", name: "Disinfection Work", keywords: ["disinfect", "sanitiz"] },
    { code: "CLEANING_COMPLAINT", name: "Cleaning Complaint", keywords: ["cleaning complaint", "dirty"] }
  ]
};

const safetyCompliance: TaxonomySeedCategory = {
  code: "SAFETY_COMPLIANCE",
  name: "Safety / Compliance",
  sortOrder: 7,
  types: [
    { code: "FIRE_EXTINGUISHER_CHECK", name: "Fire Extinguisher Check", keywords: ["fire extinguisher"] },
    { code: "SAFETY_SIGNAGE_FIX", name: "Safety Signage Fix", keywords: ["signage", "sign board"] },
    { code: "PPE_ISSUE", name: "PPE Issue", keywords: ["ppe", "helmet", "gloves"] },
    { code: "ACCIDENT_CORRECTIVE", name: "Accident Corrective Action", keywords: ["accident corrective"] },
    { code: "AUDIT_FINDING_CORRECTION", name: "Audit Finding Correction", keywords: ["audit finding"] },
    { code: "HAZARD_REPORT", name: "Hazard Report", keywords: ["hazard", "unsafe"] },
    { code: "FOOD_SAFETY_CORRECTIVE", name: "Food Safety Corrective Work", keywords: ["food safety"] },
    { code: "SECURITY_RISK_FIX", name: "Security Risk Fix", keywords: ["security risk"] }
  ]
};

const securityGate: TaxonomySeedCategory = {
  code: "SECURITY_GATE",
  name: "Security / Gate",
  sortOrder: 8,
  types: [
    {
      code: "GATE_BARRIER_REPAIR",
      name: "Gate Barrier Repair",
      keywords: ["gate pass", "barrier", "boom gate", "gate barrier"]
    },
    { code: "ACCESS_CARD_ISSUE", name: "Access Card Issue", keywords: ["access card", "id card"] },
    { code: "CCTV_BLIND_SPOT", name: "CCTV Blind Spot Fix", keywords: ["blind spot", "cctv"] },
    { code: "VISITOR_PASS", name: "Visitor Pass Issue", keywords: ["visitor pass"] },
    { code: "VEHICLE_GATE_ISSUE", name: "Vehicle Gate Issue", keywords: ["vehicle gate", "gate out"] },
    { code: "LOCK_REPLACEMENT", name: "Lock Replacement", keywords: ["lock", "padlock"] },
    { code: "SECURITY_LIGHT_REPAIR", name: "Security Light Repair", keywords: ["security light", "flood light"] }
  ]
};

const utilities: TaxonomySeedCategory = {
  code: "UTILITIES",
  name: "Utilities",
  sortOrder: 9,
  types: [
    { code: "ELECTRICITY_FAILURE", name: "Electricity Failure", keywords: ["power cut", "electricity failure"] },
    { code: "WATER_SUPPLY_ISSUE", name: "Water Supply Issue", keywords: ["water supply", "no water"] },
    { code: "GENERATOR_RUN_ISSUE", name: "Generator Run Issue", keywords: ["generator run"] },
    { code: "SOLAR_MAINTENANCE", name: "Solar System Maintenance", keywords: ["solar"] },
    { code: "WATER_TANK_CLEANING", name: "Water Tank Cleaning", keywords: ["water tank"] },
    { code: "METER_READING", name: "Meter Reading Issue", keywords: ["meter reading"] },
    { code: "HIGH_CONSUMPTION", name: "High Consumption Investigation", keywords: ["high consumption", "utility bill"] }
  ]
};

const productionWarehouse: TaxonomySeedCategory = {
  code: "PRODUCTION_WAREHOUSE",
  name: "Production / Warehouse Support",
  sortOrder: 10,
  types: [
    { code: "PRODUCTION_LINE_SUPPORT", name: "Production Line Support", keywords: ["production line"] },
    { code: "PACKING_AREA_ISSUE", name: "Packing Area Issue", keywords: ["packing"] },
    { code: "COLD_ROOM_ISSUE", name: "Cold Room Issue", keywords: ["cold room"] },
    { code: "LOADING_BAY_REPAIR", name: "Loading Bay Repair", keywords: ["loading bay"] },
    { code: "PALLET_JACK_REPAIR", name: "Pallet Jack Repair", keywords: ["pallet jack"] },
    { code: "WAREHOUSE_RACK_REPAIR", name: "Warehouse Rack Repair", keywords: ["rack", "shelving"] },
    {
      code: "TEMPERATURE_MONITORING",
      name: "Temperature Monitoring Issue",
      keywords: ["temperature high", "temp sensor", "monitoring"]
    }
  ]
};

const vendorExternal: TaxonomySeedCategory = {
  code: "VENDOR_EXTERNAL",
  name: "Vendor / External Repair",
  sortOrder: 11,
  types: [
    { code: "VENDOR_REPAIR_REQUEST", name: "Vendor Repair Request", keywords: ["vendor repair"] },
    { code: "QUOTATION_REQUEST", name: "Quotation Request", keywords: ["quotation", "quote"] },
    { code: "INVOICE_REVIEW", name: "Invoice Review", keywords: ["invoice review"] },
    { code: "EXTERNAL_GARAGE_REPAIR", name: "External Garage Repair", keywords: ["external garage", "third party repair"] }
  ]
};

const calibrationLab: TaxonomySeedCategory = {
  code: "CALIBRATION_LAB",
  name: "Calibration / Lab Equipment",
  sortOrder: 12,
  types: [
    { code: "SCALE_CALIBRATION", name: "Scale Calibration", keywords: ["scale", "weighing"] },
    { code: "LAB_DEVICE_REPAIR", name: "Lab Device Repair", keywords: ["lab device"] },
    { code: "CERTIFICATE_RENEWAL", name: "Certificate Renewal", keywords: ["certificate renewal"] },
    { code: "MEASUREMENT_ERROR", name: "Measurement Error", keywords: ["measurement error"] }
  ]
};

const coldChain: TaxonomySeedCategory = {
  code: "COLD_CHAIN",
  name: "Cold Chain / Refrigeration",
  sortOrder: 13,
  types: [
    {
      code: "COLD_ROOM_BREAKDOWN",
      name: "Cold Room Breakdown",
      keywords: ["cold room", "freezer", "temperature high", "refrigeration"],
      rules: { defaultPriority: Priority.HIGH, requiresEvidence: true, downtimeTrackingRequired: true }
    },
    { code: "FREEZER_ISSUE", name: "Freezer Issue", keywords: ["freezer", "deep freeze"] },
    { code: "TEMP_SENSOR_ISSUE", name: "Temperature Sensor Issue", keywords: ["temperature sensor", "sensor fault"] },
    { code: "REFRIGERATION_GAS_LEAK", name: "Refrigeration Gas Leak", keywords: ["gas leak", "refrigerant"] }
  ]
};

const farmBiosecurity: TaxonomySeedCategory = {
  code: "FARM_BIOSECURITY",
  name: "Farm / Biosecurity",
  sortOrder: 14,
  types: [
    { code: "DISINFECTION_POINT", name: "Disinfection Point Issue", keywords: ["disinfection point"] },
    { code: "FARM_EQUIPMENT_REPAIR", name: "Farm Equipment Repair", keywords: ["farm equipment"] },
    { code: "BIOSECURITY_GATE", name: "Biosecurity Gate Issue", keywords: ["biosecurity gate"] },
    { code: "FOOTBATH_WHEELBATH", name: "Footbath / Wheelbath Issue", keywords: ["footbath", "wheelbath"] }
  ]
};

const wasteEnvironmental: TaxonomySeedCategory = {
  code: "WASTE_ENVIRONMENTAL",
  name: "Waste / Environmental",
  sortOrder: 15,
  types: [
    { code: "WASTE_REMOVAL_ENV", name: "Waste Removal", keywords: ["waste removal environmental"] },
    { code: "DRAINAGE_ISSUE", name: "Drainage Issue", keywords: ["drainage", "storm drain"] },
    { code: "ENV_COMPLIANCE", name: "Environmental Compliance Issue", keywords: ["environmental compliance"] },
    { code: "ODOR_WASTEWATER", name: "Odor / Wastewater Complaint", keywords: ["odor", "wastewater", "smell"] }
  ]
};

const adminOffice: TaxonomySeedCategory = {
  code: "ADMIN_OFFICE",
  name: "Admin / Office Support",
  sortOrder: 16,
  types: [
    { code: "OFFICE_SUPPORT", name: "Office Support Request", keywords: ["office support"] },
    { code: "STATIONERY_REQUEST", name: "Stationery Request", keywords: ["stationery"] }
  ]
};

const projectModification: TaxonomySeedCategory = {
  code: "PROJECT_MODIFICATION",
  name: "Project / Modification Work",
  sortOrder: 17,
  types: [
    { code: "CAPEX_PROJECT", name: "Capex Project Work", keywords: ["capex", "project work"] },
    { code: "MODIFICATION_REQUEST", name: "Modification Request", keywords: ["modification", "retrofit"] }
  ]
};

const qualityFoodSafety: TaxonomySeedCategory = {
  code: "QUALITY_FOOD_SAFETY",
  name: "Quality / Food Safety Corrective Action",
  sortOrder: 18,
  types: [
    { code: "HYGIENE_CORRECTIVE", name: "Hygiene Corrective Action", keywords: ["hygiene corrective"] },
    { code: "AUDIT_FINDING_QA", name: "Audit Finding Correction", keywords: ["qa audit finding"] },
    { code: "CONTAMINATION_RISK", name: "Contamination Risk Fix", keywords: ["contamination"] },
    { code: "FOOD_SAFETY_EQUIPMENT", name: "Food Safety Equipment Issue", keywords: ["food safety equipment"] }
  ]
};

export const TRIAGE_CATEGORY_CODE = "NOT_SURE_TRIAGE";

export const NOT_SURE_TRIAGE_CATEGORY: TaxonomySeedCategory = {
  code: TRIAGE_CATEGORY_CODE,
  name: "Not Sure / Triage",
  sortOrder: 19,
  types: [
    {
      code: "NEED_TRIAGE",
      name: "Need Triage Classification",
      keywords: ["not sure", "triage", "unknown category"],
      rules: { defaultPriority: Priority.MEDIUM }
    }
  ]
};

export const OTHER_CATEGORY: TaxonomySeedCategory = {
  code: "OTHER",
  name: "Other",
  sortOrder: 20,
  types: [{ code: "GENERAL_OTHER", name: "General / Other", keywords: ["other", "misc"] }]
};

export const WORK_ORDER_TAXONOMY_SEED: TaxonomySeedCategory[] = [
  fleetVehicle,
  buildingFacility,
  machineryEquipment,
  itErpNetwork,
  inventorySpareParts,
  cleaningHousekeeping,
  safetyCompliance,
  securityGate,
  utilities,
  productionWarehouse,
  vendorExternal,
  calibrationLab,
  coldChain,
  farmBiosecurity,
  wasteEnvironmental,
  adminOffice,
  projectModification,
  qualityFoodSafety,
  NOT_SURE_TRIAGE_CATEGORY,
  OTHER_CATEGORY
];
