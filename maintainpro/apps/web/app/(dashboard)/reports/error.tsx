"use client";

import { ModuleRouteError } from "@/components/ui/module-route-error";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ModuleRouteError error={error} moduleName="Reports" reset={reset} />;
}
