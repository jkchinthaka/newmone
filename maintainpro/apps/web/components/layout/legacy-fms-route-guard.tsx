"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { canAccessLegacyFmsArchive, LEGACY_FMS_ARCHIVE_ROLES } from "@/lib/legacy-fms-access";
import { useCurrentUser } from "@/lib/use-current-user";

export function LegacyFmsRouteGuard({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const router = useRouter();
  const allowed = canAccessLegacyFmsArchive(user.role);

  useEffect(() => {
    if (user.role && !allowed) {
      router.replace("/dashboard");
    }
  }, [allowed, router, user.role]);

  if (!user.role) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Checking archive access…
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-rose-700" aria-hidden />
          <div>
            <h2 className="text-base font-semibold text-rose-950">Admin-only archive</h2>
            <p className="mt-1 text-sm text-rose-900">
              The Legacy FMS Archive is restricted to {LEGACY_FMS_ARCHIVE_ROLES.join(" / ")}. Use Work Orders for
              current maintenance history.
            </p>
            <Link href="/work-orders" className="mt-3 inline-block text-sm font-medium text-rose-900 underline">
              Go to Work Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
