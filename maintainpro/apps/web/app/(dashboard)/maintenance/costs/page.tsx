"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { canAccessNavigationPath } from "@/lib/navigation";
import { useCurrentUser } from "@/lib/use-current-user";

/** Retired standalone costs page. Bookmarks leave for Reports only when that role can open it. */
export default function RetiredMaintenanceCostsPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const allowed = canAccessNavigationPath("/reports", user.role, user.permissions);

  useEffect(() => {
    if (allowed) {
      router.replace("/reports");
    }
  }, [allowed, router]);

  if (allowed) {
    return (
      <p className="p-6 text-sm text-slate-600" role="status">
        Opening Reports...
      </p>
    );
  }

  return (
    <main className="p-6">
      <h1 className="page-title">Page unavailable</h1>
      <p className="mt-2 text-sm text-slate-600">Maintenance Costs is no longer available.</p>
    </main>
  );
}
