"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/ui/page-state";
import { reportClientError } from "@/lib/client-error-report";

type ModuleRouteErrorProps = {
  moduleName: string;
  error: Error & { digest?: string };
  reset: () => void;
};

export function ModuleRouteError({ moduleName, error, reset }: ModuleRouteErrorProps) {
  useEffect(() => {
    reportClientError(`${moduleName} error boundary`, error);
  }, [error, moduleName]);

  return (
    <ErrorState
      description={`This ${moduleName} view hit an unexpected error. Try again or open another module from the sidebar.`}
      error={error}
      onRetry={reset}
      title={`${moduleName} could not be loaded`}
    />
  );
}
