import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveGrantInvocation } from "./grant-v103-guard";

const prod = "sqlserver://localhost:1433;database=MaintainProProd;integratedSecurity=true;trustServerCertificate=true";

describe("v103 grant guard", () => {
  it("dry-runs by default and when --dry-run is set", () => {
    assert.deepEqual(resolveGrantInvocation([], prod), { ok: true, dryRun: true, database: "MaintainProProd" });
    assert.deepEqual(resolveGrantInvocation(["--dry-run"], prod), { ok: true, dryRun: true, database: "MaintainProProd" });
  });

  it("applies only when the confirm name matches exactly", () => {
    assert.equal(resolveGrantInvocation(["--apply"], prod).ok, false);
    assert.equal(resolveGrantInvocation(["--apply", "--confirm-database=maintainproprod"], prod).ok, false);
    assert.deepEqual(resolveGrantInvocation(["--apply", "--confirm-database=MaintainProProd"], prod), {
      ok: true,
      dryRun: false,
      database: "MaintainProProd"
    });
  });

  it("refuses nelna for dry-run and apply", () => {
    const nelna = "sqlserver://localhost:1433;database=nelna;integratedSecurity=true";
    assert.equal(resolveGrantInvocation([], nelna).ok, false);
    assert.equal(resolveGrantInvocation(["--apply", "--confirm-database=nelna"], "sqlserver://localhost;database=Nelna").ok, false);
  });

  it("refuses a missing database name and conflicting flags", () => {
    assert.equal(resolveGrantInvocation(["--apply", "--confirm-database=MaintainProProd"], "").ok, false);
    assert.equal(resolveGrantInvocation(["--dry-run", "--apply", "--confirm-database=MaintainProProd"], prod).ok, false);
  });
});
