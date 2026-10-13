"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.hasAttribute("disabled") || element.getAttribute("aria-hidden") === "true") {
      return false;
    }
    if (element.tabIndex < 0) {
      return false;
    }
    return element.getClientRects().length > 0;
  });
}

type UseFocusTrapOptions = {
  onEscape?: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
};

type FocusTrapEvent = {
  key: string;
  shiftKey?: boolean;
  defaultPrevented?: boolean;
  preventDefault: () => void;
};

export type FocusTrapBinding = {
  activeElement: { focus?: () => void } | null;
  root: HTMLElement | null;
  body: { style: { overflow: string } };
  addKeydown: (listener: (event: FocusTrapEvent) => void) => void;
  removeKeydown: (listener: (event: FocusTrapEvent) => void) => void;
  requestFrame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
  getOnEscape: () => (() => void) | undefined;
  getInitialFocus: () => HTMLElement | null | undefined;
};

const scrollLocks = new WeakMap<object, { count: number; previous: string }>();
const trapStacks = new WeakMap<object, number[]>();
let trapSerial = 1;

function lockScroll(body: { style: { overflow: string } }) {
  let state = scrollLocks.get(body);
  if (!state) {
    state = { count: 0, previous: body.style.overflow };
    scrollLocks.set(body, state);
  }
  if (state.count === 0) state.previous = body.style.overflow;
  state.count += 1;
  body.style.overflow = "hidden";
}

function unlockScroll(body: { style: { overflow: string } }) {
  const state = scrollLocks.get(body);
  if (!state || state.count === 0) return;
  state.count -= 1;
  if (state.count === 0) body.style.overflow = state.previous;
}

function stackFor(body: object): number[] {
  let stack = trapStacks.get(body);
  if (!stack) {
    stack = [];
    trapStacks.set(body, stack);
  }
  return stack;
}

/** Locks scroll once for the outermost trap. Only the newest trap handles keys. */
export function attachFocusTrap(binding: FocusTrapBinding): () => void {
  if (!binding.root) {
    return () => {};
  }

  const id = trapSerial;
  trapSerial += 1;
  const stack = stackFor(binding.body);
  stack.push(id);
  lockScroll(binding.body);
  const previous = binding.activeElement;
  const root = binding.root;

  const focusInitial = () => {
    const initial = binding.getInitialFocus() ?? getFocusable(root)[0];
    initial?.focus();
  };

  const frame = binding.requestFrame(focusInitial);

  const onKeyDown = (event: FocusTrapEvent) => {
    if (stack[stack.length - 1] !== id) return;

    if (event.key === "Escape") {
      if (event.defaultPrevented) return;
      event.preventDefault();
      binding.getOnEscape()?.();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const items = getFocusable(root);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  binding.addKeydown(onKeyDown);

  return () => {
    const index = stack.indexOf(id);
    if (index >= 0) stack.splice(index, 1);
    binding.cancelFrame(frame);
    binding.removeKeydown(onKeyDown);
    unlockScroll(binding.body);
    previous?.focus?.();
  };
}

export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  options?: UseFocusTrapOptions
): void {
  const onEscapeRef = useRef(options?.onEscape);
  onEscapeRef.current = options?.onEscape;
  const initialFocusRef = options?.initialFocusRef;

  useEffect(() => {
    if (!active) {
      return;
    }

    return attachFocusTrap({
      activeElement: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      root: containerRef.current,
      body: document.body,
      addKeydown: (listener) => document.addEventListener("keydown", listener as unknown as EventListener),
      removeKeydown: (listener) => document.removeEventListener("keydown", listener as unknown as EventListener),
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (id) => window.cancelAnimationFrame(id),
      getOnEscape: () => onEscapeRef.current,
      getInitialFocus: () => initialFocusRef?.current
    });
  }, [active, containerRef, initialFocusRef]);
}
