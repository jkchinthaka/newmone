import { Layers3, LayoutGrid, List } from "lucide-react";

export type JobsView = "queues" | "kanban" | "list";

type Props = {
  view: JobsView;
  onChange: (view: JobsView) => void;
};

const VIEWS = [
  ["queues", "Queues", LayoutGrid],
  ["kanban", "Kanban", Layers3],
  ["list", "List", List]
] as const;

/** Compact Queues / Kanban / List switch shared by All Jobs and domain job pages. */
export function JobsViewSwitcher({ view, onChange }: Props) {
  return (
    <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm" role="group" aria-label="Work order view">
      {VIEWS.map(([key, label, Icon]) => (
        <button
          key={key}
          type="button"
          aria-pressed={view === key}
          onClick={() => onChange(key)}
          className={`inline-flex min-h-10 items-center gap-1 rounded-md px-2.5 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
            view === key ? "bg-brand-100 font-medium text-brand-800" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Icon size={14} aria-hidden /> {label}
        </button>
      ))}
    </div>
  );
}
