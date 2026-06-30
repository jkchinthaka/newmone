import type { ReactNode } from "react";
import Link from "next/link";

import { MaintenanceJobProvider } from "@/components/maintenance-job/provider";
import { MaintenanceJobShell } from "@/components/maintenance-job/shell";
import { LegacyFmsRouteGuard } from "@/components/layout/legacy-fms-route-guard";

export default function FmsLayout({ children }: { children: ReactNode }) {
  return (
    <LegacyFmsRouteGuard>
      <MaintenanceJobProvider>
        <MaintenanceJobShell>
        <div
          role="status"
          aria-live="polite"
          className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
        >
          Legacy FMS workspace · read-only archived module. The canonical maintenance flow lives under{" "}
          <Link className="underline hover:text-amber-950" href="/work-orders">
            /work-orders
          </Link>
          ,{" "}
          <Link className="underline hover:text-amber-950" href="/inventory">
            /inventory
          </Link>
          , and{" "}
          <Link className="underline hover:text-amber-950" href="/procurement">
            /procurement
          </Link>
          .{" "}
          <Link className="underline hover:text-amber-950" href="/dashboard">
            Go to MaintainPro Dashboard
          </Link>
          .
        </div>
        {children}
      </MaintenanceJobShell>
    </MaintenanceJobProvider>
    </LegacyFmsRouteGuard>
  );
}
