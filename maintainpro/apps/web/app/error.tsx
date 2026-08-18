"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/ui/page-state";
import { reportClientError } from "@/lib/client-error-report";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    reportClientError("route error boundary", error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 p-6">
      <div className="w-full max-w-lg">
        <ErrorState
          title="Something went wrong"
          description="This page hit an unexpected error. Try again or return to the dashboard."
          error={error}
          onRetry={reset}
        />
      </div>
    </div>
  );
}
