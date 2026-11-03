"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

import { rowMenuPlacement } from "@/lib/row-menu-placement";

export type RowMenuAction = { label: string; href: string };

const MENU_WIDTH = 176;
const ITEM_HEIGHT = 44;

/**
 * "⋯" row menu rendered in a portal with fixed positioning, so table overflow / contain:paint
 * cannot clip it. Opens upward when the row sits near the bottom of the viewport.
 */
export function RowActionsMenu({ label, actions }: { label: string; actions: readonly RowMenuAction[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const place = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition(
      rowMenuPlacement({
        anchor: rect,
        menuWidth: MENU_WIDTH,
        menuHeight: actions.length * ITEM_HEIGHT + 8,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      })
    );
  }, [actions.length]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <MoreHorizontal aria-hidden size={18} />
      </button>
      {open && position
        ? createPortal(
            <div
              id={menuId}
              ref={menuRef}
              role="menu"
              onClick={(event) => event.stopPropagation()}
              style={{ position: "fixed", top: position.top, left: position.left, width: MENU_WIDTH }}
              className="z-50 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
            >
              {actions.map((action) => (
                <Link
                  key={action.label}
                  role="menuitem"
                  href={action.href as never}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center px-3 hover:bg-slate-50 focus-visible:bg-slate-50"
                >
                  {action.label}
                </Link>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
