import assert from "node:assert/strict";
import test from "node:test";

import { approveThenAssign, verifyThenClose } from "../wo-flow-phase2";

test("approve and assign runs in order and keeps the approval when assign fails", async () => {
  const calls: string[] = [];
  const ok = await approveThenAssign({
    approve: async () => {
      calls.push("approve");
    },
    assign: async () => {
      calls.push("assign");
    }
  });
  assert.deepEqual(ok, { ok: true });
  assert.deepEqual(calls, ["approve", "assign"]);

  const failed = await approveThenAssign({
    approve: async () => {
      calls.push("approve-2");
    },
    assign: async () => {
      throw new Error("technician unavailable");
    }
  });
  assert.equal(failed.ok, false);
  if (!failed.ok && failed.stage === "assign") {
    assert.equal(failed.kept, true);
    assert.equal((failed.error as Error).message, "technician unavailable");
  } else {
    assert.fail("assign failure should be reported after approval");
  }
  assert.deepEqual(calls, ["approve", "assign", "approve-2"]);
});

test("verify and close keeps verification when close fails, and send back is not called", async () => {
  const calls: string[] = [];
  const failed = await verifyThenClose({
    verify: async () => {
      calls.push("verify");
    },
    close: async () => {
      throw new Error("close blocked");
    }
  });
  assert.equal(failed.ok, false);
  if (!failed.ok && failed.stage === "close") assert.equal(failed.kept, true);
  assert.deepEqual(calls, ["verify"]);
});
