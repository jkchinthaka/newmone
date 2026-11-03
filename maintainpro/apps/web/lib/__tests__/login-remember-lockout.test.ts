import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { rememberSignIn } from "../bff-proxy";
import {
  IT_HELP_DESK_URL,
  LOGIN_ATTEMPTS_BEFORE_LOCK,
  LOGIN_LOCKOUT_SECONDS,
  formatCountdown,
  formatLockLength,
  lockSecondsFromError,
  throttleSecondsFromError
} from "../support-links";

function fakeRequest(header?: string, cookie?: string) {
  return {
    headers: new Headers(header === undefined ? {} : { "x-remember-me": header }),
    cookies: {
      get: (name: string) =>
        name === "maintainpro_remember" && cookie !== undefined ? { name, value: cookie } : undefined
    }
  } as unknown as Parameters<typeof rememberSignIn>[0];
}

test("login follows the Keep me signed in box", () => {
  assert.equal(rememberSignIn(fakeRequest("1"), ["auth", "login"]), true);
  assert.equal(rememberSignIn(fakeRequest("0"), ["auth", "login"]), false);
  assert.equal(rememberSignIn(fakeRequest(), ["auth", "login"]), true);
});

test("later refreshes keep the choice made at sign-in", () => {
  assert.equal(rememberSignIn(fakeRequest(undefined, "0"), ["auth", "refresh"]), false);
  assert.equal(rememberSignIn(fakeRequest(undefined, "1"), ["work-orders"]), true);
  assert.equal(rememberSignIn(fakeRequest(), ["work-orders"]), true);
});

test("login page shows the help desk link, remember box and the 30s/1m/1m30s lock rule", () => {
  const page = readFileSync(path.resolve(__dirname, "../../app/(auth)/login/page.tsx"), "utf8");
  assert.equal(IT_HELP_DESK_URL, "https://nelna-helpdesk.southeastasia.cloudapp.azure.com/submit");
  assert.equal(LOGIN_ATTEMPTS_BEFORE_LOCK, 5);
  assert.deepEqual([...LOGIN_LOCKOUT_SECONDS], [30, 60, 90]);
  assert.deepEqual(LOGIN_LOCKOUT_SECONDS.map(formatLockLength), ["30 sec", "1 min", "1 min 30 sec"]);
  assert.match(page, /Sign in to MaintainPro/);
  assert.match(page, /Keep me signed in on this device/);
  assert.match(page, /"x-remember-me": values\.rememberMe \? "1" : "0"/);
  assert.match(page, /href=\{IT_HELP_DESK_URL\}/);
});

test("a locked account counts down instead of saying the password is wrong", () => {
  const page = readFileSync(path.resolve(__dirname, "../../app/(auth)/login/page.tsx"), "utf8");
  const locked = { response: { status: 429, data: { error: { code: "ACCOUNT_LOCKED", metadata: { retryAfterSeconds: 30 } } } } };
  assert.equal(lockSecondsFromError(locked), 30);
  assert.equal(lockSecondsFromError({ response: { status: 401, data: {} } }), null);
  assert.equal(lockSecondsFromError({ response: { status: 429, data: { error: { code: "RATE_LIMIT" } } } }), null);
  assert.equal(formatCountdown(27), "0:27");
  assert.equal(formatCountdown(90), "1:30");
  assert.match(page, /disabled=\{busy \|\| locked\}/);
  assert.match(page, /Try again in \{formatCountdown\(lockSecondsLeft\)\}/);
  assert.match(page, /rememberMe: false/);
});

test("too many tries from one device also counts down, using Retry-After", () => {
  assert.equal(throttleSecondsFromError({ response: { status: 429, headers: { "retry-after": "42" } } }), 42);
  assert.equal(throttleSecondsFromError({ response: { status: 429, headers: {} } }), 60);
  assert.equal(throttleSecondsFromError({ response: { status: 401 } }), null);
  const proxy = readFileSync(path.resolve(__dirname, "../bff-proxy.ts"), "utf8");
  assert.match(proxy, /responseHeaders\.set\("Retry-After", retryAfter\.trim\(\)\)/);
  const api = readFileSync(path.resolve(__dirname, "../../../api/src/modules/auth/auth.controller.ts"), "utf8");
  assert.match(api, /@Throttle\(\{ default: \{ limit: 20, ttl: 60000 \} \}\)\s*async login\(/);
});
