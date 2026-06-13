import type { FacilityBuilding, FacilityFloor, FacilityProperty, FacilityRoom } from "./facilities";

export type FacilityIssueCategory =
  | "ELECTRICAL"
  | "PLUMBING"
  | "CIVIL"
  | "HVAC"
  | "SAFETY"
  | "CLEANING"
  | "PEST_CONTROL"
  | "OTHER";

export type FacilityIssueSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type FacilityIssueStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type FacilityIssueRow = {
  id: string;
  title: string;
  description: string;
  severity: FacilityIssueSeverity;
  status: FacilityIssueStatus;
  category: FacilityIssueCategory | null;
  createdAt: string;
  slaTargetAt?: string | null;
  resolutionMinutes?: number | null;
  photos?: string[];
  locationId?: string | null;
  location?: { id?: string; name: string; area?: string; building?: string | null; floor?: string | null } | null;
  roomId?: string | null;
  roomName?: string | null;
  floorId?: string | null;
  buildingId?: string | null;
  propertyId?: string | null;
  reportedBy: { firstName: string; lastName: string };
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
  workOrderId?: string | null;
  workOrderNumber?: string | null;
  workOrderTitle?: string | null;
  workOrderStatus?: string | null;
};

export type FacilityIssueRoomSelection = {
  propertyId: string;
  buildingId: string;
  floorId: string;
  roomId: string;
};

export const FACILITY_ISSUE_CATEGORY_OPTIONS: readonly {
  value: FacilityIssueCategory;
  label: string;
}[] = [
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "PLUMBING", label: "Plumbing" },
  { value: "CIVIL", label: "Civil" },
  { value: "HVAC", label: "HVAC" },
  { value: "SAFETY", label: "Safety" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "PEST_CONTROL", label: "Pest control" },
  { value: "OTHER", label: "Other" }
];

export const FACILITY_ISSUE_CREATE_PAYLOAD_KEYS = [
  "title",
  "description",
  "severity",
  "category",
  "locationId",
  "roomId",
  "assignedToId",
  "slaHours",
  "photos"
] as const;

export const FACILITY_ISSUE_FORBIDDEN_PAYLOAD_KEYS = ["tenantId", "room", "location"] as const;

export const FACILITY_ISSUE_UI_EXPOSED_ACTIONS = {
  workOrderBridge: true,
  qrPublicScan: false,
  qrAuthenticatedReport: true,
  photoUpload: false
} as const;

export const FACILITY_ISSUE_WORK_ORDER_BRIDGE_PERMISSION = "facility_issues.manage" as const;

export const FACILITY_ISSUE_WORK_ORDER_BRIDGE_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "FACILITY_MANAGER",
  "BUILDING_SUPERVISOR",
  "MANAGER",
  "SUPERVISOR"
] as const;

const FACILITY_ISSUE_WORK_ORDER_BRIDGE_BLOCKED_ROLES = new Set([
  "CLEANER",
  "VIEWER",
  "DRIVER",
  "AUDITOR"
]);

export function issueHasLinkedWorkOrder(
  issue: Pick<FacilityIssueRow, "workOrderId">
): boolean {
  return Boolean(issue.workOrderId?.trim());
}

export function canCreateWorkOrderFromIssue(input: {
  issue: Pick<FacilityIssueRow, "workOrderId" | "status">;
  role: string | null | undefined;
  permissions?: readonly string[];
}): boolean {
  if (issueHasLinkedWorkOrder(input.issue)) {
    return false;
  }

  if (input.issue.status === "RESOLVED" || input.issue.status === "CLOSED") {
    return false;
  }

  if (input.role && FACILITY_ISSUE_WORK_ORDER_BRIDGE_BLOCKED_ROLES.has(input.role)) {
    return false;
  }

  if (input.permissions?.includes(FACILITY_ISSUE_WORK_ORDER_BRIDGE_PERMISSION)) {
    return true;
  }

  return Boolean(
    input.role &&
      FACILITY_ISSUE_WORK_ORDER_BRIDGE_ROLES.includes(
        input.role as (typeof FACILITY_ISSUE_WORK_ORDER_BRIDGE_ROLES)[number]
      )
  );
}

export function formatLinkedWorkOrderLabel(
  issue: Pick<FacilityIssueRow, "workOrderNumber" | "workOrderTitle" | "workOrderStatus">
): string {
  const parts: string[] = [];

  if (issue.workOrderNumber?.trim()) {
    parts.push(issue.workOrderNumber.trim());
  }

  if (issue.workOrderTitle?.trim()) {
    parts.push(issue.workOrderTitle.trim());
  }

  if (issue.workOrderStatus?.trim()) {
    parts.push(issue.workOrderStatus.trim());
  }

  return parts.length > 0 ? parts.join(" · ") : "Linked work order";
}

export function getLinkedWorkOrderHref(_workOrderId?: string | null): string {
  return "/work-orders";
}

const FACILITY_ISSUE_REPORT_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "FACILITY_MANAGER",
  "BUILDING_SUPERVISOR",
  "SUPERVISOR",
  "CLEANER",
  "ASSET_MANAGER",
  "MANAGER"
]);

export function canReportFacilityIssue(input: {
  role: string | null | undefined;
  permissions?: readonly string[];
}): boolean {
  if (
    input.permissions?.includes("facility_issues.report") ||
    input.permissions?.includes("cleaning.report_issue")
  ) {
    return true;
  }

  return Boolean(input.role && FACILITY_ISSUE_REPORT_ROLES.has(input.role));
}

export function normalizeFacilityIssueCategory(value: string): FacilityIssueCategory | undefined {
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }

  return FACILITY_ISSUE_CATEGORY_OPTIONS.some((option) => option.value === normalized)
    ? (normalized as FacilityIssueCategory)
    : undefined;
}

export function formatFacilityIssueCategory(value: FacilityIssueCategory | null | undefined): string {
  if (!value) {
    return "";
  }

  return FACILITY_ISSUE_CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? value.replace(/_/g, " ");
}

export function facilityIssuePayloadIncludesTenantId(payload: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(payload, "tenantId");
}

export function buildCreateFacilityIssuePayload(input: {
  title: string;
  description: string;
  severity: string;
  locationId?: string;
  roomId?: string;
  category?: string;
  assignedToId?: string;
  slaHours?: number;
  photos?: string[];
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: input.title.trim(),
    description: input.description.trim(),
    severity: input.severity
  };

  if (input.locationId) {
    payload.locationId = input.locationId;
  }

  if (input.roomId) {
    payload.roomId = input.roomId;
  }

  const category = input.category ? normalizeFacilityIssueCategory(input.category) : undefined;
  if (category) {
    payload.category = category;
  }

  if (input.assignedToId) {
    payload.assignedToId = input.assignedToId;
  }

  if (input.slaHours != null && Number.isFinite(input.slaHours)) {
    payload.slaHours = input.slaHours;
  }

  if (input.photos?.length) {
    payload.photos = input.photos;
  }

  return payload;
}

export function buildUpdateFacilityIssueRoomPayload(input: {
  roomId: string | null;
  category?: string | null;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    roomId: input.roomId
  };

  if (input.category === null || input.category === "") {
    payload.category = null;
  } else if (input.category) {
    const category = normalizeFacilityIssueCategory(input.category);
    if (category) {
      payload.category = category;
    }
  }

  return payload;
}

export function getFacilityIssueLocationLabel(
  issue: Pick<FacilityIssueRow, "location" | "roomName" | "roomId">
): string {
  if (issue.roomId && issue.roomName) {
    return issue.roomName;
  }

  return issue.location?.name ?? "No location";
}

export function getFacilityIssueLocationDetail(
  issue: Pick<FacilityIssueRow, "location" | "roomName" | "roomId" | "floorId" | "buildingId">
): string | null {
  if (issue.roomId && issue.roomName) {
    const parts = [issue.roomName];
    if (issue.buildingId || issue.floorId) {
      parts.push("(facility hierarchy)");
    }
    return parts.join(" ");
  }

  if (issue.location?.name) {
    const legacyParts = [issue.location.name];
    if (issue.location.building) {
      legacyParts.push(issue.location.building);
    }
    if (issue.location.floor) {
      legacyParts.push(`Floor ${issue.location.floor}`);
    }
    return legacyParts.join(" · ");
  }

  return null;
}

export function filterIssuesByCategory(
  rows: readonly FacilityIssueRow[],
  category: FacilityIssueCategory | "ALL"
): FacilityIssueRow[] {
  if (category === "ALL") {
    return [...rows];
  }

  return rows.filter((row) => row.category === category);
}

export function filterBuildingsByProperty(
  buildings: readonly FacilityBuilding[],
  propertyId: string
): FacilityBuilding[] {
  if (!propertyId) {
    return [];
  }

  return buildings.filter((building) => building.propertyId === propertyId && building.isActive);
}

export function filterFloorsByBuilding(floors: readonly FacilityFloor[], buildingId: string): FacilityFloor[] {
  if (!buildingId) {
    return [];
  }

  return floors.filter((floor) => floor.buildingId === buildingId && floor.isActive);
}

export function filterRoomsByFloor(rooms: readonly FacilityRoom[], floorId: string): FacilityRoom[] {
  if (!floorId) {
    return [];
  }

  return rooms.filter((room) => room.floorId === floorId && room.isActive);
}

export function issueRoomSelectionFromRow(
  issue: Pick<FacilityIssueRow, "propertyId" | "buildingId" | "floorId" | "roomId">
): Partial<FacilityIssueRoomSelection> {
  if (!issue.roomId) {
    return {};
  }

  return {
    propertyId: issue.propertyId ?? "",
    buildingId: issue.buildingId ?? "",
    floorId: issue.floorId ?? "",
    roomId: issue.roomId
  };
}

export function emptyRoomSelection(): Partial<FacilityIssueRoomSelection> {
  return {
    propertyId: "",
    buildingId: "",
    floorId: "",
    roomId: ""
  };
}

export function roomSelectionToRoomId(selection: Partial<FacilityIssueRoomSelection>): string | undefined {
  const roomId = selection.roomId?.trim();
  return roomId || undefined;
}
