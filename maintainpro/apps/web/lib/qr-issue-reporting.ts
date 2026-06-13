import type { FacilityIssueRoomSelection } from "./facility-issue-ui";
import {
  createMaintainProQrPayload,
  encodeMaintainProQrPayload,
  parseMaintainProQrPayload,
  QrPayloadError,
  type MaintainProQrPayload,
  type QrEntityType
} from "./qr-readiness";

export const QR_ISSUE_REPORT_ROUTE = "/qr/report-issue" as const;

export const QR_ISSUE_REPORT_ENTITY_TYPES = ["property", "building", "floor", "room"] as const;

export type QrIssueReportEntityType = (typeof QR_ISSUE_REPORT_ENTITY_TYPES)[number];

export type QrIssueReportParseResult =
  | { ok: true; payload: MaintainProQrPayload }
  | { ok: false; error: string; code: "missing" | "invalid" | "unsupported" };

export type QrIssueReportFormContext = {
  payloadType: QrIssueReportEntityType;
  entityId: string;
  label: string | null;
  roomSelection: Partial<FacilityIssueRoomSelection>;
  requiresRoomSelection: boolean;
  contextSummary: string;
};

export function isQrIssueReportEntityType(value: QrEntityType): value is QrIssueReportEntityType {
  return (QR_ISSUE_REPORT_ENTITY_TYPES as readonly string[]).includes(value);
}

export function createQrIssueReportPayload(input: {
  type: QrIssueReportEntityType;
  entityId: string;
  label?: string;
}): MaintainProQrPayload {
  return createMaintainProQrPayload({
    type: input.type,
    entityId: input.entityId,
    label: input.label,
    createdAt: new Date().toISOString()
  });
}

export function buildQrIssueReportPath(payload: MaintainProQrPayload): string {
  const encoded = encodeMaintainProQrPayload(payload);
  return `${QR_ISSUE_REPORT_ROUTE}?qr=${encodeURIComponent(encoded)}`;
}

export function buildQrIssueReportAbsoluteUrl(origin: string, payload: MaintainProQrPayload): string {
  const path = buildQrIssueReportPath(payload);
  return `${origin.replace(/\/$/, "")}${path}`;
}

export function parseQrIssueReportQueryParam(raw: string | null | undefined): QrIssueReportParseResult {
  if (!raw?.trim()) {
    return { ok: false, error: "Missing QR payload.", code: "missing" };
  }

  try {
    const payload = parseMaintainProQrPayload(decodeURIComponent(raw.trim()));

    if (!isQrIssueReportEntityType(payload.type)) {
      return {
        ok: false,
        error: "This QR link is not configured for facility issue reporting.",
        code: "unsupported"
      };
    }

    return { ok: true, payload };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof QrPayloadError ? error.message : "Invalid QR payload.",
      code: "invalid"
    };
  }
}

export function qrIssueReportPayloadIgnoresTenantId(payload: MaintainProQrPayload): boolean {
  return payload.tenantId === undefined;
}

export function buildQrIssueReportFormContext(payload: MaintainProQrPayload): QrIssueReportFormContext | null {
  if (!isQrIssueReportEntityType(payload.type)) {
    return null;
  }

  const label = payload.label?.trim() || null;

  switch (payload.type) {
    case "room":
      return {
        payloadType: "room",
        entityId: payload.entityId,
        label,
        roomSelection: { roomId: payload.entityId },
        requiresRoomSelection: false,
        contextSummary: label ? `Room: ${label}` : "Room from QR"
      };
    case "floor":
      return {
        payloadType: "floor",
        entityId: payload.entityId,
        label,
        roomSelection: { floorId: payload.entityId },
        requiresRoomSelection: true,
        contextSummary: label ? `Floor: ${label}` : "Floor from QR — select a room"
      };
    case "building":
      return {
        payloadType: "building",
        entityId: payload.entityId,
        label,
        roomSelection: { buildingId: payload.entityId },
        requiresRoomSelection: true,
        contextSummary: label ? `Building: ${label}` : "Building from QR — select a room"
      };
    case "property":
      return {
        payloadType: "property",
        entityId: payload.entityId,
        label,
        roomSelection: { propertyId: payload.entityId },
        requiresRoomSelection: true,
        contextSummary: label ? `Property: ${label}` : "Property from QR — select a room"
      };
    default:
      return null;
  }
}

export function canCopyFacilitiesQrIssueLink(input: {
  level: QrIssueReportEntityType | "property" | "building" | "floor" | "room";
  canViewFacilities: boolean;
  canManageFacilities: boolean;
}): boolean {
  if (!input.canViewFacilities) {
    return false;
  }

  if (input.level === "room") {
    return input.canManageFacilities;
  }

  return input.canManageFacilities;
}
