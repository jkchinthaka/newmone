import {
  buildQrIssueReportAbsoluteUrl,
  buildQrIssueReportFormContext,
  buildQrIssueReportPath,
  canCopyFacilitiesQrIssueLink,
  createQrIssueReportPayload,
  parseQrIssueReportQueryParam,
  QR_ISSUE_REPORT_ROUTE,
  qrIssueReportPayloadIgnoresTenantId
} from "../../web/lib/qr-issue-reporting";
import { parseMaintainProQrPayload, QrPayloadError } from "../../web/lib/qr-readiness";

describe("qr issue reporting helpers", () => {
  it("creates room QR payload without tenantId", () => {
    const payload = createQrIssueReportPayload({
      type: "room",
      entityId: "room-101",
      label: "Room 101"
    });

    expect(payload.type).toBe("room");
    expect(payload.entityId).toBe("room-101");
    expect(payload.tenantId).toBeUndefined();
    expect(qrIssueReportPayloadIgnoresTenantId(payload)).toBe(true);
  });

  it("builds authenticated report path with encoded payload", () => {
    const payload = createQrIssueReportPayload({
      type: "room",
      entityId: "room-abc",
      label: "Restroom A"
    });
    const path = buildQrIssueReportPath(payload);

    expect(path.startsWith(`${QR_ISSUE_REPORT_ROUTE}?qr=`)).toBe(true);
    const query = path.split("?qr=")[1] ?? "";
    const parsed = parseQrIssueReportQueryParam(query);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.payload.entityId).toBe("room-abc");
      expect(parsed.payload.type).toBe("room");
    }
  });

  it("builds absolute authenticated URLs for QR images", () => {
    const payload = createQrIssueReportPayload({
      type: "room",
      entityId: "room-abc"
    });

    expect(buildQrIssueReportAbsoluteUrl("https://app.example.com", payload)).toContain(
      "https://app.example.com/qr/report-issue?qr="
    );
  });

  it("rejects secret/token fields in QR query payloads", () => {
    expect(() =>
      parseMaintainProQrPayload(
        JSON.stringify({
          v: 1,
          type: "room",
          entityId: "room-1",
          refreshToken: "secret"
        })
      )
    ).toThrow(QrPayloadError);

    const result = parseQrIssueReportQueryParam(
      encodeURIComponent(
        JSON.stringify({
          v: 1,
          type: "room",
          entityId: "room-1",
          accessToken: "abc"
        })
      )
    );

    expect(result.ok).toBe(false);
  });

  it("rejects unsupported QR entity types for issue reporting", () => {
    const encoded = encodeURIComponent(
      JSON.stringify({
        v: 1,
        type: "work-order",
        entityId: "wo-1"
      })
    );

    const result = parseQrIssueReportQueryParam(encoded);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("unsupported");
    }
  });

  it("returns safe error model for missing or invalid payloads", () => {
    const missing = parseQrIssueReportQueryParam(null);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.code).toBe("missing");
    }

    const invalid = parseQrIssueReportQueryParam("%7Bbad");
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.code).toBe("invalid");
    }
  });

  it("builds form context for room and parent hierarchy types", () => {
    const roomContext = buildQrIssueReportFormContext(
      createQrIssueReportPayload({ type: "room", entityId: "room-1", label: "Room 101" })
    );
    expect(roomContext?.requiresRoomSelection).toBe(false);
    expect(roomContext?.roomSelection.roomId).toBe("room-1");

    const floorContext = buildQrIssueReportFormContext(
      createQrIssueReportPayload({ type: "floor", entityId: "floor-1" })
    );
    expect(floorContext?.requiresRoomSelection).toBe(true);
    expect(floorContext?.roomSelection.floorId).toBe("floor-1");
  });

  it("gates facilities QR link copy to manage roles only", () => {
    expect(
      canCopyFacilitiesQrIssueLink({
        level: "room",
        canViewFacilities: true,
        canManageFacilities: true
      })
    ).toBe(true);
    expect(
      canCopyFacilitiesQrIssueLink({
        level: "room",
        canViewFacilities: true,
        canManageFacilities: false
      })
    ).toBe(false);
  });
});

describe("qr issue reporting route security", () => {
  it("does not add a public unauthenticated route constant", () => {
    expect(QR_ISSUE_REPORT_ROUTE.startsWith("/qr/report-issue")).toBe(true);
    expect(QR_ISSUE_REPORT_ROUTE.startsWith("/public")).toBe(false);
  });
});
