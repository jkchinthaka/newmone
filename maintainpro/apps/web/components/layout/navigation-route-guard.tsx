"use client";

import type { Route } from "next";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { InlineLoadingState } from "@/components/ui/page-state";
import { canAccessNavigationPath } from "@/lib/navigation";
import { extractRoleName, getPostLoginRedirect } from "@/lib/role-redirect";
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
  const landing = getPostLoginRedirect({ role: user.role });

  useEffect(() => {
    setChecked(true);
    if (!pathname || allowed) {
      return;
    }
    const target = landing && landing !== pathname ? landing : "/notifications";
    router.replace(target as Route);
  }, [allowed, landing, pathname, router]);

  if (!checked) {
    return <InlineLoadingState label="Checking access…" />;
  }

  if (!allowed) {
    return <InlineLoadingState label="Opening an allowed page…" />;
  }

  return <>{children}</>;
}
