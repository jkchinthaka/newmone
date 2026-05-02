"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Bell, Bot, Building2, ChartColumnBig, ClipboardCheck, ClipboardList, CreditCard, Database, Droplets, Fuel, Gauge, HardDrive, Home, Layers, Leaf, MapPin, QrCode, Settings, Sprout, SprayCan, Sun, Tag, Tractor, Users, Wallet, Wrench, type LucideIcon } from "lucide-react";

const items: Array<{ href: Route; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/master-data" as Route, label: "Master Data", icon: Database },
  { href: "/assets", label: "Assets", icon: HardDrive },
  { href: "/vehicles", label: "Vehicles", icon: Gauge },
  { href: "/fleet", label: "Fleet", icon: Fuel },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/maintenance/job-codes" as Route, label: "Job Codes", icon: Tag },
  { href: "/work-orders", label: "Work Orders", icon: ClipboardList },
  { href: "/inventory", label: "Inventory", icon: Layers },
  { href: "/utilities", label: "Utilities", icon: ChartColumnBig },
  { href: "/predictive-ai" as Route, label: "AI Assistant", icon: Bot },
  { href: "/reports", label: "Reports", icon: ChartColumnBig },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/billing" as Route, label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings }
];

const cleaningItems: Array<{ href: Route; label: string; icon: LucideIcon }> = [
  { href: "/cleaning" as Route, label: "Overview", icon: SprayCan },
  { href: "/cleaning/scan" as Route, label: "Scan QR", icon: QrCode },
  { href: "/cleaning/visits" as Route, label: "Visits", icon: ClipboardCheck },
  { href: "/cleaning/sign-off" as Route, label: "Sign-off Queue", icon: ClipboardCheck },
  { href: "/cleaning/analytics" as Route, label: "Analytics", icon: ChartColumnBig },
  { href: "/cleaning/issues" as Route, label: "Facility Issues", icon: Bell },
  { href: "/cleaning/locations" as Route, label: "Locations", icon: HardDrive }
];

const farmItems: Array<{ href: Route; label: string; icon: LucideIcon }> = [
  { href: "/farm" as Route, label: "Farm Dashboard", icon: Tractor },
  { href: "/farm/fields" as Route, label: "Fields & Map", icon: MapPin },
  { href: "/farm/crops" as Route, label: "Crops", icon: Sprout },
  { href: "/farm/harvest" as Route, label: "Harvest", icon: Leaf },
  { href: "/farm/livestock" as Route, label: "Livestock", icon: Tractor },
  { href: "/farm/irrigation" as Route, label: "Irrigation", icon: Droplets },
  { href: "/farm/spray-logs" as Route, label: "Spray Logs", icon: SprayCan },
  { href: "/farm/soil-tests" as Route, label: "Soil Tests", icon: Layers },
  { href: "/farm/weather" as Route, label: "Weather", icon: Sun },
  { href: "/farm/workers" as Route, label: "Workers", icon: Users },
  { href: "/farm/attendance" as Route, label: "Attendance", icon: ClipboardCheck },
  { href: "/farm/finance" as Route, label: "Finance", icon: Wallet },
  { href: "/farm/traceability" as Route, label: "Traceability", icon: QrCode }
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

      <div className="mx-3 my-2 rounded-xl border border-amber-200 bg-amber-50 p-2">
        <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">
          Farm Operations
        </p>
        <nav className="mt-1 space-y-1">
          {farmItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  active ? "bg-amber-600 text-white shadow-sm" : "text-amber-900 hover:bg-amber-100"
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
