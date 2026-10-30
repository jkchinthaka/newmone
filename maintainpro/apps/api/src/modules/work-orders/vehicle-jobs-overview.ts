/**
 * Vehicle Jobs page header: what is in the workshop and which vehicles need a service.
 * "Due soon" is 7 days or 500 km before the next service; "overdue" is past either one.
 */
export const SERVICE_DUE_SOON_DAYS = 7;
export const SERVICE_DUE_SOON_KM = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

export type VehicleServiceState = "OVERDUE" | "DUE_SOON" | "OK";

export function vehicleServiceState(
  vehicle: {
    currentMileage?: number | null;
    nextServiceDate?: Date | null;
    nextServiceMileage?: number | null;
  },
  now: Date
): { state: VehicleServiceState; daysLeft: number | null; kmLeft: number | null } {
  const daysLeft = vehicle.nextServiceDate
    ? Math.floor((vehicle.nextServiceDate.getTime() - now.getTime()) / DAY_MS)
    : null;
  const kmLeft =
    vehicle.nextServiceMileage != null && vehicle.nextServiceMileage > 0
      ? Math.round(Number(vehicle.nextServiceMileage) - Number(vehicle.currentMileage ?? 0))
      : null;
  const overdue = (daysLeft != null && daysLeft < 0) || (kmLeft != null && kmLeft <= 0);
  if (overdue) return { state: "OVERDUE", daysLeft, kmLeft };
  const soon =
    (daysLeft != null && daysLeft <= SERVICE_DUE_SOON_DAYS) || (kmLeft != null && kmLeft <= SERVICE_DUE_SOON_KM);
  return { state: soon ? "DUE_SOON" : "OK", daysLeft, kmLeft };
}
