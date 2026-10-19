import assert from "node:assert/strict";
import { test } from "node:test";

import { JOB_CHANGED_MESSAGE, classifyJobActionError } from "../job-action-outcome";

test("a 409 is a conflict that refreshes the job", () => {
  assert.equal(classifyJobActionError({ response: { status: 409 } }), "conflict");
  assert.equal(JOB_CHANGED_MESSAGE, "This job was changed by someone else — refreshed");
});

test("an unreachable server offers retry", () => {
  assert.equal(
    classifyJobActionError({ response: { status: 503, data: { error: { code: "UPSTREAM_UNAVAILABLE" } } } }),
    "unavailable"
  );
});

test("a missing version (400) is a plain error, not a conflict", () => {
  assert.equal(classifyJobActionError({ response: { status: 400 } }), "error");
});
