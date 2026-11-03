/**
 * Register-a-machine flow (Admin): type -> details -> place & owner -> purchase & service -> review.
 * The asset is saved as DRAFT; a manager approves it (Draft -> Active) on Machines & Equipment
 * before requests or jobs can use it.
 */
export const ASSET_REGISTER_STEPS = ["Type", "Details", "Place & owner", "Purchase & service", "Review"] as const;

export const ASSET_REGISTER_TYPES = [
  { value: "MACHINE", label: "Machine", help: "Production machines, motors, pumps, compressors" },
  { value: "EQUIPMENT", label: "Equipment", help: "Lab, kitchen, cold room or office equipment" },
  { value: "TOOL", label: "Tool", help: "Hand and power tools that are tracked" },
  { value: "INFRASTRUCTURE", label: "Building item", help: "Roofs, gates, lighting, plumbing, AC" },
  { value: "OTHER", label: "Other", help: "Anything else that needs maintenance" }
] as const;

export type AssetRegisterType = (typeof ASSET_REGISTER_TYPES)[number]["value"];

export const ASSET_IMPORTANCE_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical (production stops)" }
] as const;

export type AssetRegisterForm = {
  category: AssetRegisterType | "";
  name: string;
  assetTag: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  description: string;
  siteId: string;
  functionalLocationId: string;
  departmentId: string | null;
  criticalityLevel: string;
  purchaseDate: string;
  purchasePrice: string;
  supplier: string;
  warrantyExpiry: string;
  commissionedAt: string;
  meterReading: string;
  nextServiceDate: string;
};

export const EMPTY_ASSET_REGISTER_FORM: AssetRegisterForm = {
  category: "",
  name: "",
  assetTag: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  description: "",
  siteId: "",
  functionalLocationId: "",
  departmentId: null,
  criticalityLevel: "MEDIUM",
  purchaseDate: "",
  purchasePrice: "",
  supplier: "",
  warrantyExpiry: "",
  commissionedAt: "",
  meterReading: "",
  nextServiceDate: ""
};

/** Same rule as the API (AST- plus at least four letters or digits). */
export const ASSET_TAG_PATTERN = /^AST-[A-Z0-9]{4,}$/;

/** Problems that stop the user leaving a step (index into ASSET_REGISTER_STEPS). */
export function assetRegisterStepIssues(step: number, form: AssetRegisterForm): string[] {
  const issues: string[] = [];
  if (step === 0 && !form.category) issues.push("Choose what you are registering.");
  if (step === 1) {
    if (!form.name.trim()) issues.push("Enter the name.");
    if (!ASSET_TAG_PATTERN.test(form.assetTag.trim().toUpperCase())) issues.push("Asset tag must look like AST-MCH0001.");
  }
  if (step === 2 && !form.siteId) issues.push("Choose the site where it is.");
  if (step === 3) {
    if (form.purchasePrice.trim() && !(Number(form.purchasePrice) >= 0)) issues.push("Purchase price must be a number.");
    if (form.meterReading.trim() && !(Number(form.meterReading) >= 0)) issues.push("Meter reading must be a number.");
    if (form.purchaseDate && form.warrantyExpiry && form.warrantyExpiry < form.purchaseDate) {
      issues.push("Warranty end cannot be before the purchase date.");
    }
  }
  return issues;
}

/** POST /assets body. Always saved as DRAFT; blank optional fields are left out. */
export function assetRegisterPayload(form: AssetRegisterForm): Record<string, unknown> {
  const text = (value: string) => value.trim() || undefined;
  const number = (value: string) => (value.trim() === "" ? undefined : Number(value));
  return {
    status: "DRAFT",
    category: form.category,
    name: form.name.trim(),
    assetTag: form.assetTag.trim().toUpperCase(),
    manufacturer: text(form.manufacturer),
    model: text(form.model),
    serialNumber: text(form.serialNumber),
    description: text(form.description),
    siteId: form.siteId || undefined,
    functionalLocationId: form.functionalLocationId || undefined,
    departmentId: form.departmentId || undefined,
    criticalityLevel: form.criticalityLevel || undefined,
    purchaseDate: form.purchaseDate || undefined,
    purchasePrice: number(form.purchasePrice),
    supplier: text(form.supplier),
    warrantyExpiry: form.warrantyExpiry || undefined,
    commissionedAt: form.commissionedAt || undefined,
    meterReading: number(form.meterReading),
    nextServiceDate: form.nextServiceDate || undefined
  };
}
