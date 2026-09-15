/**
 * Phase 15 — one-shot Mongo → SQL Server Prisma schema converter.
 * Run from maintainpro/: node scripts/phase15-convert-schema-to-sqlserver.mjs
 * Idempotent guards: skips if provider already sqlserver.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(root, "prisma", "schema.prisma");

let src = fs.readFileSync(schemaPath, "utf8");
if (/provider\s*=\s*"sqlserver"/.test(src)) {
  console.log("Already sqlserver — no-op");
  process.exit(0);
}

src = src.replace(
  /datasource db \{\s*provider = "mongodb"\s*url\s*=\s*env\("DATABASE_URL"\)\s*\}/m,
  `datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}`
);

// PK: id ... @id @default(auto()) @map("_id") @db.ObjectId
src = src.replace(
  /(\bid\s+String\s+)@id\s+@default\(auto\(\)\)\s+@map\("_id"\)\s+@db\.ObjectId/g,
  "$1@id @default(cuid()) @db.NVarChar(36)"
);

// Remaining ObjectId native types → NVarChar(36)
src = src.replace(/@db\.ObjectId/g, "@db.NVarChar(36)");

// Soften cascades (SQL Server multiple-path safety)
src = src.replace(/onDelete:\s*Cascade/g, "onDelete: NoAction");
src = src.replace(/onUpdate:\s*Cascade/g, "onUpdate: NoAction");

// --- Role / Permission: remove Mongo dual-array M2M ---
src = src.replace(
  /model Permission \{[\s\S]*?\n\}/,
  `model Permission {
  id          String   @id @default(cuid()) @db.NVarChar(36)
  key         String   @unique @db.NVarChar(191)
  description String?  @db.NVarChar(Max)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  roleLinks RolePermission[]
}`
);

src = src.replace(
  /model Role \{[\s\S]*?\n\}/,
  `model Role {
  id        String   @id @default(cuid()) @db.NVarChar(36)
  tenantId  String?  @db.NVarChar(36)
  tenant    Tenant?  @relation(fields: [tenantId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  name      RoleName
  users     User[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  permissionLinks RolePermission[]

  @@index([tenantId, name])
  @@index([tenantId])
}`
);

// User.skills → drop array; UserSkill junction (relation added below)
src = src.replace(
  /(\s+)\/\/\/ Skill tags for assignment filtering\n\s+skills\s+String\[\]\n/,
  `$1/// Skill tags — see UserSkill junction (Phase 15)\n`
);

// Ensure User has userSkills relation — inject before @@index([tenantId])
if (!src.includes("userSkills")) {
  src = src.replace(
    /(model User \{[\s\S]*?)(\n\s+@@index\(\[tenantId\]\))/m,
    `$1\n  userSkills                 UserSkill[]\n$2`
  );
}

// Convert remaining String[] → Json (SQL Server-compatible flexible arrays)
src = src.replace(/(\w+)\s+String\[\](\s+@default\(\[\]\))?/g, (match, name, def) => {
  if (def) return `${name} Json${def.replace("[]", "[]")}`.replace('@default([])', '@default("[]")');
  return `${name} Json @default("[]")`;
});
// Fix botched defaults from above
src = src.replace(/Json\s+@default\("\[\]"\)\s+@default\("\[\]"\)/g, 'Json @default("[]")');
src = src.replace(/Json\s+Json/g, "Json");

// JobCode / PmPlan requiredPartIds were String[] @db.NVarChar — already converted by ObjectId pass then String[] pass.
// Remove Json fields for junction-normalized ID lists and add relations.
function stripFieldAndAddRelation(modelName, fieldName, relationName) {
  const re = new RegExp(`(model ${modelName} \\{[\\s\\S]*?)\\n\\s+${fieldName}\\s+Json[^\\n]*\\n`);
  if (!re.test(src)) {
    console.warn(`warn: ${modelName}.${fieldName} not found for strip`);
    return;
  }
  src = src.replace(re, `$1\n  ${relationName}\n`);
}

stripFieldAndAddRelation("JobCode", "requiredPartIds", "requiredParts JobCodeRequiredPart[]");
stripFieldAndAddRelation("PmPlan", "requiredPartIds", "requiredParts PmPlanRequiredPart[]");
stripFieldAndAddRelation("TraceabilityRecord", "sprayLogIds", "sprayLinks TraceabilitySprayLink[]");
stripFieldAndAddRelation("VendorContract", "assetIds", "contractAssets VendorContractAsset[]");
stripFieldAndAddRelation("VendorContract", "siteIds", "contractSites VendorContractSite[]");

// Employee.skills / workCategories stay as Json after conversion — OK for Phase 15

const junctionBlock = `

// ---------------------------------------------------------------------------
// Phase 15 — SQL Server junction / normalized list tables
// ---------------------------------------------------------------------------

model RolePermission {
  id           String     @id @default(cuid()) @db.NVarChar(36)
  roleId       String     @db.NVarChar(36)
  permissionId String     @db.NVarChar(36)
  role         Role       @relation(fields: [roleId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  createdAt    DateTime   @default(now())

  @@unique([roleId, permissionId])
  @@index([permissionId])
}

model UserSkill {
  id        String   @id @default(cuid()) @db.NVarChar(36)
  userId    String   @db.NVarChar(36)
  skill     String   @db.NVarChar(128)
  user      User     @relation(fields: [userId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  createdAt DateTime @default(now())

  @@unique([userId, skill])
  @@index([skill])
}

model JobCodeRequiredPart {
  id         String  @id @default(cuid()) @db.NVarChar(36)
  jobCodeId  String  @db.NVarChar(36)
  sparePartId String @db.NVarChar(36)
  jobCode    JobCode @relation(fields: [jobCodeId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@unique([jobCodeId, sparePartId])
  @@index([sparePartId])
}

model PmPlanRequiredPart {
  id          String @id @default(cuid()) @db.NVarChar(36)
  pmPlanId    String @db.NVarChar(36)
  sparePartId String @db.NVarChar(36)
  pmPlan      PmPlan @relation(fields: [pmPlanId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@unique([pmPlanId, sparePartId])
  @@index([sparePartId])
}

model TraceabilitySprayLink {
  id                   String             @id @default(cuid()) @db.NVarChar(36)
  traceabilityRecordId String             @db.NVarChar(36)
  sprayLogId           String             @db.NVarChar(36)
  record               TraceabilityRecord @relation(fields: [traceabilityRecordId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@unique([traceabilityRecordId, sprayLogId])
  @@index([sprayLogId])
}

model VendorContractAsset {
  id               String         @id @default(cuid()) @db.NVarChar(36)
  vendorContractId String         @db.NVarChar(36)
  assetId          String         @db.NVarChar(36)
  contract         VendorContract @relation(fields: [vendorContractId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@unique([vendorContractId, assetId])
  @@index([assetId])
}

model VendorContractSite {
  id               String         @id @default(cuid()) @db.NVarChar(36)
  vendorContractId String         @db.NVarChar(36)
  siteId           String         @db.NVarChar(36)
  contract         VendorContract @relation(fields: [vendorContractId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@unique([vendorContractId, siteId])
  @@index([siteId])
}
`;

if (!src.includes("model RolePermission")) {
  src = src.trimEnd() + "\n" + junctionBlock + "\n";
}

// High-value money fields → Decimal(18,2) — targeted replacements
const moneyFields = [
  ["WorkOrderCostSnapshot", "partsCost"],
  ["WorkOrderCostSnapshot", "internalLabourCost"],
  ["WorkOrderCostSnapshot", "externalServiceCost"],
  ["WorkOrderCostSnapshot", "transportCost"],
  ["WorkOrderCostSnapshot", "otherCost"],
  ["WorkOrderCostSnapshot", "totalCost"],
  ["WorkOrder", "estimatedCost"],
  ["WorkOrder", "actualCost"],
  ["WorkOrderLabourEntry", "labourRateSnapshot"],
  ["WorkOrderPart", "unitCost"],
  ["WorkOrderPart", "totalCost"],
  ["SparePart", "unitCost"],
  ["ApprovalRule", "amountThreshold"],
  ["PurchaseOrder", "totalAmount"],
  ["PurchaseOrderLine", "unitCost"],
  ["PurchaseOrderLine", "totalCost"],
  ["VendorInvoice", "invoiceAmount"],
  ["VendorInvoice", "taxAmount"],
  ["VendorInvoice", "totalAmount"],
  ["FuelLog", "costPerLiter"],
  ["FuelLog", "totalCost"],
  ["MaintenanceLog", "cost"],
];

for (const [model, field] of moneyFields) {
  const modelRe = new RegExp(`(model ${model} \\{[\\s\\S]*?\\n\\s+)${field}\\s+Float(\\??)`);
  if (modelRe.test(src)) {
    src = src.replace(modelRe, `$1${field} Decimal$2 @db.Decimal(18, 2)`);
  }
}

fs.writeFileSync(schemaPath, src);
console.log("Wrote", schemaPath);
console.log("Remaining String[]:", (src.match(/String\[\]/g) || []).length);
console.log("Remaining ObjectId:", (src.match(/ObjectId/g) || []).length);
console.log("Remaining auto():", (src.match(/@default\(auto\(\)\)/g) || []).length);
console.log("provider:", (src.match(/provider = "\w+"/) || [])[0]);
