export const TENANT_FEATURE_CATALOG = [
  {
    code: "MACHINERY",
    name: "Machinery Maintenance",
    description: "Plant and machinery job domain"
  },
  {
    code: "SERVICE",
    name: "Service / Facility Maintenance",
    description: "Facility and service job domain"
  },
  {
    code: "FLEET",
    name: "Fleet / Vehicles",
    description: "Vehicle maintenance and fleet operations"
  },
  { code: "TYRES", name: "Tyres", description: "Tyre lifecycle management" },
  { code: "BATTERIES", name: "Batteries", description: "Battery lifecycle management" },
  { code: "FUEL", name: "Fuel", description: "Fuel tracking module" },
  { code: "GATE", name: "Gate Operations", description: "Vehicle gate in/out controls" },
  { code: "SAFETY", name: "Safety", description: "Safety metadata and controls" },
  {
    code: "PERMIT_TO_WORK",
    name: "Permit to Work",
    description: "High-risk work permits"
  },
  { code: "CALIBRATION", name: "Calibration", description: "Instrument calibration" },
  {
    code: "VENDOR_PORTAL",
    name: "Vendor Portal",
    description: "Restricted vendor self-service"
  },
  {
    code: "OFFLINE_TECHNICIAN",
    name: "Offline Technician",
    description: "PWA offline-lite technician mode"
  },
  { code: "IOT", name: "IoT Ingestion", description: "IoT condition reading sources" },
  {
    code: "TELEMATICS",
    name: "Telematics",
    description: "Telematics meter and location feeds"
  },
  {
    code: "PREDICTIVE_READINESS",
    name: "Predictive Readiness",
    description: "Historical readiness indicators (no fake AI)"
  },
  {
    code: "ADVANCED_ANALYTICS",
    name: "Advanced Analytics",
    description: "Executive maintenance analytics"
  }
] as const;

export type TenantFeatureCode = (typeof TENANT_FEATURE_CATALOG)[number]["code"];

export function isKnownFeatureCode(code: string): code is TenantFeatureCode {
  return TENANT_FEATURE_CATALOG.some((f) => f.code === code);
}
