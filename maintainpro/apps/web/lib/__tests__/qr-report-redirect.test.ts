import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildQrReportIssueRedirect } from "../qr-report-redirect";

describe("QR report entry", () => {
  it("keeps internal target context and lands on the report form", () => {
    assert.equal(
      buildQrReportIssueRedirect({ assetTag: "AST-1001", assetId: "asset-1" }),
      "/requests/new?assetTag=AST-1001&assetId=asset-1"
    );
  });

  it("drops external and redirect-shaped input", () => {
    const path = buildQrReportIssueRedirect({
      assetTag: "AST-1001",
      next: "https://evil.example/phish",
      returnTo: "//evil.example",
      redirect: "https://evil.example",
      url: "javascript:alert(1)",
      assetId: "https://evil.example/asset"
    });
    assert.equal(path, "/requests/new?assetTag=AST-1001");
    assert.equal(path.includes("evil"), false);
    assert.equal(path.includes("javascript"), false);
  });

  it("still redirects when no context is supplied", () => {
    assert.equal(buildQrReportIssueRedirect({ next: "https://evil.example" }), "/requests/new");
  });
});
