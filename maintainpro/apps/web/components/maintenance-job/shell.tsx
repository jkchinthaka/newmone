"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Activity, BarChart3, BellRing, CarFront, Factory, LayoutDashboard, List, ShieldCheck, UserCircle2, Wrench } from "lucide-react";
import type { ReactNode } from "react";

import { useMaintenanceJobApp } from "./provider";

const bottomNav = [
  { href: "/home", label: "Legacy", icon: Activity },
  { href: "/machinery", label: "Machinery", icon: Factory },
  { href: "/service", label: "Service", icon: Wrench },
  { href: "/vehicle", label: "Vehicle", icon: CarFront }
];

const quickNav = [
  { href: "/pending-requests", label: "List View", icon: List },
  { href: "/reports/job-costing", label: "Analytics", icon: BarChart3 }
];

export function MaintenanceJobShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { notifications, dismissNotification, role } = useMaintenanceJobApp();

  return (
    <div className="space-y-5 pb-24">
      <section className="rounded-card border border-brand-100 bg-white p-3 text-ink shadow-card">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-800">Legacy FMS workspace</p>
        <h1 className="page-title">Archived Maintenance Job Module</h1>
        <p className="max-w-2xl text-sm text-brand-800">
          Read-only archived workspace for legacy pending requests and job demos. Current
          operations live in MaintainPro dashboards, work orders, inventory, and procurement.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="btn-primary" href="/dashboard">
            <LayoutDashboard size={14} />
            MaintainPro Dashboard
          </Link>
          <span className="btn-quiet">Role: {role.replaceAll("_", " ")}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => window.location.assign(item.href)}
                className={active ? "btn-primary" : "btn-quiet"}
              >
                <Icon size={15} />
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      {notifications.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {notifications.slice(0, 2).map((note) => (
            <div key={note.id} className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-700 shadow-sm">
              <div className="flex items-start gap-3">
                <BellRing size={16} className="mt-0.5 text-amber-600" />
                <div>
                  <p className="font-semibold text-slate-900">{note.title}</p>
                  <p className="mt-1 text-slate-600">{note.message}</p>
                </div>
              </div>
              <button type="button" onClick={() => dismissNotification(note.id)} className="text-xs font-medium text-slate-500 hover:text-slate-700">
                Dismiss
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {children}

      <nav className="fixed bottom-5 left-1/2 z-20 flex w-[min(92vw,720px)] -translate-x-1/2 items-center justify-between gap-2 rounded-full border border-slate-200 bg-white/96 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur">
        {bottomNav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <button
              key={item.href}
              type="button"
              onClick={() => window.location.assign(item.href)}
              className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-medium transition ${
                active ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
