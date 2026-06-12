"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { MaintainProLogo } from "@/components/brand/maintainpro-logo";
import { apiClient } from "@/lib/api-client";
import { PRODUCT_TAGLINE } from "@/lib/branding";
import { getPostLoginRedirect } from "@/lib/role-redirect";

export default function SplashPage() {
  useEffect(() => {
    const handle = window.setTimeout(() => {
      apiClient
        .get<{ data?: unknown }>("/auth/me")
        .then((response) => {
          window.location.replace(getPostLoginRedirect(response.data?.data));
        })
        .catch(() => window.location.replace("/login"));
    }, 1600);

    return () => window.clearTimeout(handle);
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,_rgba(20,118,214,0.25),_transparent_35%),linear-gradient(135deg,#0f2b46,#115ea8_55%,#0f766e)] p-6 text-white">
      <div className="text-center">
        <div className="mx-auto flex justify-center">
          <MaintainProLogo showTagline size="lg" variant="onDark" className="justify-center" />
        </div>
        <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-white/80">{PRODUCT_TAGLINE}</p>
        <p className="mt-6 inline-flex items-center justify-center gap-2 text-sm text-white/70">
          <Loader2 aria-hidden className="animate-spin" size={16} />
          Loading your workspace...
        </p>
      </div>
    </main>
  );
}
