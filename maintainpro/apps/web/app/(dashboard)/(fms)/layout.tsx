import type { ReactNode } from "react";

import { MaintenanceJobProvider } from "@/components/maintenance-job/provider";
import { MaintenanceJobShell } from "@/components/maintenance-job/shell";

export default function FmsLayout({ children }: { children: ReactNode }) {
  return (
    <MaintenanceJobProvider>
      <MaintenanceJobShell>
        <div
          role="status"
          aria-live="polite"
          className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
        >
          Legacy FMS workspace · read-only. The canonical maintenance flow lives under
          /work-orders, /inventory, and /procurement. Phase 3 procurement and part request workflows are
          available there.
        </div>
        {children}
      </MaintenanceJobShell>
    </MaintenanceJobProvider>
  );
}
