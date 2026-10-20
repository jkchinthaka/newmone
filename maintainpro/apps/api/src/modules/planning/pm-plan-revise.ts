import { BadRequestException } from "@nestjs/common";

const EDITABLE = new Set([
  "name",
  "description",
  "status",
  "assetId",
  "vehicleId",
  "location",
  "teamId",
  "estimatedDurationMinutes",
  "checklistTemplateId",
  "gracePeriodDays",
  "siteId",
  "functionalLocationId",
  "domainId",
  "priority",
  "workType",
  "autoCreateWorkOrder",
  "combineMode",
  "effectiveFrom",
  "effectiveTo",
  "code"
]);

const PROTECTED = new Set([
  "id",
  "tenantId",
  "createdAt",
  "updatedAt",
  "currentRevision",
  "createdById",
  "lastCompletionAt",
  "lastCompletionMileage",
  "lastCompletionHours",
  "nextDueAt",
  "nextDueMeterValue",
  "nextDueMeterId",
  "legacyScheduleId",
  "revisions",
  "triggers",
  "requiredParts",
  "tenant"
]);

/** Unknown and protected keys are rejected. They are never stripped and written. */
export function whitelistPmPlanPatch(patch: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) {
    if (key === "changeReason" || key === "patch") continue;
    if (PROTECTED.has(key) || !EDITABLE.has(key)) {
      throw new BadRequestException(`Unknown or protected field: ${key}`);
    }
    safe[key] = patch[key];
  }
  return safe;
}
