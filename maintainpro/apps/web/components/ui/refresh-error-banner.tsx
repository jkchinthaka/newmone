import { AlertTriangle } from "lucide-react";

/**
 * Small inline notice for a failed background refresh. Rows already on screen stay visible.
 */
export function RefreshErrorBanner({
  message = "Could not refresh. Showing the last loaded data.",
  onRetry,
  retrying = false,
  className = ""
}: {
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 ${className}`}
    >
      <AlertTriangle size={16} className="shrink-0 text-amber-700" aria-hidden />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="min-h-11 rounded-md px-3 text-sm font-semibold text-amber-900 underline-offset-2 hover:underline disabled:opacity-60"
        >
          {retrying ? "Retrying…" : "Retry"}
        </button>
      ) : null}
    </div>
  );
}
