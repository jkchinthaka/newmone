"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Bell, ChartColumnBig, ClipboardList, Fuel, Gauge, HardDrive, Home, Layers, Settings, Wrench, type LucideIcon } from "lucide-react";

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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white xl:block">
      <div className="p-5">
        <p className="text-xs uppercase tracking-[0.25em] text-brand-600">MaintainPro</p>
        <h1 className="mt-3 text-lg font-semibold text-slate-900">Operations Command</h1>
      </div>
      <nav className="space-y-1 px-3 pb-6">
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
    </aside>
  );
}
