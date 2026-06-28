import { Building2, ClipboardList, ShieldCheck } from "lucide-react";

import { AppBrandLockup } from "@/components/brand/app-brand-lockup";
import { PRODUCT_TAGLINE } from "@/lib/branding";

const highlights = [
  {
    icon: ClipboardList,
    title: "Unified operations",
    description:
      "Work orders, preventive maintenance, facility issues, and asset lifecycle in one workspace."
  },
  {
    icon: Building2,
    title: "Facility & fleet ready",
    description:
      "Coordinate buildings, utilities, cleaning, inventory, and fleet maintenance with tenant-aware controls."
  },
  {
    icon: ShieldCheck,
    title: "Enterprise governance",
    description:
      "Role-based access, audit visibility, and operational health monitoring for production deployments."
  }
] as const;

export function AuthMarketingPanel() {
  return (
    <section
      aria-hidden
      className="hidden flex-col justify-between rounded-[32px] bg-gradient-to-br from-[#0f2b46] via-[#115ea8] to-[#0f766e] p-10 text-white shadow-[0_32px_80px_rgba(15,43,70,0.3)] lg:flex"
    >
      <div>
        <AppBrandLockup logoSize="lg" showTagline variant="onDark" />
        <p className="mt-8 max-w-xl text-sm leading-7 text-white/82">{PRODUCT_TAGLINE}</p>
        <p className="mt-4 max-w-xl text-sm leading-7 text-white/72">
          MaintainPro helps maintenance, facility, and operations teams plan work, track assets,
          manage vendors, and keep critical services running.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {highlights.map(({ icon: Icon, title, description }) => (
          <li
            key={title}
            className="rounded-[24px] border border-white/12 bg-white/10 p-4"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Icon aria-hidden size={18} />
              </span>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-2 text-sm text-white/72">{description}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
