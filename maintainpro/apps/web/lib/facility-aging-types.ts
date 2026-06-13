import type { FacilityDashboardIssuePreview } from "./facility-dashboard-types";

export type FacilityAgeBucketKey = "0_1" | "2_3" | "4_7" | "8_plus";

export type FacilityAgeBucketRow = {
  key: FacilityAgeBucketKey;
  label: string;
  count: number;
  criticalCount: number;
  highCount: number;
};

export type FacilityWorkOrderAgingPreview = {
  id: string;
  woNumber: string;
  title: string;
  status: string;
  dueDate: string;
  ageDays: number;
  isOverdue: boolean;
  facilityIssueId: string | null;
};

export type PublicFacilityAgingReport = {
  generatedAt: string;
  issues: {
    activeIssueCount: number;
    overdueIssueCount: number;
    criticalHighActiveCount: number;
    ageBuckets: FacilityAgeBucketRow[];
    overduePreview: FacilityDashboardIssuePreview[];
    criticalHighAgingPreview: FacilityDashboardIssuePreview[];
  };
  workOrders: {
    trackingAvailable: boolean;
    linkedActiveCount: number;
    withDueDateCount: number;
    overdueCount: number;
    ageBuckets: FacilityAgeBucketRow[];
    overduePreview: FacilityWorkOrderAgingPreview[];
  };
};
