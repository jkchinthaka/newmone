export function BarList({ items }: { items: Array<{ name: string; value: number }> }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.name}>
          <div className="mb-1 flex justify-between text-xs text-slate-600 dark:text-slate-300">
            <span>{item.name}</span>
            <span>{item.value}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.round((item.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
