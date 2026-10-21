import assert from "node:assert/strict";
import test from "node:test";

import { isCommandPaletteShortcut } from "../command-palette";

test("a keydown with no key is not the command palette shortcut", () => {
  assert.equal(
    isCommandPaletteShortcut({
      key: undefined,
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false
    }),
    false
  );
});

test("ctrl+k still opens the command palette", () => {
  assert.equal(
    isCommandPaletteShortcut({
      key: "k",
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false
    }),
    true
  );
});
