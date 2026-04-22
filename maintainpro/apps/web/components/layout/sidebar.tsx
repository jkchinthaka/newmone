"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Bell, ChartColumnBig, ClipboardCheck, ClipboardList, Fuel, Gauge, HardDrive, Home, Layers, QrCode, Settings, SprayCan, Wrench, type LucideIcon } from "lucide-react";

const items: Array<{ href: Route; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/assets", label: "Assets", icon: HardDrive },
  { href: "/vehicles", label: "Vehicles", icon: Gauge },
  { href: "/fleet", label: "Fleet", icon: Fuel },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/work-orders", label: "Work Orders", icon: ClipboardList },
  { href: "/inventory", label: "Inventory", icon: Layers },
  { href: "/utilities", label: "Utilities", icon: ChartColumnBig },
  { href: "/reports", label: "Reports", icon: ChartColumnBig },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings }
];

const cleaningItems: Array<{ href: Route; label: string; icon: LucideIcon }> = [
  { href: "/cleaning" as Route, label: "Overview", icon: SprayCan },
  { href: "/cleaning/scan" as Route, label: "Scan QR", icon: QrCode },
  { href: "/cleaning/visits" as Route, label: "Visits", icon: ClipboardCheck },
  { href: "/cleaning/sign-off" as Route, label: "Sign-off Queue", icon: ClipboardCheck },
  { href: "/cleaning/issues" as Route, label: "Facility Issues", icon: Bell },
  { href: "/cleaning/locations" as Route, label: "Locations", icon: HardDrive }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white xl:block">
      <div className="p-5">
        <p className="text-xs uppercase tracking-[0.25em] text-brand-600">MaintainPro</p>
        <h1 className="mt-3 text-lg font-semibold text-slate-900">Operations Command</h1>
      </div>
      <nav className="space-y-1 px-3 pb-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                active ? "bg-brand-100 text-brand-800" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 my-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2">
        <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Cleaning Management
        </p>
        <nav className="mt-1 space-y-1">
          {cleaningItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-emerald-800 hover:bg-emerald-100"
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
