"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function FgLegacyRedirect({ href }: { href: string }) {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname?.startsWith("/fg/sso/denied")) {
      return;
    }
    window.location.replace(href);
  }, [href, pathname]);
  if (pathname?.startsWith("/fg/sso/denied")) {
    return null;
  }
  return (
    <p className="text-sm text-slate-600" role="status">
      Opening the current FG Digital Records workspace…
    </p>
  );
}
