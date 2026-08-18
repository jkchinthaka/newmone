import { allow, deny, firstDenial, type PolicyDecision } from "./policy-decision";

export type ErpApplyInput = {
  tenantId?: string | null;
  sourceIdentity?: string | null;
  mappingPresent?: boolean;
  sourceStatusSafe?: boolean;
  duplicateSamePayload?: boolean;
  duplicateDifferentPayload?: boolean;
  reconciliationBlocking?: boolean;
};

export function canErpApply(input: ErpApplyInput): PolicyDecision {
  return firstDenial(
    input.tenantId ? allow() : deny("TENANT_REQUIRED", undefined, "CRITICAL"),
    input.sourceIdentity ? allow() : deny("ERP_SOURCE_REQUIRED"),
    input.mappingPresent === false ? deny("ERP_MAPPING_MISSING", undefined, "HIGH") : allow(),
    input.sourceStatusSafe === false ? deny("ERP_SOURCE_STATUS_INVALID") : allow(),
    input.duplicateDifferentPayload ? deny("ERP_DUPLICATE_PAYLOAD_MISMATCH", undefined, "CRITICAL") : allow(),
    input.reconciliationBlocking ? deny("ERP_APPLY_UNSAFE", undefined, "HIGH") : allow()
  );
}

export function canErpReplay(input: { samePayload: boolean }): PolicyDecision {
  return input.samePayload ? allow("ERP_IDEMPOTENT_REPLAY") : deny("ERP_DUPLICATE_PAYLOAD_MISMATCH", undefined, "CRITICAL");
}
