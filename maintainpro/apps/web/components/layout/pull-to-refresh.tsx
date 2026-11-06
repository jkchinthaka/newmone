"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const TRIGGER_PX = 72;
const MAX_PULL_PX = 110;

function insideScrolledInner(target: EventTarget | null, main: HTMLElement) {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node !== main) {
    if (node.matches("[data-sheet], input, textarea, select, [role='dialog']")) return true;
    const overflowY = getComputedStyle(node).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollTop > 0) return true;
    node = node.parentElement;
  }
  return false;
}

/** Pull down at the top of the page on a phone to refresh the data on screen. */
export function PullToRefresh() {
  const queryClient = useQueryClient();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main || !window.matchMedia("(pointer: coarse)").matches) return undefined;

    const onStart = (event: TouchEvent) => {
      start.current =
        main.scrollTop <= 0 && !insideScrolledInner(event.target, main) ? event.touches[0].clientY : null;
    };
    const onMove = (event: TouchEvent) => {
      if (start.current === null) return;
      const delta = event.touches[0].clientY - start.current;
      if (delta <= 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      pullRef.current = Math.min(MAX_PULL_PX, delta * 0.5);
      setPull(pullRef.current);
    };
    const onEnd = async () => {
      const reached = pullRef.current >= TRIGGER_PX * 0.5 * 1.4;
      start.current = null;
      pullRef.current = 0;
      setPull(0);
      if (!reached) return;
      setBusy(true);
      try {
        await queryClient.refetchQueries({ type: "active" });
      } finally {
        setBusy(false);
      }
    };
    main.addEventListener("touchstart", onStart, { passive: true });
    main.addEventListener("touchmove", onMove, { passive: true });
    main.addEventListener("touchend", onEnd);
    main.addEventListener("touchcancel", onEnd);
    return () => {
      main.removeEventListener("touchstart", onStart);
      main.removeEventListener("touchmove", onMove);
      main.removeEventListener("touchend", onEnd);
      main.removeEventListener("touchcancel", onEnd);
    };
  }, [queryClient]);

  if (pull <= 0 && !busy) return null;
  const ready = pull >= TRIGGER_PX * 0.5 * 1.4;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-14 z-30 flex justify-center xl:hidden"
      style={{ transform: `translateY(${busy ? 12 : pull * 0.4}px)` }}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-brand-700 shadow-md">
        <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ready ? "text-brand-700" : "text-slate-400"}`} />
      </span>
    </div>
  );
}
