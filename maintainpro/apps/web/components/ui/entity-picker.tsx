"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Search, X } from "lucide-react";
import { useEntitySearch } from "@/lib/use-entity-search";

export interface EntityPickerProps<T extends Record<string, unknown>> {
  /** API endpoint that returns a paginated list and supports `?q=`. */
  endpoint: string;
  /** Selected entity id (FK value stored on the parent form). */
  value: string | null | undefined;
  /**
   * Called when the user selects an option or clears the field.
   * `entity` is null when cleared, otherwise the full row from the API so the
   * parent can also persist a denormalized text snapshot if it wants to.
   */
  onChange: (id: string | null, entity: T | null) => void;
  /** Property used as the primary visible label (e.g. "registrationNo"). */
  displayField: keyof T & string;
  /** Optional secondary label (e.g. "vehicleModel" or "make"). */
  secondaryField?: keyof T & string;
  /** Property holding the entity id. Defaults to "id". */
  idField?: keyof T & string;
  /** Query string parameter for free-text search. Defaults to "q". */
  searchParam?: string;
  /** Extra filter params forwarded to the endpoint. */
  extraParams?: Record<string, string | number | boolean | undefined>;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /**
   * If provided, the dropdown shows a "+ Create new" action when no result
   * matches the typed query. The callback receives the current query.
   */
  onCreateNew?: (query: string) => void;
  /**
   * Optional preloaded display text for the current `value`. Use this when
   * editing an existing record so the input shows the linked entity without
   * an extra fetch.
   */
  initialDisplay?: string;
  /** Optional className appended to the input wrapper. */
  className?: string;
}

/**
 * Reusable searchable dropdown / combobox that pulls master-data from a REST
 * endpoint. Used everywhere the user previously had to type a free-text id
 * or name (vehicles, drivers, technicians, assets, parts, suppliers, ...).
 */
export function EntityPicker<T extends Record<string, unknown>>(props: EntityPickerProps<T>) {
  const {
    endpoint,
    value,
    onChange,
    displayField,
    secondaryField,
    idField = "id" as keyof T & string,
    searchParam = "q",
    extraParams,
    placeholder = "Search...",
    required,
    disabled,
    onCreateNew,
    initialDisplay,
    className
  } = props;

  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>(initialDisplay ?? "");
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  const { query, setQuery, results, loading, error } = useEntitySearch<T>({
    endpoint,
    searchParam,
    extraParams
  });

  // Keep the input text in sync when the parent clears the value externally.
  useEffect(() => {
    if (!value) {
      setSelectedLabel("");
    } else if (initialDisplay) {
      setSelectedLabel(initialDisplay);
    }
  }, [value, initialDisplay]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reset highlight when results change.
  useEffect(() => {
    setActiveIndex(0);
  }, [results.length]);

  const showCreateOption = useMemo(() => {
    if (!onCreateNew) return false;
    const trimmed = query.trim();
    if (trimmed.length === 0) return false;
    if (loading) return false;
    return results.length === 0;
  }, [onCreateNew, query, results.length, loading]);

  const handleSelect = (entity: T) => {
    const id = String(entity[idField] ?? "");
    const label = String(entity[displayField] ?? "");
    setSelectedLabel(label);
    setQuery("");
    setOpen(false);
    onChange(id || null, entity);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setSelectedLabel("");
    setQuery("");
    onChange(null, null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      if (open && results[activeIndex]) {
        event.preventDefault();
        handleSelect(results[activeIndex]);
      } else if (open && showCreateOption && onCreateNew) {
        event.preventDefault();
        onCreateNew(query.trim());
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  // The visible value: either the typed query while searching, or the saved label.
  const inputValue = open ? query : selectedLabel;

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ""}`}>
      <div
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition focus-within:ring-4 focus-within:ring-brand-100 ${
          disabled ? "border-slate-200 bg-slate-50" : "border-slate-300 bg-white focus-within:border-brand-400"
        }`}
      >
        <Search size={14} className="shrink-0 text-slate-400" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          required={required && !value}
          disabled={disabled}
          value={inputValue}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setOpen(true);
            setQuery(event.target.value);
            // If the user starts typing again, treat it as clearing the saved label
            // until they pick a new option or hit clear.
            if (selectedLabel) {
              setSelectedLabel("");
              onChange(null, null);
            }
          }}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
        {loading ? (
          <Loader2 size={14} className="shrink-0 animate-spin text-slate-400" aria-hidden />
        ) : value ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Clear selection"
            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={14} aria-hidden />
          </button>
        ) : (
          <ChevronDown size={14} className="shrink-0 text-slate-400" aria-hidden />
        )}
      </div>

      {open && !disabled && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {error && (
            <li className="px-3 py-2 text-xs text-rose-600" role="alert">
              {error}
            </li>
          )}
          {!error && results.length === 0 && !loading && !showCreateOption && (
            <li className="px-3 py-2 text-xs text-slate-500">
              {query.trim() ? "No matches found" : "Start typing to search..."}
            </li>
          )}
          {results.map((entity, index) => {
            const id = String(entity[idField] ?? index);
            const primary = String(entity[displayField] ?? "");
            const secondary = secondaryField ? String(entity[secondaryField] ?? "") : "";
            const isActive = index === activeIndex;
            return (
              <li
                key={id}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  // mousedown so it fires before input blur swallows the click
                  event.preventDefault();
                  handleSelect(entity);
                }}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${
                  isActive ? "bg-brand-50 text-brand-900" : "text-slate-700"
                }`}
              >
                <span className="truncate font-medium">{primary || "(unnamed)"}</span>
                {secondary && <span className="truncate text-xs text-slate-500">{secondary}</span>}
              </li>
            );
          })}
          {showCreateOption && onCreateNew && (
            <li
              role="option"
              aria-selected={false}
              onMouseDown={(event) => {
                event.preventDefault();
                onCreateNew(query.trim());
              }}
              className="cursor-pointer border-t border-slate-100 px-3 py-2 text-sm text-brand-600 hover:bg-brand-50"
            >
              + Create new “{query.trim()}”
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
