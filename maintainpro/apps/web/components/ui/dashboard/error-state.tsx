export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-card border border-red-200 bg-red-50 px-4 py-6 text-center dark:border-red-900 dark:bg-red-950" role="alert">
      <p className="text-sm text-red-800 dark:text-red-100">{message}</p>
      {onRetry ? (
        <button type="button" className="mt-3 min-h-10 rounded-md bg-white px-3 text-sm font-medium text-red-800 ring-1 ring-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:bg-red-900 dark:text-red-50" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
