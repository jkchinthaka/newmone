"use client";

import { useEffect } from "react";
import { Wrench } from "lucide-react";

import { apiClient } from "@/lib/api-client";

export default function SplashPage() {
  useEffect(() => {
    const handle = window.setTimeout(() => {
      apiClient
        .get("/auth/me")
        .then(() => window.location.replace("/home"))
        .catch(() => window.location.replace("/login"));
    }, 1600);

    return () => window.clearTimeout(handle);
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,_rgba(20,118,214,0.25),_transparent_35%),linear-gradient(135deg,#0f2b46,#115ea8_55%,#b8860b)] p-6 text-white">
      <div className="text-center">
        <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/20 bg-white/10 shadow-[0_20px_60px_rgba(15,23,42,0.24)]">
          <Wrench size={34} />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Maintenance Job</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Fleet & Facility Maintenance Management System</h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-white/80">Loading the full maintenance workspace with pending requests, module routing, staff allocation, item requests, and job costing.</p>
      </div>
    </main>
  );
}
