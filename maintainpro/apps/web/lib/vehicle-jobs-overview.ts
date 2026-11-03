import { apiClient } from "@/lib/api-client";

/** Vehicle Jobs page header data (GET /work-orders/vehicle-overview). */
export type VehicleServiceDueRow = {
  vehicleId: string;
  registrationNo: string;
  makeModel: string;
  driverName: string | null;
  vehicleStatus: string;
  currentMileage: number | null;
  nextServiceDate: string | null;
  nextServiceMileage: number | null;
  state: "OVERDUE" | "DUE_SOON";
  daysLeft: number | null;
  kmLeft: number | null;
  openServiceJob: { id: string; woNumber: string; status: string } | null;
};

export type VehicleJobsOverview = {
  counts: {
    waitingToStart: number;
    inWorkshop: number;
    waitingPartsOrVendor: number;
    waitingCheck: number;
    offRoad: number;
    serviceOverdue: number;
    serviceDueSoon: number;
  };
  serviceDue: VehicleServiceDueRow[];
};

export async function fetchVehicleJobsOverview(signal?: AbortSignal): Promise<VehicleJobsOverview> {
  const response = await apiClient.get("/work-orders/vehicle-overview", { signal });
  return response.data?.data as VehicleJobsOverview;
}

/** "3 days late · 420 km over" / "in 5 days · 300 km left". */
export function serviceDueText(row: Pick<VehicleServiceDueRow, "daysLeft" | "kmLeft">): string {
  const parts: string[] = [];
  if (row.daysLeft != null) {
    if (row.daysLeft < 0) parts.push(`${Math.abs(row.daysLeft)} day${Math.abs(row.daysLeft) === 1 ? "" : "s"} late`);
    else if (row.daysLeft === 0) parts.push("due today");
    else parts.push(`in ${row.daysLeft} day${row.daysLeft === 1 ? "" : "s"}`);
  }
  if (row.kmLeft != null) {
    parts.push(row.kmLeft <= 0 ? `${Math.abs(row.kmLeft).toLocaleString()} km over` : `${row.kmLeft.toLocaleString()} km left`);
  }
  return parts.join(" · ") || "Service due";
}

/** POST /work-orders body for "Create service job" on a due vehicle. */
export function serviceJobPayload(row: VehicleServiceDueRow, createdById: string) {
  const due = row.nextServiceDate ? row.nextServiceDate.slice(0, 10) : undefined;
  return {
    title: `Service: ${row.registrationNo}`,
    description: `Scheduled service for ${row.registrationNo}${row.makeModel ? ` (${row.makeModel})` : ""}. ${serviceDueText(row)}.`,
    priority: row.state === "OVERDUE" ? "HIGH" : "MEDIUM",
    type: "PREVENTIVE",
    jobDomain: "VEHICLE",
    vehicleId: row.vehicleId,
    currentOdometer: row.currentMileage ?? 0,
    createdById,
    ...(due && row.state === "DUE_SOON" ? { dueDate: new Date(`${due}T12:00:00Z`).toISOString() } : {})
  };
}
