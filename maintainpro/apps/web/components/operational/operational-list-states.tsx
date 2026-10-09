type EmptyProps = {
  title?: string;
  onClear?: () => void;
  onViewAll?: () => void;
};

export function OperationalEmptyState({
  title = "No work orders match these filters.",
  onClear,
  onViewAll
}: EmptyProps) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <div className="mt-3 flex items-center justify-center gap-3">
        {onClear ? (
          <button type="button" onClick={onClear} className="text-sm font-medium text-brand-700">
            Clear filters
          </button>
        ) : null}
        {onViewAll ? (
          <button type="button" onClick={onViewAll} className="text-sm font-medium text-slate-700">
            View all
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function TableLoadingRows({ rows = 6, label = "Loading work orders" }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-2 p-3" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-10 animate-pulse rounded-md bg-brand-100" />
      ))}
    </div>
  );
}
