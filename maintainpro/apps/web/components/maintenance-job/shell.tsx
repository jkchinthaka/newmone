"use client";

import { usePathname } from "next/navigation";
import { Activity, BarChart3, BellRing, CarFront, Factory, List, ShieldCheck, UserCircle2, Wrench } from "lucide-react";
import type { ReactNode } from "react";

import { useMaintenanceJobApp } from "./provider";

const bottomNav = [
  { href: "/home", label: "Home", icon: Activity },
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
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-[#0f2b46] via-[#115ea8] to-[#b8860b] text-white shadow-[0_24px_60px_rgba(15,43,70,0.28)]">
        <div className="grid gap-5 p-5 lg:grid-cols-[1.45fr_0.95fr] lg:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Maintenance Job</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Fleet & Facility Maintenance Management System</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/82">
              Pending requests, machinery jobs, service jobs, vehicle jobs, scheduling, costing, and completion tracking in one connected web workspace.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85">Role: {role.replaceAll("_", " ")}</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85">Responsive web workflow</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85">Overdue-first queueing</span>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/12 bg-slate-950/25 p-4 backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Quick tools</p>
              <div className="flex items-center gap-2 text-white/80">
                <span className="rounded-full border border-white/15 bg-white/10 p-2"><UserCircle2 size={16} /></span>
                <span className="rounded-full border border-white/15 bg-white/10 p-2"><Activity size={16} /></span>
                <span className="rounded-full border border-white/15 bg-white/10 p-2"><List size={16} /></span>
                <span className="rounded-full border border-white/15 bg-white/10 p-2"><BarChart3 size={16} /></span>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {quickNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => window.location.assign(item.href)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                      active ? "border-white/30 bg-white/18 text-white" : "border-white/10 bg-white/6 text-white/85 hover:bg-white/10"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon size={15} />
                      {item.label}
                    </span>
                    <ShieldCheck size={15} className="text-white/65" />
                  </button>
                );
              })}
            </div>
          </div>
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
