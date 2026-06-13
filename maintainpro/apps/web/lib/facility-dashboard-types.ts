export type FacilityDashboardBreakdownRow = {
  key: string;
  label: string;
  count: number;
};

export type FacilityDashboardTopRoomRow = {
  roomId: string;
  roomName: string;
  openIssueCount: number;
};

export type FacilityDashboardIssuePreview = {
  id: string;
  title: string;
  severity: string;
  status: string;
  category: string | null;
  slaTargetAt: string | null;
  roomName: string | null;
  workOrderId: string | null;
  workOrderNumber: string | null;
  createdAt: string;
};

export type PublicFacilityDashboardSummary = {
  generatedAt: string;
  hierarchy: {
    propertyCount: number;
    buildingCount: number;
    floorCount: number;
    roomCount: number;
    inactiveRoomCount: number;
  };
  issues: {
    totalIssueCount: number;
    openIssueCount: number;
    inProgressIssueCount: number;
    resolvedIssueCount: number;
    closedIssueCount: number;
    overdueIssueCount: number;
    criticalOpenIssueCount: number;
    roomLinkedIssueCount: number;
    unlinkedIssueCount: number;
  };
  workOrderBridge: {
    linkedWorkOrderCount: number;
    unlinkedOpenIssueCount: number;
  };
  breakdowns: {
    byCategory: FacilityDashboardBreakdownRow[];
    bySeverity: FacilityDashboardBreakdownRow[];
    byStatus: FacilityDashboardBreakdownRow[];
  };
  attention: {
    topRoomsByOpenIssues: FacilityDashboardTopRoomRow[];
    overdueIssuesPreview: FacilityDashboardIssuePreview[];
    criticalIssuesPreview: FacilityDashboardIssuePreview[];
    unlinkedOpenIssuesPreview: FacilityDashboardIssuePreview[];
  };
};
