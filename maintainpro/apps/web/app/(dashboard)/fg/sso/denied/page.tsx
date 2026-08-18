import { PermissionState } from "@/components/ui/page-state";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";

export default function FgSsoDeniedPage() {
  return (
    <div className="space-y-4">
      <PageBreadcrumbs />
      <PermissionState
        title="FG Digital Records access denied"
        description="Your MaintainPro account is signed in, but it does not have permission to use FG Digital Records. Ask an administrator to grant fg.access."
      />
    </div>
  );
}
