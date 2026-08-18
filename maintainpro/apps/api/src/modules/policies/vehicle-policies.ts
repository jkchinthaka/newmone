import { VehicleStatus } from "@prisma/client";

import { allow, deny, firstDenial, type PolicyDecision } from "./policy-decision";

export type VehicleGateOutInput = {
  tenantId?: string | null;
  vehicleActive?: boolean;
  status?: VehicleStatus | string | null;
  maintenanceCriticallyOverdue?: boolean;
  criticalWorkOrderOpen?: boolean;
  complianceValid?: boolean;
  driverValid?: boolean;
  driverLicenseExpired?: boolean;
  overrideRequested?: boolean;
  overrideAuthorized?: boolean;
  overrideReason?: string | null;
};

const BLOCKED_STATUSES: Record<string, string> = {
  [VehicleStatus.IN_USE]: "VEHICLE_IN_USE",
  [VehicleStatus.UNDER_MAINTENANCE]: "VEHICLE_UNDER_MAINTENANCE",
  [VehicleStatus.OUT_OF_SERVICE]: "VEHICLE_OUT_OF_SERVICE",
  [VehicleStatus.DISPOSED]: "VEHICLE_DISPOSED"
};

export function canVehicleOperate(input: VehicleGateOutInput): PolicyDecision {
  return canVehicleGateOut(input);
}

export function canVehicleGateOut(input: VehicleGateOutInput): PolicyDecision {
  if (!input.tenantId) {
    return deny("TENANT_REQUIRED", undefined, "CRITICAL");
  }
  if (input.vehicleActive === false) {
    return deny("VEHICLE_INACTIVE", { status: input.status }, "CRITICAL");
  }

  const statusCode = input.status ? BLOCKED_STATUSES[String(input.status)] : undefined;
  const statusDenial = statusCode ? deny(statusCode, { status: input.status }, "HIGH") : allow();
  const maintenanceDenial = input.maintenanceCriticallyOverdue
    ? deny("MAINTENANCE_CRITICALLY_OVERDUE", undefined, "CRITICAL")
    : allow();
  const woDenial = input.criticalWorkOrderOpen
    ? deny("CRITICAL_WORK_ORDER_OPEN", undefined, "CRITICAL")
    : allow();
  const complianceDenial =
    input.complianceValid === false ? deny("COMPLIANCE_INVALID", undefined, "CRITICAL") : allow();
  const driverDenial =
    input.driverValid === false
      ? deny("DRIVER_INVALID")
      : input.driverLicenseExpired
        ? deny("DRIVER_LICENSE_EXPIRED", undefined, "CRITICAL")
        : allow();

  const operational = firstDenial(statusDenial, maintenanceDenial, woDenial, complianceDenial, driverDenial);
  if (operational.allowed) {
    return allow("GATE_OUT_ALLOWED");
  }

  if (!input.overrideRequested) {
    return operational;
  }
  if (!input.overrideAuthorized) {
    return deny("OVERRIDE_UNAUTHORIZED", { blockedCode: operational.code }, "CRITICAL");
  }
  if (!input.overrideReason?.trim()) {
    return deny("OVERRIDE_REASON_REQUIRED", { blockedCode: operational.code });
  }
  return allow("GATE_OUT_OVERRIDE", { blockedCode: operational.code });
}
