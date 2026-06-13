import {
  FacilityIssueCategory,
  FacilityIssueStatus,
  IssueSeverity,
  Priority,
  WorkOrderStatus
} from "@prisma/client";

type IssueUserSummary = {
  id: string;
  firstName: string;
  lastName: string;
};

type IssueLocationSummary = {
  id: string;
  name: string;
  area: string;
  building: string | null;
  floor: string | null;
};

type IssueRoomGraph = {
  id: string;
  name: string;
  floorId: string;
  floor: {
    id: string;
    buildingId: string;
    building: {
      id: string;
      propertyId: string;
    };
  };
};

type IssueWorkOrderGraph = {
  id: string;
  woNumber: string;
  title: string;
  status: WorkOrderStatus;
};

export type PublicFacilityIssueWorkOrderSummary = {
  workOrderId: string;
  workOrderNumber: string;
  workOrderTitle: string;
  workOrderStatus: WorkOrderStatus;
};

export type PublicFacilityIssueResponse = {
  id: string;
  tenantId: string | null;
  title: string;
  description: string;
  category: FacilityIssueCategory | null;
  severity: IssueSeverity;
  status: FacilityIssueStatus;
  locationId: string | null;
  location: IssueLocationSummary | null;
  roomId: string | null;
  roomName: string | null;
  floorId: string | null;
  buildingId: string | null;
  propertyId: string | null;
  workOrderId: string | null;
  workOrderNumber: string | null;
  workOrderTitle: string | null;
  workOrderStatus: WorkOrderStatus | null;
  photos: string[];
  slaTargetAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  resolutionMinutes: number | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  reportedBy: IssueUserSummary;
  assignedTo: IssueUserSummary | null;
  resolvedBy: IssueUserSummary | null;
};

type FacilityIssueGraph = {
  id: string;
  tenantId: string | null;
  title: string;
  description: string;
  category: FacilityIssueCategory | null;
  severity: IssueSeverity;
  status: FacilityIssueStatus;
  locationId: string | null;
  roomId: string | null;
  workOrderId: string | null;
  photos: string[];
  slaTargetAt: Date | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  resolutionMinutes: number | null;
  resolution: string | null;
  createdAt: Date;
  updatedAt: Date;
  location?: IssueLocationSummary | null;
  room?: IssueRoomGraph | null;
  workOrder?: IssueWorkOrderGraph | null;
  reportedBy: IssueUserSummary;
  assignedTo?: IssueUserSummary | null;
  resolvedBy?: IssueUserSummary | null;
};

const PUBLIC_ISSUE_RESPONSE_KEYS = new Set<string>([
  "id",
  "tenantId",
  "title",
  "description",
  "category",
  "severity",
  "status",
  "locationId",
  "location",
  "roomId",
  "roomName",
  "floorId",
  "buildingId",
  "propertyId",
  "workOrderId",
  "workOrderNumber",
  "workOrderTitle",
  "workOrderStatus",
  "photos",
  "slaTargetAt",
  "firstResponseAt",
  "resolvedAt",
  "closedAt",
  "resolutionMinutes",
  "resolution",
  "createdAt",
  "updatedAt",
  "reportedBy",
  "assignedTo",
  "resolvedBy"
]);

export function mapIssueSeverityToWorkOrderPriority(severity: IssueSeverity): Priority {
  switch (severity) {
    case IssueSeverity.LOW:
      return Priority.LOW;
    case IssueSeverity.HIGH:
      return Priority.HIGH;
    case IssueSeverity.CRITICAL:
      return Priority.CRITICAL;
    case IssueSeverity.MEDIUM:
    default:
      return Priority.MEDIUM;
  }
}

export function buildWorkOrderDescriptionFromIssue(issue: FacilityIssueGraph): string {
  const lines = [issue.description.trim()];
  const contextLines: string[] = [];

  if (issue.category) {
    contextLines.push(`Category: ${issue.category.replace(/_/g, " ")}`);
  }

  if (issue.room?.name) {
    contextLines.push(`Room: ${issue.room.name}`);
  }

  if (issue.location?.name) {
    contextLines.push(`Cleaning location: ${issue.location.name}`);
  }

  if (contextLines.length > 0) {
    lines.push("", "Facility issue context:", ...contextLines.map((line) => `- ${line}`));
  }

  lines.push("", `Source facility issue ID: ${issue.id}`);
  return lines.join("\n");
}

export function toPublicWorkOrderSummary(workOrder: IssueWorkOrderGraph): PublicFacilityIssueWorkOrderSummary {
  return {
    workOrderId: workOrder.id,
    workOrderNumber: workOrder.woNumber,
    workOrderTitle: workOrder.title,
    workOrderStatus: workOrder.status
  };
}

export function toPublicFacilityIssueResponse(issue: FacilityIssueGraph): PublicFacilityIssueResponse {
  const room = issue.room;
  const workOrder = issue.workOrder;

  return {
    id: issue.id,
    tenantId: issue.tenantId,
    title: issue.title,
    description: issue.description,
    category: issue.category ?? null,
    severity: issue.severity,
    status: issue.status,
    locationId: issue.locationId,
    location: issue.location
      ? {
          id: issue.location.id,
          name: issue.location.name,
          area: issue.location.area,
          building: issue.location.building,
          floor: issue.location.floor
        }
      : null,
    roomId: issue.roomId,
    roomName: room?.name ?? null,
    floorId: room?.floorId ?? null,
    buildingId: room?.floor.buildingId ?? null,
    propertyId: room?.floor.building.propertyId ?? null,
    workOrderId: issue.workOrderId ?? workOrder?.id ?? null,
    workOrderNumber: workOrder?.woNumber ?? null,
    workOrderTitle: workOrder?.title ?? null,
    workOrderStatus: workOrder?.status ?? null,
    photos: issue.photos ?? [],
    slaTargetAt: issue.slaTargetAt?.toISOString() ?? null,
    firstResponseAt: issue.firstResponseAt?.toISOString() ?? null,
    resolvedAt: issue.resolvedAt?.toISOString() ?? null,
    closedAt: issue.closedAt?.toISOString() ?? null,
    resolutionMinutes: issue.resolutionMinutes,
    resolution: issue.resolution,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
    reportedBy: issue.reportedBy,
    assignedTo: issue.assignedTo ?? null,
    resolvedBy: issue.resolvedBy ?? null
  };
}

export function publicFacilityIssueResponseHasSensitiveFields(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.keys(value as Record<string, unknown>).some((key) => !PUBLIC_ISSUE_RESPONSE_KEYS.has(key));
}

export function publicFacilityIssueResponseHasRawRoomRelation(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.room != null && typeof record.room === "object";
}

export function publicFacilityIssueResponseHasRawWorkOrderRelation(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.workOrder != null && typeof record.workOrder === "object";
}

export const FACILITY_ISSUE_INCLUDE = {
  location: {
    select: {
      id: true,
      name: true,
      area: true,
      building: true,
      floor: true
    }
  },
  room: {
    select: {
      id: true,
      name: true,
      floorId: true,
      floor: {
        select: {
          id: true,
          buildingId: true,
          building: {
            select: {
              id: true,
              propertyId: true
            }
          }
        }
      }
    }
  },
  workOrder: {
    select: {
      id: true,
      woNumber: true,
      title: true,
      status: true
    }
  },
  reportedBy: { select: { id: true, firstName: true, lastName: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  resolvedBy: { select: { id: true, firstName: true, lastName: true } }
} as const;
