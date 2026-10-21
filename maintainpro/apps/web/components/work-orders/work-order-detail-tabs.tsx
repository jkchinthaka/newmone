"use client";

import { useEffect } from "react";

export type WorkOrderDetailTab =
  | "overview"
  | "assignment"
  | "parts"
  | "safety"
  | "evidence"
  | "vendor-repair"
  | "history"
  | "audit";

export const WORK_ORDER_DETAIL_TABS: Array<{ id: WorkOrderDetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "assignment", label: "Assignment" },
  { id: "parts", label: "Parts" },
  { id: "safety", label: "Downtime" },
  { id: "evidence", label: "Evidence" },
  { id: "vendor-repair", label: "Vendor Repair" },
  { id: "history", label: "History" },
  { id: "audit", label: "Audit" }
];

type Props = {
  activeTab: WorkOrderDetailTab;
  onChange: (tab: WorkOrderDetailTab) => void;
  showAudit: boolean;
  showAssignment?: boolean;
};

export function WorkOrderDetailTabs({ activeTab, onChange, showAudit, showAssignment = true }: Props) {
  const tabs = WORK_ORDER_DETAIL_TABS.filter((tab) => {
    if (tab.id === "audit") return showAudit;
    if (tab.id === "assignment") return showAssignment;
    return true;
  });

  useEffect(() => {
    document.getElementById(`wo-tab-${activeTab}`)?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeTab]);

  return (
    <div className="sticky top-0 z-10 min-w-0 border-b border-brand-100 bg-white">
      <div
        className="flex w-full min-w-0 gap-1 overflow-x-auto overscroll-x-contain px-2 py-1 [scrollbar-width:thin]"
        role="tablist"
        aria-label="Work order sections"
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`wo-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.id)}
              className={`min-h-11 shrink-0 whitespace-nowrap rounded-md border-b-2 px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                selected
                  ? "border-brand-600 bg-brand-50 text-brand-900"
                  : "border-transparent text-ink hover:bg-brand-50"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
