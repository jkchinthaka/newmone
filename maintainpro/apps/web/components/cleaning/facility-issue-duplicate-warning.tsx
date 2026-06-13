import Link from "next/link";

import {
  duplicateIssueConfidenceTone,
  formatDuplicateIssueConfidenceLabel,
  getDuplicateIssueLocationLabel,
  type DuplicateFacilityIssueCandidate
} from "@/lib/facility-issue-duplicates";
import { formatFacilityIssueCategory } from "@/lib/facility-issue-ui";
import { formatDateTime } from "@/lib/localization";

type FacilityIssueDuplicateWarningProps = {
  candidates: readonly DuplicateFacilityIssueCandidate[];
  unavailableMessage?: string | null;
  checking?: boolean;
  onContinue: () => void;
  onDismiss?: () => void;
  continueLabel?: string;
};

const toneClasses = {
  danger: "border-red-200 bg-red-50 text-red-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-sky-200 bg-sky-50 text-sky-900"
} as const;

export function FacilityIssueDuplicateWarning({
  candidates,
  unavailableMessage,
  checking = false,
  onContinue,
  onDismiss,
  continueLabel = "Submit anyway"
}: FacilityIssueDuplicateWarningProps) {
  const topConfidence = candidates[0]?.confidence ?? "LOW";
  const tone = duplicateIssueConfidenceTone(topConfidence);

  return (
    <section
      aria-live="polite"
      className={`rounded-xl border p-4 shadow-sm ${toneClasses[tone]}`}
    >
      <header className="space-y-1">
        <h2 className="text-sm font-semibold">
          {candidates.length === 1
            ? "Possible duplicate issue found"
            : `${candidates.length} possible duplicate issues found`}
        </h2>
        <p className="text-sm opacity-90">
          Review the existing open issue(s) below. You can continue with a new report if this is a
          separate problem.
        </p>
        {unavailableMessage ? <p className="text-xs opacity-80">{unavailableMessage}</p> : null}
      </header>

      <ul className="mt-3 space-y-2">
        {candidates.map((candidate) => (
          <li
            key={candidate.id}
            className="rounded-lg border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-800"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-900">{candidate.title}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {formatDuplicateIssueConfidenceLabel(candidate.confidence)}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {candidate.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">{candidate.descriptionPreview}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
              <span>{getDuplicateIssueLocationLabel(candidate)}</span>
              {candidate.category ? (
                <span>{formatFacilityIssueCategory(candidate.category)}</span>
              ) : null}
              <span>{formatDateTime(candidate.createdAt)}</span>
              {candidate.workOrderId ? <span>Linked work order</span> : null}
            </div>
            <p className="mt-1 text-xs text-slate-500">{candidate.reason}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={checking}
          onClick={onContinue}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {checking ? "Submitting…" : continueLabel}
        </button>
        {onDismiss ? (
          <button
            type="button"
            disabled={checking}
            onClick={onDismiss}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Review form
          </button>
        ) : null}
        <Link
          href="/cleaning/issues"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Open issue list
        </Link>
      </div>
    </section>
  );
}
