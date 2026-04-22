import type { ReactNode } from "react";

import { MaintenanceJobProvider } from "@/components/maintenance-job/provider";
import { MaintenanceJobShell } from "@/components/maintenance-job/shell";

export default function FmsLayout({ children }: { children: ReactNode }) {
  return (
    <MaintenanceJobProvider>
      <MaintenanceJobShell>{children}</MaintenanceJobShell>
    </MaintenanceJobProvider>
  );
}
