import { getApiErrorMessage } from "./api-client";
import { getBuilding, getFloor, getProperty, getRoom } from "./facilities-api";
import type { FacilityIssueRoomSelection } from "./facility-issue-ui";
import type { MaintainProQrPayload } from "./qr-readiness";
import {
  buildQrIssueReportFormContext,
  isQrIssueReportEntityType,
  type QrIssueReportFormContext
} from "./qr-issue-reporting";

export type QrIssueReportResolvedContext = QrIssueReportFormContext & {
  roomSelection: Partial<FacilityIssueRoomSelection>;
  hierarchyLabel: string;
};

export type QrIssueReportResolveResult =
  | { ok: true; context: QrIssueReportResolvedContext }
  | { ok: false; error: string };

export async function resolveQrIssueReportContext(
  payload: MaintainProQrPayload
): Promise<QrIssueReportResolveResult> {
  const base = buildQrIssueReportFormContext(payload);

  if (!base || !isQrIssueReportEntityType(payload.type)) {
    return { ok: false, error: "Unsupported QR context for issue reporting." };
  }

  try {
    if (payload.type === "room") {
      const room = await getRoom(payload.entityId);
      if (!room.isActive) {
        return { ok: false, error: "This room is inactive or unavailable." };
      }

      const floor = await getFloor(room.floorId);
      const building = await getBuilding(floor.buildingId);

      return {
        ok: true,
        context: {
          ...base,
          roomSelection: {
            propertyId: building.propertyId,
            buildingId: building.id,
            floorId: floor.id,
            roomId: room.id
          },
          hierarchyLabel: [room.name, floor.name, building.name].filter(Boolean).join(" · ")
        }
      };
    }

    if (payload.type === "floor") {
      const floor = await getFloor(payload.entityId);
      if (!floor.isActive) {
        return { ok: false, error: "This floor is inactive or unavailable." };
      }

      const building = await getBuilding(floor.buildingId);

      return {
        ok: true,
        context: {
          ...base,
          roomSelection: {
            propertyId: building.propertyId,
            buildingId: building.id,
            floorId: floor.id
          },
          hierarchyLabel: [floor.name, building.name].filter(Boolean).join(" · ")
        }
      };
    }

    if (payload.type === "building") {
      const building = await getBuilding(payload.entityId);
      if (!building.isActive) {
        return { ok: false, error: "This building is inactive or unavailable." };
      }

      return {
        ok: true,
        context: {
          ...base,
          roomSelection: {
            propertyId: building.propertyId,
            buildingId: building.id
          },
          hierarchyLabel: building.name
        }
      };
    }

    const property = await getProperty(payload.entityId);
    if (!property.isActive) {
      return { ok: false, error: "This property is inactive or unavailable." };
    }

    return {
      ok: true,
      context: {
        ...base,
        roomSelection: {
          propertyId: property.id
        },
        hierarchyLabel: property.name
      }
    };
  } catch (error) {
    return {
      ok: false,
      error: getApiErrorMessage(error, "Facility context is unavailable or not accessible.")
    };
  }
}
