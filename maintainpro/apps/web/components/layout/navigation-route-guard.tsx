"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { canAccessNavigationPath } from "@/lib/navigation";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

type Props = {
  children: React.ReactNode;
};

export function NavigationRouteGuard({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const roleName = extractRoleName({ role: user.role });
  const [checked, setChecked] = useState(false);

  const allowed = !pathname || canAccessNavigationPath(pathname, roleName, user.permissions);

  useEffect(() => {
    setChecked(true);
    if (!pathname || allowed) {
      return;
    }
    router.replace("/action-center?reason=access_denied");
  }, [allowed, pathname, router]);

  if (!checked) {
    return (
      <p className="text-sm text-slate-600" role="status">
        Checking access...
      </p>
    );
  }

  if (!allowed) {
    return (
      <p className="text-sm text-slate-600" role="status">
        Opening an allowed page...
      </p>
    );
  }

  return <>{children}</>;
}
