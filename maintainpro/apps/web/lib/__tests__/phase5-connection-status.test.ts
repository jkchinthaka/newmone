import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { connectionMessage } from "../../components/pwa/connection-status";

test("connection message is silent when online with nothing waiting", () => {
  assert.equal(connectionMessage(false, 0), null);
});

test("connection message says saved reports will be sent when offline", () => {
  assert.match(connectionMessage(true, 0) ?? "", /still report a problem/);
  assert.match(connectionMessage(true, 1) ?? "", /1 report is saved/);
  assert.match(connectionMessage(true, 3) ?? "", /3 reports are saved/);
});

test("connection message shows sending progress when back online", () => {
  assert.equal(connectionMessage(false, 2), "Sending 2 saved reports...");
});

test("dashboard layout mounts the connection strip above the page", () => {
  const layout = readFileSync(path.resolve(__dirname, "../../app/(dashboard)/layout.tsx"), "utf8").replace(/\r\n/g, "\n");
  assert.match(layout, /<ConnectionStatus \/>\n\s+<main id="main-content"/);
});
