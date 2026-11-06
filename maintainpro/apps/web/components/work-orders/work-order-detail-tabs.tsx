"use client";

import { useEffect, useRef, useState } from "react";

export type WorkOrderDetailTab =
  | "overview"
  | "assignment"
  | "tasks"
  | "parts"
  | "safety"
  | "evidence"
  | "vendor-repair"
  | "history"
  | "audit";

export const WORK_ORDER_DETAIL_TABS: Array<{ id: WorkOrderDetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "assignment", label: "Assignment" },
  { id: "tasks", label: "Tasks" },
  { id: "parts", label: "Parts" },
  { id: "safety", label: "Machine stopped time" },
  { id: "evidence", label: "Photos" },
  { id: "vendor-repair", label: "Vendor repair" },
  { id: "history", label: "History" },
  { id: "audit", label: "Audit" }
];

/** Rarely used sections live under "More" so the daily tabs stay short: Overview, Assignment, Parts, Photos. */
export const WORK_ORDER_MORE_TABS: WorkOrderDetailTab[] = ["safety", "vendor-repair", "history", "audit"];

type Props = {
  activeTab: WorkOrderDetailTab;
  onChange: (tab: WorkOrderDetailTab) => void;
  showAudit: boolean;
  showAssignment?: boolean;
  /** Tabs folded away for this user (kept visible when it is the open tab, e.g. a deep link). */
  hideTabs?: WorkOrderDetailTab[];
  counts?: Partial<Record<WorkOrderDetailTab, number>>;
};

function CountBadge({ value }: { value?: number }) {
  if (typeof value !== "number" || value <= 0) return null;
  return (
    <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-700">
      {value}
    </span>
  );
}

export function WorkOrderDetailTabs({ activeTab, onChange, showAudit, showAssignment = true, hideTabs, counts }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  const tabs = WORK_ORDER_DETAIL_TABS.filter((tab) => {
    if (tab.id === "audit") return showAudit;
    if (tab.id === "assignment") return showAssignment;
    if (hideTabs?.includes(tab.id) && tab.id !== activeTab) return false;
    return true;
  });
  const mainTabs = tabs.filter((tab) => !WORK_ORDER_MORE_TABS.includes(tab.id));
  const moreTabs = tabs.filter((tab) => WORK_ORDER_MORE_TABS.includes(tab.id));
  const activeInMore = moreTabs.find((tab) => tab.id === activeTab);

  useEffect(() => {
    document.getElementById(`wo-tab-${activeTab}`)?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeTab]);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  const tabClass = (selected: boolean) =>
    `min-h-11 shrink-0 whitespace-nowrap border-b-2 px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
      selected ? "border-brand-600 text-brand-700" : "border-transparent text-slate-600 hover:text-slate-900"
    }`;

  const moreHasCount = moreTabs.some((tab) => tab.id === "history" && (counts?.history ?? 0) > 0);

  return (
    <div className="sticky top-0 z-10 flex min-w-0 items-stretch border-b border-brand-100 bg-white">
      <div
        className="flex min-w-0 flex-1 gap-1 overflow-x-auto overscroll-x-contain px-2 [scrollbar-width:thin]"
        role="tablist"
        aria-label="Job sections"
      >
        {mainTabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`wo-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.id)}
              className={tabClass(selected)}
            >
              {tab.label}
              <CountBadge value={counts?.[tab.id]} />
            </button>
          );
        })}
      </div>
      {moreTabs.length > 0 ? (
        <div ref={moreRef} className="relative shrink-0 border-l border-slate-100 px-1">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className={tabClass(Boolean(activeInMore))}
          >
            {activeInMore ? activeInMore.label : "More"}
            {!activeInMore && moreHasCount ? (
              <span aria-hidden className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-brand-500 align-middle" />
            ) : null}
            <span aria-hidden className="ml-1 text-xs">▾</span>
          </button>
          {moreOpen ? (
            <div
              role="menu"
              aria-label="More job sections"
              className="absolute right-0 top-full z-20 mt-1 min-w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            >
              {moreTabs.map((tab) => {
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`wo-tab-${tab.id}`}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onChange(tab.id);
                      setMoreOpen(false);
                    }}
                    className={`flex min-h-11 w-full items-center justify-between px-3 text-left text-sm hover:bg-slate-50 ${
                      selected ? "font-semibold text-brand-700" : "text-slate-700"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <CountBadge value={counts?.[tab.id]} />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
