import {
  buildCreateFacilityIssuePayload,
  buildUpdateFacilityIssueRoomPayload,
  FACILITY_ISSUE_CREATE_PAYLOAD_KEYS,
  FACILITY_ISSUE_FORBIDDEN_PAYLOAD_KEYS,
  FACILITY_ISSUE_UI_EXPOSED_ACTIONS,
  filterBuildingsByProperty,
  filterFloorsByBuilding,
  filterIssuesByCategory,
  filterRoomsByFloor,
  formatFacilityIssueCategory,
  getFacilityIssueLocationLabel,
  normalizeFacilityIssueCategory,
  facilityIssuePayloadIncludesTenantId,
  issueRoomSelectionFromRow,
  roomSelectionToRoomId
} from "../../web/lib/facility-issue-ui";

describe("facility issue UI helpers", () => {
  it("builds legacy create payload without roomId", () => {
    const payload = buildCreateFacilityIssuePayload({
      title: "Broken light",
      description: "Corridor light flickering",
      severity: "MEDIUM",
      locationId: "loc-1"
    });

    expect(payload).toEqual({
      title: "Broken light",
      description: "Corridor light flickering",
      severity: "MEDIUM",
      locationId: "loc-1"
    });
    expect(payload).not.toHaveProperty("roomId");
    expect(payload).not.toHaveProperty("tenantId");
  });

  it("builds create payload with roomId and category but not tenantId", () => {
    const payload = buildCreateFacilityIssuePayload({
      title: "Leak",
      description: "Restroom leak",
      severity: "HIGH",
      roomId: "room-a",
      category: "PLUMBING"
    });

    expect(payload.roomId).toBe("room-a");
    expect(payload.category).toBe("PLUMBING");
    expect(facilityIssuePayloadIncludesTenantId(payload)).toBe(false);
  });

  it("ignores invalid category values safely", () => {
    const payload = buildCreateFacilityIssuePayload({
      title: "Test",
      description: "Test issue",
      severity: "LOW",
      category: "NOT_A_REAL_CATEGORY"
    });

    expect(payload).not.toHaveProperty("category");
    expect(normalizeFacilityIssueCategory("")).toBeUndefined();
    expect(normalizeFacilityIssueCategory("hvac")).toBe("HVAC");
  });

  it("maps clear room patch payload to null", () => {
    expect(buildUpdateFacilityIssueRoomPayload({ roomId: null, category: "" })).toEqual({
      roomId: null,
      category: null
    });
  });

  it("filters hierarchy selectors by parent ids", () => {
    const buildings = [
      { id: "b1", propertyId: "p1", isActive: true },
      { id: "b2", propertyId: "p2", isActive: true }
    ] as never;
    const floors = [
      { id: "f1", buildingId: "b1", isActive: true },
      { id: "f2", buildingId: "b2", isActive: true }
    ] as never;
    const rooms = [
      { id: "r1", floorId: "f1", isActive: true },
      { id: "r2", floorId: "f2", isActive: true }
    ] as never;

    expect(filterBuildingsByProperty(buildings, "p1")).toHaveLength(1);
    expect(filterFloorsByBuilding(floors, "b1")).toHaveLength(1);
    expect(filterRoomsByFloor(rooms, "f1")).toHaveLength(1);
  });

  it("prefers room label when room summary is present", () => {
    expect(
      getFacilityIssueLocationLabel({
        roomId: "room-a",
        roomName: "Room 101",
        location: { name: "Legacy Restroom" }
      })
    ).toBe("Room 101");
  });

  it("preserves legacy location label when room is absent", () => {
    expect(
      getFacilityIssueLocationLabel({
        roomId: null,
        roomName: null,
        location: { name: "Legacy Restroom" }
      })
    ).toBe("Legacy Restroom");
  });

  it("derives edit selection from issue row ids", () => {
    expect(
      issueRoomSelectionFromRow({
        propertyId: "p1",
        buildingId: "b1",
        floorId: "f1",
        roomId: "r1"
      })
    ).toEqual({
      propertyId: "p1",
      buildingId: "b1",
      floorId: "f1",
      roomId: "r1"
    });
  });

  it("filters issues by category client-side", () => {
    const rows = [
      { id: "1", category: "PLUMBING" },
      { id: "2", category: null },
      { id: "3", category: "PLUMBING" }
    ] as never;

    expect(filterIssuesByCategory(rows, "PLUMBING")).toHaveLength(2);
    expect(filterIssuesByCategory(rows, "ALL")).toHaveLength(3);
  });

  it("documents allowed create keys without forbidden payload fields", () => {
    expect(FACILITY_ISSUE_CREATE_PAYLOAD_KEYS).not.toContain("tenantId");
    expect(FACILITY_ISSUE_FORBIDDEN_PAYLOAD_KEYS).toContain("tenantId");
    expect(roomSelectionToRoomId({ roomId: "room-a" })).toBe("room-a");
    expect(roomSelectionToRoomId({ roomId: "" })).toBeUndefined();
  });

  it("does not expose QR/WO/photo actions in UI helper contract", () => {
    expect(FACILITY_ISSUE_UI_EXPOSED_ACTIONS.workOrderBridge).toBe(false);
    expect(FACILITY_ISSUE_UI_EXPOSED_ACTIONS.qrPublicScan).toBe(false);
    expect(FACILITY_ISSUE_UI_EXPOSED_ACTIONS.photoUpload).toBe(false);
  });

  it("formats category labels for display", () => {
    expect(formatFacilityIssueCategory("PEST_CONTROL")).toBe("Pest control");
    expect(formatFacilityIssueCategory(null)).toBe("");
  });
});
