"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

import { rowMenuPlacement } from "@/lib/row-menu-placement";

export type PortalRowMenuItem =
  | { label: string; href: string; onSelect?: never; danger?: boolean; disabled?: boolean }
  | { label: string; onSelect: () => void; href?: never; danger?: boolean; disabled?: boolean };

const MENU_WIDTH = 192;
const ITEM_HEIGHT = 44;

/**
 * Row "⋯" menu rendered in a portal with fixed positioning (same placement rules as the fleet
 * RowActionsMenu), so overflow-x-auto tables cannot clip it. Opens upward near the bottom of the screen.
 * Supports both links and button actions.
 */
export function PortalRowMenu({
  label,
  items,
  open: controlledOpen,
  onOpenChange
}: {
  label: string;
  items: readonly PortalRowMenuItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange]
  );
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
        menuHeight: items.length * ITEM_HEIGHT + 8,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      })
    );
  }, [items.length]);

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
  }, [open, setOpen]);

  const itemClass = (danger?: boolean) =>
    `flex min-h-11 w-full items-center px-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 disabled:opacity-50 ${danger ? "text-rose-700" : "text-slate-800"}`;

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
          setOpen(!open);
        }}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <MoreHorizontal aria-hidden size={18} />
      </button>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              id={menuId}
              ref={menuRef}
              role="menu"
              onClick={(event) => event.stopPropagation()}
              style={{ position: "fixed", top: position.top, left: position.left, width: MENU_WIDTH }}
              className="z-50 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
            >
              {items.map((item) =>
                item.href ? (
                  <Link key={item.label} role="menuitem" href={item.href as never} onClick={() => setOpen(false)} className={itemClass(item.danger)}>
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(false);
                      item.onSelect?.();
                    }}
                    className={itemClass(item.danger)}
                  >
                    {item.label}
                  </button>
                )
              )}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
