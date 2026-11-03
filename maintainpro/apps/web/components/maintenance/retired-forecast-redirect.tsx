"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { canAccessNavigationPath } from "@/lib/navigation";
import { useCurrentUser } from "@/lib/use-current-user";

/** Standalone forecast is retired. Preventive Maintenance keeps the real schedules. */
export function RetiredForecastRedirect() {
  const router = useRouter();
  const user = useCurrentUser();
  const allowed = canAccessNavigationPath("/maintenance/plans", user.role, user.permissions);

  useEffect(() => {
    if (allowed) {
      router.replace("/maintenance/plans");
    }
  }, [allowed, router]);

  if (allowed) {
    return (
      <p className="p-6 text-sm text-slate-600" role="status">
        Opening Scheduled Service...
      </p>
    );
  }

  return (
    <main className="p-6">
      <h1 className="page-title">Page unavailable</h1>
      <p className="mt-2 text-sm text-slate-600">Maintenance Forecast is no longer available.</p>
    </main>
  );
}
