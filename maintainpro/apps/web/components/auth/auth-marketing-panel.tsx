import { ClipboardList, ShieldCheck, Truck } from "lucide-react";

import { NelnaLogo } from "@/components/brand/nelna-logo";

const highlights = [
  {
    icon: ClipboardList,
    title: "Unified operations",
    description: "Work orders, preventive maintenance and asset lifecycle in one workspace."
  },
  {
    icon: Truck,
    title: "Facility & fleet ready",
    description: "Facilities, utilities, spare parts, gate and fleet maintenance."
  },
  {
    icon: ShieldCheck,
    title: "Enterprise governance",
    description: "Role-based access, approvals, audit trails and operational controls."
  }
] as const;

export function AuthMarketingPanel() {
  return (
    <section className="relative hidden h-full min-h-[calc(100dvh-3rem)] flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-900 to-[#0b3a20] p-10 text-white lg:flex xl:p-14">
      {/* Faint field rows, fading toward the bottom right. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(115deg,#fff_0_1px,transparent_1px_22px)] [mask-image:linear-gradient(to_bottom_left,#000,transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 h-[420px] w-[420px] rounded-full border border-amber-300/25 shadow-[0_0_0_40px_rgba(226,179,60,0.04),0_0_0_80px_rgba(226,179,60,0.03)]"
      />

      <p className="relative flex items-center gap-3 font-mono text-xs uppercase tracking-[0.12em] text-brand-100">
        <span aria-hidden className="h-0.5 w-6 bg-amber-400" />
        Nelna Group maintenance desk
      </p>

      <div className="relative my-auto max-w-xl py-10">
        <span className="inline-flex rounded-2xl bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
          <NelnaLogo priority size="lg" />
        </span>
        <h2 className="mt-7 text-4xl font-semibold tracking-tight">MaintainPro</h2>
        <p className="mt-1 text-lg font-medium text-amber-300">Maintenance Management System</p>
        <p className="mt-3 max-w-md text-base leading-7 text-brand-100/90">
          Plan maintenance, manage assets and facilities, and keep every farm and factory running.
        </p>

        <ul className="mt-8 grid gap-3">
          {highlights.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300/15 text-amber-300">
                <Icon aria-hidden size={18} />
              </span>
              <span>
                <span className="block text-[15px] font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm leading-6 text-brand-100/85">{description}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

    </section>
  );
}
