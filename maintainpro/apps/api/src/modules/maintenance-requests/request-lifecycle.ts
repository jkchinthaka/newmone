import { BadRequestException } from "@nestjs/common";
import { MaintenanceRequestStatus } from "@prisma/client";

const ACTIVE_STATUSES: MaintenanceRequestStatus[] = [
  MaintenanceRequestStatus.NEW,
  MaintenanceRequestStatus.UNDER_REVIEW,
  MaintenanceRequestStatus.NEEDS_INFORMATION,
  MaintenanceRequestStatus.APPROVED
];

export function isActiveRequestStatus(status: MaintenanceRequestStatus) {
  return ACTIVE_STATUSES.includes(status);
}

export function assertValidTransition(
  from: MaintenanceRequestStatus,
  to: MaintenanceRequestStatus
) {
  const allowed: Record<MaintenanceRequestStatus, MaintenanceRequestStatus[]> = {
    NEW: [
      MaintenanceRequestStatus.UNDER_REVIEW,
      MaintenanceRequestStatus.CANCELLED,
      MaintenanceRequestStatus.CLOSED
    ],
    UNDER_REVIEW: [
      MaintenanceRequestStatus.NEEDS_INFORMATION,
      MaintenanceRequestStatus.APPROVED,
      MaintenanceRequestStatus.CLOSED,
      MaintenanceRequestStatus.CANCELLED
    ],
    NEEDS_INFORMATION: [
      MaintenanceRequestStatus.UNDER_REVIEW,
      MaintenanceRequestStatus.CANCELLED,
      MaintenanceRequestStatus.CLOSED
    ],
    APPROVED: [MaintenanceRequestStatus.CONVERTED_TO_WO, MaintenanceRequestStatus.CANCELLED],
    REJECTED: [],
    CANCELLED: [],
    CLOSED: [],
    CONVERTED_TO_WO: []
  };

  if (!allowed[from]?.includes(to)) {
    throw new BadRequestException(`Illegal status transition: ${from} → ${to}`);
  }
}

export const DEFAULT_PROBLEM_CATEGORIES = [
  { code: "ELECTRICAL", name: "Electrical", sortOrder: 10 },
  { code: "MECHANICAL", name: "Mechanical", sortOrder: 20 },
  { code: "LEAK", name: "Leak", sortOrder: 30 },
  { code: "NO_POWER", name: "No Power", sortOrder: 40 },
  { code: "ABNORMAL_NOISE", name: "Abnormal Noise", sortOrder: 50 },
  { code: "TEMPERATURE", name: "Temperature", sortOrder: 60 },
  { code: "STRUCTURAL", name: "Structural", sortOrder: 70 },
  { code: "PLUMBING", name: "Plumbing", sortOrder: 80 },
  { code: "SAFETY", name: "Safety", sortOrder: 90 },
  { code: "VEHICLE", name: "Vehicle", sortOrder: 100 },
  { code: "OTHER", name: "Other", sortOrder: 999 }
] as const;

export function humanRequestStatus(status: MaintenanceRequestStatus): string {
  const labels: Record<MaintenanceRequestStatus, string> = {
    NEW: "New",
    UNDER_REVIEW: "Under Review",
    NEEDS_INFORMATION: "Needs Information",
    APPROVED: "Accepted",
    REJECTED: "Rejected (legacy)",
    CANCELLED: "Cancelled",
    CLOSED: "Closed",
    CONVERTED_TO_WO: "Converted to Work Order"
  };
  return labels[status] ?? status;
}

export function mapRejectionTypeToResolution(reasonType: string | null | undefined): string {
  switch (reasonType) {
    case "DUPLICATE":
      return "DUPLICATE";
    case "NOT_MAINTENANCE":
      return "NOT_MAINTENANCE";
    case "INVALID_REQUEST":
      return "INVALID";
    case "ALREADY_RESOLVED":
      return "RESOLVED_WITHOUT_WO";
    default:
      return "INVALID";
  }
}
