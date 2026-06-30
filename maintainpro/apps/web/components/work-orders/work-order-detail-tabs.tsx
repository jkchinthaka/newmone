export type WorkOrderDetailTab =
  | "overview"
  | "assignment"
  | "parts"
  | "evidence"
  | "history"
  | "audit";

export const WORK_ORDER_DETAIL_TABS: Array<{ id: WorkOrderDetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "assignment", label: "Assignment" },
  { id: "parts", label: "Parts" },
  { id: "evidence", label: "Evidence" },
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
    <div className="border-b border-slate-200 px-1">
      <div className="flex gap-1 overflow-x-auto pb-px" role="tablist" aria-label="Work order sections">
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.id)}
              className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium transition ${
                selected
                  ? "border border-b-white border-slate-200 bg-white text-brand-800"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
