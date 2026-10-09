import { Building2, ClipboardList, ShieldCheck } from "lucide-react";

import { AppBrandLockup } from "@/components/brand/app-brand-lockup";

const highlights = [
  {
    icon: ClipboardList,
    title: "Unified operations",
    description: "Manage work orders, preventive maintenance and asset lifecycle in one workspace."
  },
  {
    icon: Building2,
    title: "Facility & fleet ready",
    description: "Coordinate facilities, utilities, inventory and fleet maintenance."
  },
  {
    icon: ShieldCheck,
    title: "Enterprise governance",
    description: "Role-based access, audit trails and operational controls."
  }
] as const;

export function AuthMarketingPanel() {
  return (
    <section className="hidden flex-col justify-center rounded-3xl bg-brand-900 p-8 text-white lg:flex lg:min-h-[calc(100dvh-3rem)]">
      <div>
        <AppBrandLockup logoSize="lg" showTagline variant="onDark" />
        <p className="mt-5 max-w-md text-sm leading-6 text-slate-300">
          Plan maintenance, manage assets and facilities, and keep critical operations running.
        </p>
      </div>

      <ul className="mt-8 grid gap-3">
        {highlights.map(({ icon: Icon, title, description }) => (
          <li key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Icon aria-hidden size={16} />
              </span>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-1 text-sm leading-5 text-slate-300">{description}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
