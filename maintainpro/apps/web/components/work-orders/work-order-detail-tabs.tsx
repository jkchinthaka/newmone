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
  { id: "safety", label: "Safety" },
  { id: "evidence", label: "Evidence" },
  { id: "vendor-repair", label: "Vendor Repair" },
  { id: "history", label: "History" },
  { id: "audit", label: "Audit" }
];

type Props = {
  activeTab: WorkOrderDetailTab;
  onChange: (tab: WorkOrderDetailTab) => void;
  showAudit: boolean;
};

export function WorkOrderDetailTabs({ activeTab, onChange, showAudit }: Props) {
  const tabs = WORK_ORDER_DETAIL_TABS.filter((tab) => (tab.id === "audit" ? showAudit : true));

  return (
    <div className="sticky top-0 z-10 border-b border-brand-100 bg-white px-3">
      <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Work order sections">
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.id)}
              className={`min-h-10 whitespace-nowrap border-b-2 px-3 text-sm font-medium ${
                selected
                  ? "border-brand-600 text-brand-800"
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
