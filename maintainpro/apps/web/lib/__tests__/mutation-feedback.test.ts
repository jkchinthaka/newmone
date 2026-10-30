import assert from "node:assert/strict";
import { test } from "node:test";

import { mutationErrorMessage } from "../mutation-feedback";

test("an unreachable server says the change was not saved", () => {
  const error = { response: { status: 503, data: { error: { code: "UPSTREAM_UNAVAILABLE", message: "x" } } } };
  assert.equal(
    mutationErrorMessage(error, "fallback"),
    "Server is restarting or unreachable. Your change was not saved — please try again."
  );
  assert.equal(
    mutationErrorMessage({ code: "ERR_NETWORK" }, "fallback"),
    "Server is restarting or unreachable. Your change was not saved — please try again."
  );
});

test("other errors keep the server message", () => {
  const conflict = { response: { status: 409, data: { error: { message: "Job was updated by someone else." } } } };
  assert.equal(mutationErrorMessage(conflict, "fallback"), "Job was updated by someone else.");
});
