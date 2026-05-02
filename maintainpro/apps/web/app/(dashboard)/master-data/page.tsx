import {
  Building2,
  Car,
  HardDrive,
  Users,
  Package,
  Truck,
  Gauge,
  Briefcase,
  Tag,
  ArrowRight,
} from "lucide-react";

const MASTER_ENTITIES = [
  {
    label: "Departments",
    description: "Organisational units — link vehicles, assets, drivers and users.",
    href: "/master-data/departments",
    icon: Building2,
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
  },
  {
    label: "Vehicles",
    description: "Fleet vehicles with make, model, registration and meter links.",
    href: "/vehicles",
    icon: Car,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  {
    label: "Assets",
    description: "Non-vehicle equipment, machinery and infrastructure assets.",
    href: "/assets",
    icon: HardDrive,
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-200",
  },
  {
    label: "Drivers",
    description: "Licensed operators assigned to vehicles and departments.",
    href: "/fleet",
    icon: Briefcase,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  {
    label: "Technicians",
    description: "Maintenance staff, roles, skill-sets and assigned departments.",
    href: "/settings",
    icon: Users,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  {
    label: "Suppliers",
    description: "Parts and service providers with categories and payment terms.",
    href: "/inventory",
    icon: Truck,
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
  },
  {
    label: "Parts / Inventory",
    description: "Spare parts catalogue with stock levels, reorder alerts and supplier links.",
    href: "/inventory",
    icon: Package,
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
  },
  {
    label: "Meters",
    description: "Odometers, hour-meters and fuel gauges attached to assets.",
    href: "/utilities",
    icon: Gauge,
    color: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-200",
  },
  {
    label: "Job Codes",
    description: "Main jobs and cascading sub-jobs reused across all work orders.",
    href: "/maintenance/job-codes",
    icon: Tag,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
  },
] as const;

export default function MasterDataPage() {
  return (
    <div className="space-y-6 p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
          Admin
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Master Data</h1>
        <p className="mt-1 text-sm text-slate-500">
          Single source of truth for all reference entities. Every transactional module
          references these records — never free-text.
        </p>
      </header>

      {/* Principle callout */}
      <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        <span className="font-semibold">Architecture rule:</span> Any field that references a
        known entity must use the{" "}
        <code className="rounded bg-brand-100 px-1 py-0.5 text-xs font-semibold">
          &lt;EntityPicker&gt;
        </code>{" "}
        component — no manual typing allowed. Manage master records here first.
      </div>

      {/* Entity grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MASTER_ENTITIES.map((entity) => {
          const Icon = entity.icon;
          return (
            <a
              key={entity.href + entity.label}
              href={entity.href}
              className={`group flex flex-col gap-3 rounded-2xl border ${entity.border} ${entity.bg} p-5 transition hover:shadow-md`}
            >
              <div className="flex items-start justify-between">
                <span className={`${entity.color} ${entity.bg} rounded-xl p-2`}>
                  <Icon size={20} />
                </span>
                <ArrowRight
                  size={14}
                  className="mt-1 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{entity.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  {entity.description}
                </p>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
