import { BadRequestException } from "@nestjs/common";
import { ApprovalProcessType, ApprovalTrigger, Priority, WorkOrderType } from "@prisma/client";

import { toStringArray } from "../../common/utils/json-text";

/** Structured condition fields — TS-only (not Prisma model columns; Json on ApprovalRule.conditions). */
export enum ApprovalConditionField {
  PRIORITY = "PRIORITY",
  ESTIMATED_COST = "ESTIMATED_COST",
  ACTUAL_COST = "ACTUAL_COST",
  EXECUTION_TYPE = "EXECUTION_TYPE",
  SITE_ID = "SITE_ID",
  DEPARTMENT_ID = "DEPARTMENT_ID",
  DOMAIN_ID = "DOMAIN_ID",
  WORK_TYPE = "WORK_TYPE",
  STATUS = "STATUS"
}

export enum ApprovalConditionOperator {
  EQ = "EQ",
  NEQ = "NEQ",
  GTE = "GTE",
  LTE = "LTE",
  IN = "IN"
}

export type StructuredCondition = {
  field: ApprovalConditionField;
  operator: ApprovalConditionOperator;
  value: string | number | boolean | string[];
};

export type ApprovalEvaluationContext = {
  processType: ApprovalProcessType;
  trigger?: ApprovalTrigger;
  priority?: Priority | string | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
  executionType?: string | null;
  siteId?: string | null;
  departmentId?: string | null;
  domainId?: string | null;
  workType?: WorkOrderType | string | null;
  status?: string | null;
  amount?: number | null;
};

const CONDITION_FIELDS = new Set<string>(Object.values(ApprovalConditionField));
const CONDITION_OPS = new Set<string>(Object.values(ApprovalConditionOperator));

export function parseConditions(raw: unknown): StructuredCondition[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new BadRequestException("Approval rule conditions must be an array");
  }
  return raw.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new BadRequestException(`Invalid condition at index ${index}`);
    }
    const row = item as Record<string, unknown>;
    const field = String(row.field ?? "");
    const operator = String(row.operator ?? "");
    if (!CONDITION_FIELDS.has(field)) {
      throw new BadRequestException(`Unsupported condition field: ${field}`);
    }
    if (!CONDITION_OPS.has(operator)) {
      throw new BadRequestException(`Unsupported condition operator: ${operator}`);
    }
    if (row.value === undefined) {
      throw new BadRequestException(`Condition value required at index ${index}`);
    }
    return {
      field: field as ApprovalConditionField,
      operator: operator as ApprovalConditionOperator,
      value: row.value as StructuredCondition["value"]
    };
  });
}

function readContextValue(
  field: ApprovalConditionField,
  ctx: ApprovalEvaluationContext
): string | number | boolean | null | undefined {
  switch (field) {
    case ApprovalConditionField.PRIORITY:
      return ctx.priority ?? null;
    case ApprovalConditionField.ESTIMATED_COST:
      return ctx.estimatedCost ?? ctx.amount ?? null;
    case ApprovalConditionField.ACTUAL_COST:
      return ctx.actualCost ?? ctx.amount ?? null;
    case ApprovalConditionField.EXECUTION_TYPE:
      return ctx.executionType ?? null;
    case ApprovalConditionField.SITE_ID:
      return ctx.siteId ?? null;
    case ApprovalConditionField.DEPARTMENT_ID:
      return ctx.departmentId ?? null;
    case ApprovalConditionField.DOMAIN_ID:
      return ctx.domainId ?? null;
    case ApprovalConditionField.WORK_TYPE:
      return ctx.workType ?? null;
    case ApprovalConditionField.STATUS:
      return ctx.status ?? null;
    default:
      return null;
  }
}

function compareValues(
  operator: ApprovalConditionOperator,
  left: string | number | boolean | null | undefined,
  right: StructuredCondition["value"]
): boolean {
  if (operator === ApprovalConditionOperator.IN) {
    const list = Array.isArray(right) ? right.map(String) : [String(right)];
    return left != null && list.includes(String(left));
  }

  if (left == null) return false;

  if (
    operator === ApprovalConditionOperator.GTE ||
    operator === ApprovalConditionOperator.LTE
  ) {
    const l = Number(left);
    const r = Number(right);
    if (!Number.isFinite(l) || !Number.isFinite(r)) return false;
    return operator === ApprovalConditionOperator.GTE ? l >= r : l <= r;
  }

  const ls = String(left);
  const rs = String(right);
  if (operator === ApprovalConditionOperator.EQ) return ls === rs;
  if (operator === ApprovalConditionOperator.NEQ) return ls !== rs;
  return false;
}

export function conditionsMatch(
  conditions: StructuredCondition[],
  ctx: ApprovalEvaluationContext
): boolean {
  if (conditions.length === 0) return true;
  return conditions.every((c) => compareValues(c.operator, readContextValue(c.field, ctx), c.value));
}

export function ruleScopeMatches(
  rule: {
    siteId?: string | null;
    departmentId?: string | null;
    domainId?: string | null;
    priorityScope?: string[] | string | null;
    workTypeScope?: string[] | string | null;
    amountThreshold?: number | null;
    amountField?: string | null;
  },
  ctx: ApprovalEvaluationContext
): boolean {
  if (rule.siteId && rule.siteId !== ctx.siteId) return false;
  if (rule.departmentId && rule.departmentId !== ctx.departmentId) return false;
  if (rule.domainId && rule.domainId !== ctx.domainId) return false;
  const priorityScope = toStringArray(rule.priorityScope);
  const workTypeScope = toStringArray(rule.workTypeScope);
  if (priorityScope.length) {
    if (!ctx.priority || !priorityScope.includes(String(ctx.priority))) return false;
  }
  if (workTypeScope.length) {
    if (!ctx.workType || !workTypeScope.includes(String(ctx.workType))) return false;
  }
  if (rule.amountThreshold != null && Number.isFinite(rule.amountThreshold)) {
    const field = (rule.amountField || "estimatedCost").toLowerCase();
    const amount =
      field.includes("actual")
        ? ctx.actualCost ?? ctx.amount
        : ctx.estimatedCost ?? ctx.amount;
    if (amount == null || Number(amount) < rule.amountThreshold) return false;
  }
  return true;
}

/** Future Phase 10 Gate engine calls this process type — do not duplicate approval logic in Fleet. */
export function gateOverrideApprovalHook(): {
  processType: ApprovalProcessType;
  trigger: ApprovalTrigger;
} {
  return {
    processType: ApprovalProcessType.GATE_OVERRIDE,
    trigger: ApprovalTrigger.BEFORE_GATE_OVERRIDE
  };
}
