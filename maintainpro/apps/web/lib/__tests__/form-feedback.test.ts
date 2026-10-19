import assert from "node:assert/strict";
import test from "node:test";

import { visibleFieldMessage } from "../form-feedback";

test("validation stays hidden until the field is touched or the form is submitted", () => {
  const message = "Estimated hours must be greater than 0.";
  assert.equal(visibleFieldMessage(message, { touched: false, submitAttempted: false }), "");
  assert.equal(visibleFieldMessage(message, { touched: true, submitAttempted: false }), message);
  assert.equal(visibleFieldMessage(message, { touched: false, submitAttempted: true }), message);
  assert.equal(visibleFieldMessage("", { touched: true, submitAttempted: true }), "");
});
