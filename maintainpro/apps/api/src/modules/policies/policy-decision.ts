import { BadRequestException } from "@nestjs/common";

import { policyMessage } from "./policy-codes";

export type PolicySeverity = "INFO" | "WARNING" | "HIGH" | "CRITICAL";

export type PolicyDecision = {
  allowed: boolean;
  code: string;
  reason: string;
  severity?: PolicySeverity;
  metadata?: Record<string, unknown>;
};

export function allow(code = "ALLOWED", metadata?: Record<string, unknown>): PolicyDecision {
  return { allowed: true, code, reason: "ALLOWED", metadata };
}

export function deny(
  code: string,
  metadata?: Record<string, unknown>,
  severity: PolicySeverity = "HIGH"
): PolicyDecision {
  return {
    allowed: false,
    code,
    reason: code,
    severity,
    metadata
  };
}

export function firstDenial(...decisions: PolicyDecision[]): PolicyDecision {
  return decisions.find((decision) => !decision.allowed) ?? allow();
}

export function assertPolicy(decision: PolicyDecision): void {
  if (!decision.allowed) {
    throw new PolicyDeniedException(decision);
  }
}

export class PolicyDeniedException extends BadRequestException {
  readonly decision: PolicyDecision;

  constructor(decision: PolicyDecision) {
    super({
      statusCode: 400,
      error: "Bad Request",
      code: decision.code,
      message: policyMessage(decision.code),
      reason: decision.code,
      metadata: decision.metadata ?? {},
      allowed: false
    });
    this.decision = decision;
  }
}
