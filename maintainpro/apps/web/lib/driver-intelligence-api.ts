import { p4Get } from "@/lib/phase4-api";

export type DashboardTone = "neutral" | "success" | "warning" | "danger" | "info";

export type DriverManagementDashboardResponse = {
  generatedAt: string;
  filters: {
    startDate: string;
    endDate: string;
    departmentId: string | null;
    driverId: string | null;
    vehicleId: string | null;
    status: string | null;
  };
  summaryCards: Array<{ label: string; value: string | number; subLabel?: string; tone?: DashboardTone }>;
  riskDistribution: Array<{ level: string; count: number }>;
  bestDrivers: Array<{
    driverId: string;
    name: string;
    rankingScore: number;
    driverScore: number;
    riskLevel: string;
    assignedVehicleCount: number;
    supervisorReviewScore: number;
    eligibility: boolean;
  }>;
  highRiskDrivers: Array<{
    driverId: string;
    name: string;
    driverScore: number;
    riskLevel: string;
    primaryReasons: string[];
  }>;
  fuelInsights: {
    totalLiters: number;
    totalCost: number;
    avgCostPerLiter: number;
    avgConsumption: number | null;
    distance: number;
    abnormalUsageCount: number;
    anomalies: Array<{
      vehicleId: string;
      date: string;
      litersPer100Km: number;
      distance: number;
      liters: number;
    }>;
    monthlyTrend: Array<{ period: string; totalCost: number; liters: number }>;
  };
  fleetCostSummary: {
    breakdown: {
      fuelCost: number;
      maintenanceCost: number;
      accidentCost: number;
      fineCost: number;
      insuranceRecovery: number;
      netCost: number;
    };
    monthlyTrend: Array<{
      period: string;
      fuelCost: number;
      maintenanceCost: number;
      accidentCost: number;
      fineCost: number;
      insuranceRecovery: number;
      netCost: number;
    }>;
  };
  driverProfiles: Array<{
    id: string;
    displayName: string;
    driverScore: number;
    riskLevel: string;
    rankingScore: number;
    eligibleForNewVehicle: boolean;
    department: string | null;
    assignedVehicleCount: number;
    summary: {
      driverFaultAccidents: number;
      driverRelatedFines: number;
      organizationFines: number;
      documentRelatedOrganizationFines: number;
      vehicleDefectFines: number;
      abnormalFuelUsageCount: number;
      totalTrips: number;
      completedTrips: number;
      correctiveWorkOrders: number;
      overdueAssignedVehicles: number;
      nonCompliantAssignedVehicles: number;
    };
    components: {
      safetyScore: number;
      vehicleCareScore: number;
      tripReliabilityScore: number;
      fuelEfficiencyScore: number;
      complianceReadinessScore: number;
      supervisorReviewScore: number;
    };
  }>;
  alerts: Array<{ type: string; message: string; tone?: DashboardTone }>;
};

export async function getDriverManagementDashboard(params?: { startDate?: string; endDate?: string }) {
  return p4Get<DriverManagementDashboardResponse>("/driver-intelligence/dashboard", params);
}