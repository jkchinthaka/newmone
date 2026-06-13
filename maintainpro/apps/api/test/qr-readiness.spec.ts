import {
  createMaintainProQrPayload,
  encodeMaintainProQrPayload,
  isSupportedQrEntityType,
  parseMaintainProQrPayload,
  QrPayloadError,
  QR_ENTITY_TYPES,
  qrPayloadContainsForbiddenSecrets
} from "../../web/lib/qr-readiness";

describe("qr-readiness helper", () => {
  it("generates valid payloads for supported entity types", () => {
    for (const type of QR_ENTITY_TYPES) {
      const payload = createMaintainProQrPayload({
        type,
        entityId: "entity-123",
        tenantId: "tenant-abc",
        label: "Room 101"
      });

      expect(payload.v).toBe(1);
      expect(payload.type).toBe(type);
      expect(payload.entityId).toBe("entity-123");
      expect(payload.tenantId).toBe("tenant-abc");
      expect(payload.label).toBe("Room 101");
    }
  });

  it("round-trips encoded payloads", () => {
    const payload = createMaintainProQrPayload({
      type: "room",
      entityId: "room-42",
      createdAt: "2026-06-13T08:00:00.000Z"
    });

    const encoded = encodeMaintainProQrPayload(payload);
    const parsed = parseMaintainProQrPayload(encoded);

    expect(parsed).toEqual(payload);
  });

  it("rejects unsupported entity types", () => {
    expect(isSupportedQrEntityType("building")).toBe(true);
    expect(isSupportedQrEntityType("invoice")).toBe(false);

    expect(() =>
      parseMaintainProQrPayload(
        JSON.stringify({
          v: 1,
          type: "invoice",
          entityId: "x"
        })
      )
    ).toThrow(QrPayloadError);
  });

  it("rejects payloads with forbidden secret-like fields", () => {
    expect(() =>
      parseMaintainProQrPayload(
        JSON.stringify({
          v: 1,
          type: "asset",
          entityId: "asset-1",
          refreshToken: "secret"
        })
      )
    ).toThrow(QrPayloadError);

    expect(() =>
      parseMaintainProQrPayload(
        JSON.stringify({
          v: 1,
          type: "asset",
          entityId: "asset-1",
          token: "abc"
        })
      )
    ).toThrow(QrPayloadError);
  });

  it("does not allow auth tokens in generated payloads", () => {
    const payload = createMaintainProQrPayload({
      type: "work-order",
      entityId: "wo-1001",
      tenantId: "tenant-1"
    });

    expect(qrPayloadContainsForbiddenSecrets(payload)).toBe(false);
    expect(JSON.stringify(payload)).not.toMatch(/token|secret|password/i);
  });

  it("rejects invalid JSON and unsafe identifiers", () => {
    expect(() => parseMaintainProQrPayload("{bad json")).toThrow(QrPayloadError);
    expect(() =>
      createMaintainProQrPayload({
        type: "asset",
        entityId: "../escape"
      })
    ).toThrow(QrPayloadError);
  });
});
