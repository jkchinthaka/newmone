import { apiClient } from "./api-client";

export type FleetOverviewSummary = {
  dueService: number;
  overdueService: number;
  expiringDocs: number;
  blockedVehicles: number;
  openRepairs: number;
  outOfService: number;
  activeTyreIssues: number;
  batteriesWarrantyExpiring: number;
  asOf: string;
};

export type GateEligibilityResult = {
  allowed: boolean;
  blockedReasons: string[];
  warnings: string[];
  canOverride: boolean;
  evaluatedAt: string;
  evaluatedRules: string[];
  vehicleId: string;
  driverId?: string;
};

export async function getFleetOverview(): Promise<FleetOverviewSummary> {
  const response = await apiClient.get("/fleet-lifecycle/overview");
  return (response.data as { data: FleetOverviewSummary }).data;
}

export async function getGateEligibility(
  vehicleId: string,
  driverId?: string
): Promise<GateEligibilityResult> {
  const params = driverId ? { driverId } : {};
  const response = await apiClient.get(`/fleet-lifecycle/vehicles/${vehicleId}/gate-eligibility`, {
    params
  });
  return (response.data as { data: GateEligibilityResult }).data;
}

export async function getFuelEfficiency(params: {
  litres: number;
  distanceKm: number;
  amount: number;
}) {
  const response = await apiClient.get("/fleet-lifecycle/fuel-efficiency", { params });
  return (response.data as { data: unknown }).data;
}

export async function installTyre(payload: {
  vehicleId: string;
  serialNumber?: string;
  brand?: string;
  size?: string;
  wheelPosition?: string;
  installedAt?: string;
  condition?: string;
  costSnapshot?: number;
  notes?: string;
}) {
  const response = await apiClient.post("/fleet-lifecycle/tyres/install", payload);
  return (response.data as { data: unknown }).data;
}

export async function installBattery(payload: {
  vehicleId: string;
  serialNumber?: string;
  brand?: string;
  capacityAh?: number;
  installedAt?: string;
  warrantyExpiresAt?: string;
  notes?: string;
}) {
  const response = await apiClient.post("/fleet-lifecycle/batteries/install", payload);
  return (response.data as { data: unknown }).data;
}

export async function assignDriver(
  vehicleId: string,
  payload: { driverId: string; openingMileage?: number; notes?: string }
) {
  const response = await apiClient.post(
    `/fleet-lifecycle/vehicles/${vehicleId}/assign-driver`,
    payload
  );
  return (response.data as { data: unknown }).data;
}

export async function backfillVehicleAssets(dryRun = true) {
  const response = await apiClient.post(
    `/fleet-lifecycle/vehicles/backfill-assets?dryRun=${dryRun}`
  );
  return (response.data as { data: unknown }).data;
}
