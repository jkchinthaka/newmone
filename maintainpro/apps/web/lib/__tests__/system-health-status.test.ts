import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDisplayCheckStatus } from "../system-health-status";

describe("System Health disabled-service status", () => {
  it("never shows a disabled replication as operational", () => {
    assert.equal(
      resolveDisplayCheckStatus({ status: "operational", details: { enabled: false, mode: "disabled", configured: true } }),
      "disabled"
    );
  });

  it("shows Not configured when the disabled service has no configuration", () => {
    assert.equal(
      resolveDisplayCheckStatus({ status: "operational", details: { enabled: false, configured: false } }),
      "unconfigured"
    );
  });

  it("keeps real statuses unchanged", () => {
    assert.equal(resolveDisplayCheckStatus({ status: "operational", details: { enabled: true, mode: "async_outbox" } }), "operational");
    assert.equal(resolveDisplayCheckStatus({ status: "degraded", details: { enabled: false } }), "degraded");
    assert.equal(resolveDisplayCheckStatus({ status: "disabled" }), "disabled");
  });
});
