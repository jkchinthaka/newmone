import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PASSWORD_CHANGE_PATH,
  isOnPasswordChangeScreen,
  isPasswordChangeRequiredError,
  passwordStrengthError,
  postLoginDestination
} from "../password-change-required";

describe("password change required", () => {
  it("recognises the API's 403 PASSWORD_CHANGE_REQUIRED response only", () => {
    assert.equal(
      isPasswordChangeRequiredError({ response: { status: 403, data: { error: { code: "PASSWORD_CHANGE_REQUIRED" } } } }),
      true
    );
    assert.equal(isPasswordChangeRequiredError({ response: { status: 403, data: { error: { code: "FORBIDDEN" } } } }), false);
    assert.equal(
      isPasswordChangeRequiredError({ response: { status: 401, data: { error: { code: "PASSWORD_CHANGE_REQUIRED" } } } }),
      false
    );
    assert.equal(isPasswordChangeRequiredError(null), false);
  });

  it("sends a user with a temporary password to the password screen first after login", () => {
    assert.equal(postLoginDestination({ mustChangePassword: true }, "/work-orders"), PASSWORD_CHANGE_PATH);
    assert.equal(postLoginDestination({ mustChangePassword: false }, "/work-orders"), "/work-orders");
    assert.equal(postLoginDestination(undefined, "/"), "/");
  });

  it("detects the password screen to avoid redirect loops", () => {
    assert.equal(isOnPasswordChangeScreen("/settings", "?tab=security"), true);
    assert.equal(isOnPasswordChangeScreen("/settings", "?tab=profile"), false);
    assert.equal(isOnPasswordChangeScreen("/work-orders", "?tab=security"), false);
  });

  it("matches the API password strength rule", () => {
    assert.equal(passwordStrengthError("password"), "Use at least 8 characters with an uppercase letter, a number and a symbol.");
    assert.equal(passwordStrengthError("Str0ng!pw"), null);
  });
});
