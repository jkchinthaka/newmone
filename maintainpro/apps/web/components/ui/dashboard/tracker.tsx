export function Tracker({ items }: { items: Array<{ key: string; tone: "emerald" | "amber" | "red" | "neutral" }> }) {
  const color = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    neutral: "bg-slate-300 dark:bg-slate-600"
  };
  return (
    <div className="flex h-8 gap-1" role="img" aria-label="Status tracker">
      {items.map((item) => (
        <span key={item.key} className={`h-full flex-1 rounded-sm ${color[item.tone]}`} />
      ))}
    </div>
  );
}
