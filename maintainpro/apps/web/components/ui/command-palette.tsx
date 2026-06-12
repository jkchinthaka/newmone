"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";

import type { CommandPaletteItem } from "@/lib/command-palette";

export type CommandPaletteProps = {
  open: boolean;
  items: readonly CommandPaletteItem[];
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onSelect: (item: CommandPaletteItem) => void;
};

export function CommandPalette({
  open,
  items,
  query,
  onQueryChange,
  onClose,
  onSelect
}: CommandPaletteProps) {
  const titleId = useId();
  const descriptionId = useId();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveIndex(0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, items.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (items.length === 0) {
          return;
        }
        setActiveIndex((current) => (current + 1) % items.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (items.length === 0) {
          return;
        }
        setActiveIndex((current) => (current - 1 + items.length) % items.length);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const selected = items[activeIndex];
        if (selected) {
          onSelect(selected);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, items, activeIndex, onClose, onSelect]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center bg-slate-950/45 p-4 pt-[max(1rem,10vh)] sm:pt-[12vh]">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative flex max-h-[min(80vh,32rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
      >
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="sr-only" id={titleId}>
            Command palette
          </h2>
          <p className="sr-only" id={descriptionId}>
            Search modules and navigate to an allowed page. Use arrow keys to move, Enter to open,
            Escape to close.
          </p>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <Search aria-hidden className="h-4 w-4 shrink-0 text-slate-500" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              aria-controls={listboxId}
              aria-label="Search modules and pages"
              autoComplete="off"
              placeholder="Search modules, pages, or keywords..."
              onChange={(event) => onQueryChange(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:outline-none"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500" role="status">
              No matching modules for your role. Try another search term.
            </p>
          ) : (
            <ul id={listboxId} role="listbox" aria-label="Navigation commands" className="space-y-1">
              {items.map((item, index) => {
                const active = index === activeIndex;

                return (
                  <li key={item.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => onSelect(item)}
                      className={`flex min-h-11 w-full flex-col items-start rounded-xl px-3 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                        active ? "bg-brand-50 text-brand-900 ring-1 ring-brand-200" : "text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="font-medium">{item.label}</span>
                        <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          {item.category}
                        </span>
                      </span>
                      <span className="mt-0.5 text-xs text-slate-500">{item.description}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
