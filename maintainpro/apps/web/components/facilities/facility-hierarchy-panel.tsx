import Link from "next/link";
import type { Route } from "next";
import { ChevronRight } from "lucide-react";

import type { FacilitySelection } from "@/lib/facilities";

type FacilityHierarchyPanelProps = {
  selection: FacilitySelection;
  onNavigate: (level: "property" | "building" | "floor") => void;
};

export function FacilityHierarchyPanel({ selection, onNavigate }: FacilityHierarchyPanelProps) {
  const crumbs: Array<{ label: string; onClick?: () => void }> = [{ label: "Properties", onClick: () => onNavigate("property") }];

  if (selection.property) {
    crumbs.push({
      label: selection.property.name,
      onClick: selection.building || selection.floor ? () => onNavigate("building") : undefined
    });
  }

  if (selection.building) {
    crumbs.push({
      label: selection.building.name,
      onClick: selection.floor ? () => onNavigate("floor") : undefined
    });
  }

  if (selection.floor) {
    crumbs.push({ label: selection.floor.name });
  }

  return (
    <nav aria-label="Facility hierarchy" className="flex flex-wrap items-center gap-1 text-sm text-slate-600">
      {crumbs.map((crumb, index) => (
        <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 ? <ChevronRight size={14} className="text-slate-400" aria-hidden="true" /> : null}
          {crumb.onClick ? (
            <button
              type="button"
              onClick={crumb.onClick}
              className="font-medium text-brand-700 hover:text-brand-800 hover:underline"
            >
              {crumb.label}
            </button>
          ) : (
            <span className="font-semibold text-slate-900">{crumb.label}</span>
          )}
        </span>
      ))}
      <span className="hidden sm:inline-flex sm:items-center sm:gap-1 sm:pl-2 sm:text-xs sm:text-slate-500">
        <span aria-hidden="true">·</span>
        <Link href={"/cleaning/issues" as Route} className="text-brand-700 hover:text-brand-800">
          Facility issues
        </Link>
      </span>
    </nav>
  );
}
