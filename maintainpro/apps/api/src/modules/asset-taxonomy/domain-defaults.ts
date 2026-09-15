/**
 * Baseline tenant-scoped maintenance domains.
 * These are configurable business defaults — not separate software engines.
 * Do not invent Nelna plant/serial master data here.
 */

export const DEFAULT_ASSET_DOMAINS = [
  { code: "PLANT_MACHINERY", name: "Plant & Machinery", sortOrder: 10 },
  { code: "MECHANICAL", name: "Mechanical", sortOrder: 20 },
  { code: "ELECTRICAL", name: "Electrical", sortOrder: 30 },
  { code: "UTILITIES", name: "Utilities", sortOrder: 40 },
  // HVAC_REFRIGERATION kept as legacy combined domain; HVAC + REFRIGERATION are the split successors
  { code: "HVAC_REFRIGERATION", name: "HVAC / Refrigeration", sortOrder: 50 },
  { code: "HVAC", name: "HVAC", sortOrder: 51 },
  { code: "REFRIGERATION", name: "Refrigeration", sortOrder: 52 },
  { code: "FACILITY_CIVIL", name: "Facility / Civil", sortOrder: 60 },
  { code: "PLUMBING", name: "Plumbing", sortOrder: 65 },
  { code: "WATER_WASTEWATER", name: "Water / Wastewater", sortOrder: 70 },
  { code: "FLEET", name: "Fleet", sortOrder: 80 },
  { code: "MATERIAL_HANDLING", name: "Material Handling", sortOrder: 90 },
  { code: "FARM_INFRASTRUCTURE", name: "Farm Infrastructure", sortOrder: 100 },
  { code: "OUTLET_EQUIPMENT", name: "Outlet Equipment", sortOrder: 110 },
  { code: "FIRE_SAFETY", name: "Fire / Safety", sortOrder: 120 },
  { code: "SECURITY", name: "Security", sortOrder: 130 },
  { code: "IT_HARDWARE", name: "IT Hardware", sortOrder: 140 },
  { code: "LABORATORY", name: "Laboratory", sortOrder: 150 },
  { code: "CALIBRATION", name: "Calibration", sortOrder: 160 },
  { code: "KITCHEN_CANTEEN", name: "Kitchen / Canteen", sortOrder: 170 },
  { code: "ENERGY_SOLAR", name: "Energy / Solar", sortOrder: 180 },
  { code: "TOOLS_MOULDS_JIGS", name: "Tools / Moulds / Jigs", sortOrder: 190 },
  { code: "EXTERNAL_INFRASTRUCTURE", name: "External Infrastructure", sortOrder: 200 },
  { code: "OTHER", name: "Other", sortOrder: 999 }
] as const;

/** Example categories for seed — illustrative only, not Nelna inventory */
export const DEFAULT_CATEGORY_EXAMPLES: Array<{
  domainCode: string;
  code: string;
  name: string;
  legacyEnum?: string;
  types?: Array<{ code: string; name: string }>;
}> = [
  {
    domainCode: "PLANT_MACHINERY",
    code: "MACHINE",
    name: "Machine",
    legacyEnum: "MACHINE",
    types: [{ code: "GENERIC_MACHINE", name: "Generic Machine" }]
  },
  {
    domainCode: "UTILITIES",
    code: "GENERATOR",
    name: "Generator",
    types: [
      { code: "DIESEL_GENERATOR", name: "Diesel Generator" },
      { code: "GAS_GENERATOR", name: "Gas Generator" }
    ]
  },
  {
    domainCode: "MECHANICAL",
    code: "PUMP",
    name: "Pump",
    types: [
      { code: "CENTRIFUGAL_PUMP", name: "Centrifugal Pump" },
      { code: "SUBMERSIBLE_PUMP", name: "Submersible Pump" }
    ]
  },
  {
    domainCode: "MECHANICAL",
    code: "EQUIPMENT",
    name: "Equipment",
    legacyEnum: "EQUIPMENT",
    types: [{ code: "GENERIC_EQUIPMENT", name: "Generic Equipment" }]
  },
  {
    domainCode: "HVAC_REFRIGERATION",
    code: "COLD_ROOM",
    name: "Cold Room",
    legacyEnum: "COLD_ROOM",
    types: [{ code: "WALK_IN_COLD_ROOM", name: "Walk-in Cold Room" }]
  },
  {
    domainCode: "REFRIGERATION",
    code: "COLD_ROOM",
    name: "Cold Room",
    legacyEnum: "COLD_ROOM",
    types: [{ code: "WALK_IN_COLD_ROOM", name: "Walk-in Cold Room" }]
  },
  {
    domainCode: "FACILITY_CIVIL",
    code: "AIR_CONDITIONER",
    name: "Air Conditioner",
    types: [{ code: "SPLIT_AC", name: "Split AC" }]
  },
  {
    domainCode: "FACILITY_CIVIL",
    code: "INFRASTRUCTURE",
    name: "Infrastructure",
    legacyEnum: "INFRASTRUCTURE",
    types: [{ code: "GENERIC_INFRASTRUCTURE", name: "Generic Infrastructure" }]
  },
  {
    domainCode: "PLUMBING",
    code: "PLUMBING_FIXTURE",
    name: "Plumbing Fixture",
    types: [
      { code: "WATER_PIPE", name: "Water Pipe" },
      { code: "VALVE", name: "Valve" },
      { code: "PUMP_FITTING", name: "Pump Fitting" }
    ]
  },
  {
    domainCode: "WATER_WASTEWATER",
    code: "IRRIGATION_PUMP",
    name: "Irrigation Pump",
    legacyEnum: "IRRIGATION_PUMP",
    types: [{ code: "IRRIGATION_PUMP_UNIT", name: "Irrigation Pump Unit" }]
  },
  {
    domainCode: "FLEET",
    code: "VEHICLE",
    name: "Vehicle",
    legacyEnum: "VEHICLE",
    types: [
      { code: "TRUCK", name: "Truck" },
      { code: "VAN", name: "Van" }
    ]
  },
  {
    domainCode: "FIRE_SAFETY",
    code: "FIRE_EXTINGUISHER",
    name: "Fire Extinguisher",
    types: [
      { code: "CO2_EXTINGUISHER", name: "CO2 Extinguisher" },
      { code: "DRY_POWDER_EXTINGUISHER", name: "Dry Powder Extinguisher" }
    ]
  },
  {
    domainCode: "IT_HARDWARE",
    code: "LAPTOP",
    name: "Laptop",
    types: [{ code: "LAPTOP_GENERAL", name: "Laptop (General)" }]
  },
  {
    domainCode: "TOOLS_MOULDS_JIGS",
    code: "TOOL",
    name: "Tool",
    legacyEnum: "TOOL",
    types: [{ code: "HAND_TOOL", name: "Hand Tool" }]
  },
  {
    domainCode: "FARM_INFRASTRUCTURE",
    code: "FARM_OTHER",
    name: "Farm Other",
    types: [{ code: "FARM_GENERIC", name: "Farm Generic" }]
  },
  {
    domainCode: "EXTERNAL_INFRASTRUCTURE",
    code: "ROAD_DRAIN",
    name: "Road / Drain",
    types: [
      { code: "ROAD", name: "Road" },
      { code: "DRAIN", name: "Drain" }
    ]
  },
  {
    domainCode: "OTHER",
    code: "OTHER",
    name: "Other",
    legacyEnum: "OTHER",
    types: [{ code: "GENERIC", name: "Generic" }]
  }
];

/**
 * Sample attribute definitions seeded per type code — illustrative only.
 * Keys match AssetAttributeDataType enum values.
 */
export const DEFAULT_ATTRIBUTE_EXAMPLES: Array<{
  domainCode: string;
  categoryCode: string;
  typeCode: string;
  key: string;
  label: string;
  dataType: "TEXT" | "NUMBER" | "BOOLEAN" | "DATE" | "SELECT";
  unit?: string;
  options?: string[];
  displayOrder: number;
}> = [
  // Generator — capacity + fuel type
  {
    domainCode: "UTILITIES",
    categoryCode: "GENERATOR",
    typeCode: "DIESEL_GENERATOR",
    key: "capacity_kva",
    label: "Capacity (kVA)",
    dataType: "NUMBER",
    unit: "kVA",
    displayOrder: 1
  },
  {
    domainCode: "UTILITIES",
    categoryCode: "GENERATOR",
    typeCode: "DIESEL_GENERATOR",
    key: "fuel_type",
    label: "Fuel Type",
    dataType: "SELECT",
    options: ["Diesel", "HFO", "Gas"],
    displayOrder: 2
  },
  // Cold Room — refrigerant + temperature range
  {
    domainCode: "HVAC_REFRIGERATION",
    categoryCode: "COLD_ROOM",
    typeCode: "WALK_IN_COLD_ROOM",
    key: "refrigerant",
    label: "Refrigerant",
    dataType: "SELECT",
    options: ["R22", "R134a", "R404A", "R407C", "R410A", "R449A"],
    displayOrder: 1
  },
  {
    domainCode: "HVAC_REFRIGERATION",
    categoryCode: "COLD_ROOM",
    typeCode: "WALK_IN_COLD_ROOM",
    key: "target_temp_c",
    label: "Target Temperature (°C)",
    dataType: "NUMBER",
    unit: "°C",
    displayOrder: 2
  },
  {
    domainCode: "REFRIGERATION",
    categoryCode: "COLD_ROOM",
    typeCode: "WALK_IN_COLD_ROOM",
    key: "refrigerant",
    label: "Refrigerant",
    dataType: "SELECT",
    options: ["R22", "R134a", "R404A", "R407C", "R410A", "R449A"],
    displayOrder: 1
  },
  // IT Laptop — hostname + warranty date
  {
    domainCode: "IT_HARDWARE",
    categoryCode: "LAPTOP",
    typeCode: "LAPTOP_GENERAL",
    key: "hostname",
    label: "Hostname",
    dataType: "TEXT",
    displayOrder: 1
  },
  {
    domainCode: "IT_HARDWARE",
    categoryCode: "LAPTOP",
    typeCode: "LAPTOP_GENERAL",
    key: "warranty_expiry",
    label: "Warranty Expiry Date",
    dataType: "DATE",
    displayOrder: 2
  }
];
