import assert from "node:assert/strict";
import test from "node:test";

import { attachFocusTrap } from "../use-focus-trap";

function host() {
  const listeners = new Set<(event: { key: string; shiftKey?: boolean; defaultPrevented?: boolean; preventDefault: () => void }) => void>();
  const body = { style: { overflow: "" } };
  const previous = { focused: 0, focus() { previous.focused += 1; } };
  return {
    body,
    previous,
    listeners,
    binding(root: HTMLElement | null, getOnEscape: () => (() => void) | undefined) {
      return {
        activeElement: previous,
        root,
        body,
        addKeydown: (listener: (event: { key: string; preventDefault: () => void }) => void) => listeners.add(listener),
        removeKeydown: (listener: (event: { key: string; preventDefault: () => void }) => void) => listeners.delete(listener),
        requestFrame: (callback: () => void) => {
          callback();
          return 1;
        },
        cancelFrame: () => {},
        getOnEscape,
        getInitialFocus: () => null
      };
    }
  };
}

test("a missing trap root does not lock page scrolling", () => {
  const page = host();
  const release = attachFocusTrap(page.binding(null, () => () => {}));
  assert.equal(page.body.style.overflow, "");
  release();
  assert.equal(page.body.style.overflow, "");
  assert.equal(page.previous.focused, 0);
});

test("escape uses the latest close callback and then restores focus and scrolling", () => {
  const page = host();
  const calls: string[] = [];
  let close = () => calls.push("first");
  const root = { querySelectorAll: () => [] } as unknown as HTMLElement;
  const release = attachFocusTrap(page.binding(root, () => close));
  assert.equal(page.body.style.overflow, "hidden");
  close = () => calls.push("latest");
  const event = { key: "Escape", preventDefault() { event.defaultPrevented = true; }, defaultPrevented: false };
  for (const listener of page.listeners) listener(event);
  assert.deepEqual(calls, ["latest"]);
  release();
  assert.equal(page.body.style.overflow, "");
  assert.equal(page.previous.focused, 1);
  assert.equal(page.listeners.size, 0);
  for (const listener of page.listeners) listener(event);
  assert.deepEqual(calls, ["latest"]);
});

test("the newest trap handles escape and scrolling survives closing either trap first", () => {
  const page = host();
  const calls: string[] = [];
  const root = { querySelectorAll: () => [] } as unknown as HTMLElement;
  const outerFocus = { n: 0, focus() { outerFocus.n += 1; } };
  const innerFocus = { n: 0, focus() { innerFocus.n += 1; } };
  const outer = attachFocusTrap({
    ...page.binding(root, () => () => calls.push("editor")),
    activeElement: outerFocus
  });
  const inner = attachFocusTrap({
    ...page.binding(root, () => () => calls.push("confirm")),
    activeElement: innerFocus
  });
  const press = () => {
    const event = { key: "Escape", defaultPrevented: false, preventDefault() { event.defaultPrevented = true; } };
    for (const listener of [...page.listeners]) listener(event);
  };
  press();
  assert.deepEqual(calls, ["confirm"]);
  inner();
  assert.equal(innerFocus.n, 1);
  assert.equal(outerFocus.n, 0);
  assert.equal(page.body.style.overflow, "hidden");
  press();
  assert.deepEqual(calls, ["confirm", "editor"]);
  outer();
  assert.equal(outerFocus.n, 1);
  assert.equal(page.body.style.overflow, "");
  assert.equal(page.listeners.size, 0);

  const againOuter = attachFocusTrap(page.binding(root, () => () => calls.push("drawer")));
  const againInner = attachFocusTrap(page.binding(root, () => () => calls.push("palette")));
  againOuter();
  assert.equal(page.body.style.overflow, "hidden");
  againInner();
  assert.equal(page.body.style.overflow, "");
  press();
  assert.deepEqual(calls, ["confirm", "editor"]);
});
