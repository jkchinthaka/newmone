"use client";

const STEPS = [
  { key: "RECORDING", label: "Recording" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "SUPERVISOR_REVIEW", label: "Supervisor review" },
  { key: "QA_REVIEW", label: "QA review" },
  { key: "COMPLETED", label: "Completed" }
];

function activeIndex(statusLabel: string, recordStatus: string): number {
  const blob = `${statusLabel} ${recordStatus}`.toUpperCase();
  if (blob.includes("COMPLETE") || blob.includes("RELEASE")) return 4;
  if (blob.includes("QA") || blob.includes("VERIF")) return 3;
  if (blob.includes("REVIEW") || blob.includes("CHECK") || blob.includes("SUPERVISOR")) return 2;
  if (blob.includes("SUBMIT")) return 1;
  return 0;
}

export function FgWorkflowTimeline({
  statusLabel,
  recordStatus
}: {
  statusLabel: string;
  recordStatus: string;
}) {
  const current = activeIndex(statusLabel, recordStatus);
  return (
    <ol className="grid gap-2 sm:grid-cols-5" aria-label="Record workflow">
      {STEPS.map((step, index) => {
        const state = index < current ? "done" : index === current ? "current" : "upcoming";
        return (
          <li
            key={step.key}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              state === "current"
                ? "border-brand-300 bg-brand-50 text-brand-800"
                : state === "done"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            <span className="sr-only">{state === "current" ? "Current step: " : state === "done" ? "Completed: " : "Upcoming: "}</span>
            {index + 1}. {step.label}
          </li>
        );
      })}
    </ol>
  );
}
