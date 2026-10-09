export type FilterChip = { key: string; label: string };

type Props = {
  chips: FilterChip[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
};

export function ActiveFilterChips({ chips, onRemove, onClearAll }: Props) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2" aria-label="Active filters">
      <span className="text-xs font-medium text-slate-500">Active</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemove(chip.key)}
          className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {chip.label} ×<span className="sr-only"> Remove {chip.label}</span>
        </button>
      ))}
      <button type="button" onClick={onClearAll} className="text-xs font-medium text-brand-700">
        Clear all
      </button>
    </div>
  );
}
