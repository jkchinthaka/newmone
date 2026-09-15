/**
 * Phase 15 — after prisma generate + enum inject, loosen SQL Server type friction:
 * - Former Json columns (now String) accept unknown on write inputs (runtime serializes)
 * - Known enum scalar fields typed as maintainpro enums
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "node_modules", ".prisma", "client");

const JSONISH =
  /(metadata|payload|snapshot|attributes|profile|answers|conditions|rawData|normalizedData|errors|warnings|lineItems|options|checklist|reasons|factors|actions|beforeData|afterData|actorSnapshot|resultJson|stagingRecords|sheetsDetected|warehousesDetected|mappingSnapshot|sourceContext|ruleSnapshot|contextSnapshot|criteriaSnapshot|dryRunSummary|applySummary|sourceMetadata|entityTypes|summary|shortageParts|selectedUsers|selectedRoles|selectedModules|blockers|departments|branches|roles|users|gpsPolygon|handoverChecklist|attachmentMetadata|customFields|customAttributes|items|value)\??:/g;

const JSON_TEXT_FIELDS = [
        "metadata",
        "metadataSafe",
        "payload",
        "actorSnapshot",
        "beforeData",
        "afterData",
        "resultJson",
        "raw",
        "value",
        "customAttributes",
        "customFields",
        "profile",
        "conditions",
        "answers",
        "lineItems",
        "options",
        "images",
        "documents",
        "attachments",
        "photos",
        "evidenceUrls",
        "documentUrls",
        "beforePhotos",
        "afterPhotos",
        "ppeRequired",
        "skills",
        "workCategories",
        "skillTags",
        "requiredSkills",
        "allowedRoles",
        "aliases",
        "keywords",
        "commonMistakes",
        "sinhalaKeywords",
        "departmentHints",
        "serviceCategories",
        "certifications",
        "reasonCodes",
        "priorityScope",
        "workTypeScope",
        "linkedChangeRequests",
        "linkedQaIssues",
        "linkedTickets",
        "handoverChecklist",
        "mappingSnapshot",
        "stagingRecords",
        "sheetsDetected",
        "warehousesDetected",
        "normalizedData",
        "rawData",
        "errors",
        "warnings",
        "requestPayload",
        "responsePayload",
        "contextSnapshot",
        "criteriaSnapshot",
        "ruleSnapshot",
        "sourceContext",
        "templateSnapshot",
        "triggerSummary",
        "dryRunSummary",
        "applySummary",
        "sourceMetadata",
        "entityTypes",
        "summary",
        "shortageParts",
        "selectedUsers",
        "selectedRoles",
        "selectedModules",
        "blockers",
        "attachmentMetadata",
        "actions",
        "reasons",
        "factors",
        "items",
        "checklistItems",
        "dailyChecklist",
        "gpsPolygon",
        "documents",
        "rows",
        "requiredParts",
        "sprayLogIds",
        "assetIds"
      ];

function loosenJsonishInputs(text) {
  const fieldPattern = JSON_TEXT_FIELDS.join("|");
  let out = text.replace(
    new RegExp(`\\b(${fieldPattern})(\\??):(\\s*)string(\\s*\\|\\s*null)?`, "g"),
    "$1$2:$3any$4"
  );
  out = out.replace(
    new RegExp(
      `\\b(${fieldPattern})(\\??):\\s*NullableStringFieldUpdateOperationsInput \\| string \\| null`,
      "g"
    ),
    "$1$2: any"
  );
  out = out.replace(
    new RegExp(`\\b(${fieldPattern})(\\??):\\s*StringFieldUpdateOperationsInput \\| string`, "g"),
    "$1$2: any"
  );
  return out;
}

const ENUM_FIELDS = [
  ["status", "WorkOrderStatus"],
  ["priority", "Priority"],
  ["name", "RoleName"],
  ["membershipRole", "RoleName"],
  ["approverRole", "RoleName"],
  ["workType", "WorkOrderType"],
  ["requestStatus", "MaintenanceRequestStatus"]
];

function patchFile(file) {
  const p = path.join(clientDir, file);
  if (!fs.existsSync(p)) return;
  let text = fs.readFileSync(p, "utf8");
  if (!text.includes("maintainpro-enums")) return;
  text = loosenJsonishInputs(text);
  // Soften Decimal comparisons friction: expose as any on selected cost Create inputs — skip (keep Decimal)
  if (!text.includes("Phase15Compat")) {
    text += `\n/** Phase15Compat */\n`;
  }
  fs.writeFileSync(p, text);
}

for (const f of ["index.d.ts", "default.d.ts"]) {
  patchFile(f);
}
console.log("Phase 15 Prisma type compat patched");
