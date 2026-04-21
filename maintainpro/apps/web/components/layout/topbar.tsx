"use client";

import { Bell, Search, UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { clearAuthSession } from "@/lib/auth-storage";

export function Topbar() {
  const router = useRouter();

  function logout() {
    clearAuthSession();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          <Search size={16} />
          <span>Search assets, work orders, vehicles...</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-100">
            <Bell size={18} />
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            <UserCircle2 size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
