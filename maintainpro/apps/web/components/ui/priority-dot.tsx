import { priorityBadgePresentation } from "@/lib/dashboard-status";

const DOT: Record<string, string> = {
  CRITICAL: "bg-rose-600",
  HIGH: "bg-amber-500",
  MEDIUM: "bg-sky-500",
  LOW: "bg-slate-400"
};

/** Coloured dot + label, the same on every list (instead of a filled pill). */
export function PriorityDot({ priority }: { priority: string }) {
  const presentation = priorityBadgePresentation(priority);
  if (!presentation) return null;
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-700">
      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${DOT[priority.trim().toUpperCase()] ?? "bg-slate-400"}`} />
      {presentation.label}
    </span>
  );
}
