"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";

type TableToolbarProps = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  children?: ReactNode;
  className?: string;
};

export function TableToolbar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search rows...",
  searchAriaLabel = "Search table rows",
  children,
  className = ""
}: TableToolbarProps) {
  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${className}`.trim()}
    >
      {onSearchChange ? (
        <label className="relative block min-w-0 flex-1 sm:max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
        </label>
      ) : null}
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
