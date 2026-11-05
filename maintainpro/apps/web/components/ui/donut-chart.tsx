type Slice = { name: string; value: number };

const COLORS = ["#2563eb", "#f59e0b", "#e11d48", "#10b981", "#8b5cf6", "#0ea5e9", "#64748b", "#f97316"];

/** Donut with the total in the centre and a count + percent legend (backlog by status / priority). */
export function DonutChart({ items }: { items: Slice[] }) {
  const slices = items.filter((item) => item.value > 0);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const radius = 15.9155; // circumference 100 so dash values are percentages
  let offset = 25; // start at 12 o'clock

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 42 42" className="h-full w-full" role="img" aria-label={`Total ${total}`}>
          <circle cx="21" cy="21" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
          {slices.map((slice) => {
            const pct = (slice.value / total) * 100;
            const index = items.indexOf(slice);
            const dash = `${pct} ${100 - pct}`;
            const node = (
              <circle
                key={slice.name}
                cx="21"
                cy="21"
                r={radius}
                fill="none"
                stroke={COLORS[index % COLORS.length]}
                strokeWidth="6"
                strokeDasharray={dash}
                strokeDashoffset={offset}
              />
            );
            offset -= pct;
            return node;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-slate-500">Total</span>
          <span className="text-2xl font-semibold text-slate-900">{total}</span>
        </div>
      </div>
      <ul className="min-w-[10rem] flex-1 space-y-1.5 text-sm">
        {items.map((item, index) => (
          <li key={item.name} className="flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
            <span className="flex-1 text-slate-700">{item.name}</span>
            <span className="tabular-nums text-slate-900">{item.value}</span>
            <span className="w-10 text-right tabular-nums text-slate-500">{total ? Math.round((item.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
