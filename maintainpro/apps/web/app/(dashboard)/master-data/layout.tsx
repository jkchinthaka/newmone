import type { ReactNode } from "react";

import { AdminTabs } from "@/components/admin/admin-tabs";

export default function MasterDataLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0">
      <AdminTabs />
      {children}
    </div>
  );
}
