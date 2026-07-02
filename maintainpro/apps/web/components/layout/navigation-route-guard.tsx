"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    if (!pathname) {
      return;
    }

    if (!canAccessNavigationPath(pathname, roleName, user.permissions)) {
      router.replace("/action-center?reason=access_denied");
    }
  }, [pathname, roleName, router, user.permissions]);

  return <>{children}</>;
}
