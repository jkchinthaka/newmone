"use client";

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";

import { EntityPicker } from "@/components/ui/entity-picker";
import { useEntitySearch } from "@/lib/use-entity-search";

export interface DepartmentOption extends Record<string, unknown> {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
}

export function DepartmentSelect({
  value,
  selectedName,
  onChange,
  label = "Department",
  placeholder = "Select Department",
  required,
  disabled,
  error,
  className
}: {
  value: string | null | undefined;
  selectedName?: string | null;
  onChange: (departmentId: string | null, department: DepartmentOption | null) => void;
  label?: string | null;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
}) {
  return (
    <div className={`block space-y-1 text-sm text-slate-700 ${className ?? ""}`}>
      {label ? (
        <span className="font-medium">
          {label} {required ? <span className="text-rose-500">*</span> : null}
        </span>
      ) : null}
      <EntityPicker<DepartmentOption>
        endpoint="/departments"
        value={value}
        initialDisplay={value ? selectedName ?? undefined : undefined}
        displayField="name"
        secondaryField="code"
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        extraParams={{ pageSize: 50 }}
        onChange={onChange}
      />
      {!value && selectedName ? (
        <p className="text-xs text-amber-700">Current legacy value: {selectedName}. Select a department to standardize it.</p>
      ) : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}


export function DepartmentMultiSelect({
  value,
  onChange,
  options,
  label = "Departments",
  placeholder = "Select Department",
  className
}: {
  value: string[];
  onChange: (departmentIds: string[]) => void;
  options?: Array<{ id: string; label: string }>;
  label?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { query, setQuery, results, loading, error } = useEntitySearch<DepartmentOption>({
    endpoint: "/departments",
    pageSize: 50
  });

  const fetchedOptions = results.map((department) => ({
    id: department.id,
    label: department.code ? `${department.name} (${department.code})` : department.name
  }));
  const sourceOptions = query.trim() || fetchedOptions.length > 0 ? fetchedOptions : options ?? [];
  const selectedOptions = useMemo(() => {
    const byId = new Map([...(options ?? []), ...fetchedOptions].map((option) => [option.id, option]));
    return value.map((id) => byId.get(id) ?? { id, label: id });
  }, [fetchedOptions, options, value]);

  const toggle = (departmentId: string) => {
    onChange(value.includes(departmentId) ? value.filter((id) => id !== departmentId) : [...value, departmentId]);
  };

  return (
    <div className={`relative space-y-1 text-xs font-medium text-slate-600 ${className ?? ""}`}>
      <span>{label}</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-800"
      >
        <span className="truncate">{selectedOptions.length ? `${selectedOptions.length} selected` : placeholder}</span>
        <Search size={15} className="shrink-0 text-slate-400" />
      </button>

      {selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => toggle(option.id)}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
            >
              <span className="truncate">{option.label}</span>
              <X size={12} />
            </button>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="absolute z-40 mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search departments..."
              className="w-full rounded-md border border-slate-200 py-2 pl-8 pr-3 text-sm text-slate-800 outline-none"
            />
          </div>
          <div className="mt-2 max-h-56 overflow-auto">
            {loading ? <p className="px-2 py-2 text-xs text-slate-500">Loading departments...</p> : null}
            {error ? <p className="px-2 py-2 text-xs text-rose-600">{error}</p> : null}
            {!loading && !error && sourceOptions.length === 0 ? <p className="px-2 py-2 text-xs text-slate-500">No departments found</p> : null}
            {sourceOptions.map((option) => {
              const selected = value.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggle(option.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm ${selected ? "bg-brand-50 text-brand-800" : "text-slate-700 hover:bg-slate-50"}`}
                >
                  <span className="truncate">{option.label}</span>
                  {selected ? <Check size={14} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}