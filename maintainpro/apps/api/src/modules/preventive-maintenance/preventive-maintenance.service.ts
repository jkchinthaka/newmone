import { getCurrentWeather } from "../../integrations/weather/weather.client";

export interface MaintenanceSchedule {
  id: string;
  task: string;
  assetCode: string;
  frequency: "weekly" | "monthly" | "quarterly";
  nextDueDate: string;
}

const schedules: MaintenanceSchedule[] = [
  {
    id: "pm-001",
    task: "Lubricate conveyor bearings",
    assetCode: "CONV-344",
    frequency: "monthly",
    nextDueDate: "2026-05-03"
  },
  {
    id: "pm-002",
    task: "Check emergency generator load",
    assetCode: "GEN-909",
    frequency: "weekly",
    nextDueDate: "2026-04-24"
  }
];

export const preventiveMaintenanceService = {
  listSchedules(): MaintenanceSchedule[] {
    return schedules;
  },

  async weatherImpact(location: string): Promise<{ location: string; recommendation: string }> {
    const weather = await getCurrentWeather(location);

    const recommendation =
      weather.temperatureC > 35
        ? "High temperature detected. Prefer early-morning outdoor maintenance windows."
        : "Weather conditions are suitable for normal maintenance scheduling.";

    return {
      location: weather.location,
      recommendation
    };
  }
};
