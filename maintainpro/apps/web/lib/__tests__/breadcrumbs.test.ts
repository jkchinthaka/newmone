import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveBreadcrumbItems } from "../breadcrumbs";

describe("dashboard breadcrumbs", () => {
  it("names the canonical home and module routes", () => {
    assert.deepEqual(resolveBreadcrumbItems("/action-center"), [{ label: "Home" }]);
    assert.deepEqual(resolveBreadcrumbItems("/requests"), [{ label: "Requests" }]);
    assert.equal(resolveBreadcrumbItems("/assets")[0]?.label, "Assets");
  });

  it("returns no crumbs for an unknown path instead of inventing a destination", () => {
    assert.deepEqual(resolveBreadcrumbItems("/not-a-real-module"), []);
  });
});
