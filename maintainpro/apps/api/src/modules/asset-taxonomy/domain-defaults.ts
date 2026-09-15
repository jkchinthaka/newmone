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
  { code: "HVAC_REFRIGERATION", name: "HVAC / Refrigeration", sortOrder: 50 },
  { code: "FACILITY_CIVIL", name: "Facility / Civil", sortOrder: 60 },
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
    domainCode: "OTHER",
    code: "OTHER",
    name: "Other",
    legacyEnum: "OTHER",
    types: [{ code: "GENERIC", name: "Generic" }]
  }
];
