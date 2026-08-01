import {
  buildSafeErpRequestPayload,
  buildSafeErpResponsePayload,
  sanitizeErpErrorCode,
  sanitizeErpErrorMessage
} from "../src/modules/inventory/erp-error-sanitize.util";

describe("erp-sync-safety", () => {
  it("sanitizes URLs and secrets from error messages", () => {
    const msg = sanitizeErpErrorMessage(
      "Failed https://erp.example/sync Authorization: Bearer super-secret-token user@corp.com"
    );
    expect(msg).not.toMatch(/https?:\/\//);
    expect(msg).not.toContain("super-secret-token");
    expect(msg).not.toContain("user@corp.com");
    expect(msg).toMatch(/redacted/);
  });

  it("sanitizes error codes", () => {
    expect(sanitizeErpErrorCode("ERP FAIL https://x")).toBe("ERP_FAIL");
  });

  it("stores only safe request/response payloads", () => {
    expect(
      buildSafeErpRequestPayload({
        poNumber: "PO-1",
        totalAmount: 12.5,
        lineCount: 2,
        note: "n"
      })
    ).toEqual({
      poNumber: "PO-1",
      totalAmount: 12.5,
      lineCount: 2,
      note: "n"
    });
    expect(buildSafeErpResponsePayload({ accepted: true, providerRef: "REF" })).toEqual({
      accepted: true,
      providerRef: "REF"
    });
  });
});