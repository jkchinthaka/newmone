import { VehicleStatus, VehicleType } from "@prisma/client";

export type VehicleEligibilityInput = {
  status: string;
  type?: string | null;
  decommissionedAt?: Date | string | null;
};

export type VehicleEligibilityResult = {
  selectable: boolean;
  unavailableReason: string | null;
};

const SELECTABLE_FOR_NEW_RECORD = new Set<string>([
  VehicleStatus.AVAILABLE,
  VehicleStatus.IN_USE
]);

/**
 * Backend-authoritative eligibility for NEW FG controlled records.
 * Historical records keep their snapshot regardless of current status.
 */
export function evaluateVehicleEligibilityForNewFgRecord(
  vehicle: VehicleEligibilityInput,
  options: { allowedTypes?: readonly string[] | null } = {}
): VehicleEligibilityResult {
  if (vehicle.decommissionedAt) {
    return { selectable: false, unavailableReason: "DECOMMISSIONED" };
  }

  const status = String(vehicle.status || "").toUpperCase();
  if (status === VehicleStatus.DISPOSED || status === "RETIRED" || status === "DECOMMISSIONED") {
    return { selectable: false, unavailableReason: "DISPOSED" };
  }
  if (status === VehicleStatus.OUT_OF_SERVICE) {
    return { selectable: false, unavailableReason: "OUT_OF_SERVICE" };
  }
  if (status === VehicleStatus.UNDER_MAINTENANCE) {
    return { selectable: false, unavailableReason: "UNDER_MAINTENANCE" };
  }
  if (!SELECTABLE_FOR_NEW_RECORD.has(status) && status !== "") {
    return { selectable: false, unavailableReason: status || "STATUS_NOT_SELECTABLE" };
  }

  const allowed = options.allowedTypes?.filter(Boolean) ?? [];
  if (allowed.length > 0) {
    const type = String(vehicle.type || "").toUpperCase();
    if (!allowed.map((t) => t.toUpperCase()).includes(type)) {
      return { selectable: false, unavailableReason: "TYPE_NOT_ALLOWED_FOR_FORM" };
    }
  }

  return { selectable: true, unavailableReason: null };
}

/** CL30 freezer truck inspection — truck-only for new selections. */
export function fgFormAllowedVehicleTypes(formCode: string | null | undefined): string[] | null {
  const code = String(formCode ?? "").trim().toUpperCase();
  if (code === "NMS/PPU/CL/30") {
    return [VehicleType.TRUCK];
  }
  return null;
}
