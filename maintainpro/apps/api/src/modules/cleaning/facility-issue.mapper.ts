import {
  FacilityIssueCategory,
  FacilityIssueStatus,
  IssueSeverity
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

export function toPublicFacilityIssueResponse(issue: FacilityIssueGraph): PublicFacilityIssueResponse {
  const room = issue.room;

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
  reportedBy: { select: { id: true, firstName: true, lastName: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  resolvedBy: { select: { id: true, firstName: true, lastName: true } }
} as const;
