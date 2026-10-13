import assert from "node:assert/strict";
import test from "node:test";

import { dialogTabTrapDecision, stackedOverlayEscape, workOrderDrawerEscapeDecision } from "../overlay-dismiss";

test("escape closes the work-order drawer when nothing else owns the key", () => {
  assert.equal(
    workOrderDrawerEscapeDecision({
      key: "Escape",
      defaultPrevented: false,
      submitting: false,
      menuOpen: false,
      nestedOverlayOpen: false
    }),
    "close-drawer"
  );
});

test("escape closes the actions menu before the drawer", () => {
  assert.equal(
    workOrderDrawerEscapeDecision({
      key: "Escape",
      defaultPrevented: false,
      submitting: false,
      menuOpen: true,
      nestedOverlayOpen: false
    }),
    "close-menu"
  );
});

test("escape leaves a nested confirmation or a consumed picker event alone", () => {
  assert.equal(
    workOrderDrawerEscapeDecision({
      key: "Escape",
      defaultPrevented: false,
      submitting: false,
      menuOpen: false,
      nestedOverlayOpen: true
    }),
    "ignore"
  );
  assert.equal(
    workOrderDrawerEscapeDecision({
      key: "Escape",
      defaultPrevented: true,
      submitting: false,
      menuOpen: false,
      nestedOverlayOpen: false
    }),
    "ignore"
  );
  assert.equal(
    workOrderDrawerEscapeDecision({
      key: "Escape",
      defaultPrevented: false,
      submitting: true,
      menuOpen: false,
      nestedOverlayOpen: false
    }),
    "ignore"
  );
});

test("tab wraps inside a dialog and pulls focus back when it has left", () => {
  assert.equal(
    dialogTabTrapDecision({
      key: "Tab",
      shiftKey: false,
      activeInside: true,
      activeIsFirst: false,
      activeIsLast: true,
      focusableCount: 3
    }),
    "focus-first"
  );
  assert.equal(
    dialogTabTrapDecision({
      key: "Tab",
      shiftKey: true,
      activeInside: true,
      activeIsFirst: true,
      activeIsLast: false,
      focusableCount: 3
    }),
    "focus-last"
  );
  assert.equal(
    dialogTabTrapDecision({
      key: "Tab",
      shiftKey: false,
      activeInside: false,
      activeIsFirst: false,
      activeIsLast: false,
      focusableCount: 3
    }),
    "focus-first"
  );
  assert.equal(
    dialogTabTrapDecision({
      key: "Escape",
      shiftKey: false,
      activeInside: true,
      activeIsFirst: false,
      activeIsLast: true,
      focusableCount: 3
    }),
    "ignore"
  );
});

test("escape closes the command palette before the mobile drawer", () => {
  assert.equal(stackedOverlayEscape({ paletteOpen: true, drawerOpen: true }), "close-palette");
  assert.equal(stackedOverlayEscape({ paletteOpen: false, drawerOpen: true }), "close-drawer");
  assert.equal(stackedOverlayEscape({ paletteOpen: false, drawerOpen: false }), "ignore");
});
