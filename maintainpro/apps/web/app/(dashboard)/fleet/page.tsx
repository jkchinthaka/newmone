"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Battery,
  Car,
  Clock,
  FileWarning,
  Loader2,
  ShieldAlert,
  Wrench
} from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { getApiErrorMessage } from "@/lib/api-client";
import { getFleetOverview, type FleetOverviewSummary } from "@/lib/fleet-lifecycle-api";

const FleetMap = dynamic(
  () => import("@/components/charts/fleet-map").then((mod) => mod.FleetMap),
  { ssr: false }
);

type OverviewCard = {
  label: string;
  value: number;
  icon: React.ElementType;
  href: string;
  urgent?: boolean;
};

function SummaryCard({ card }: { card: OverviewCard }) {
  const Icon = card.icon;
  return (
    <Link
      href={card.href as any}
      className={`flex items-start gap-3 rounded-xl border bg-white p-4 shadow-sm transition-colors hover:bg-slate-50 ${
        card.urgent && card.value > 0
          ? "border-red-200 bg-red-50 hover:bg-red-100"
          : "border-slate-200"
      }`}
    >
      <div
        className={`mt-0.5 rounded-lg p-2 ${
          card.urgent && card.value > 0 ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{card.value}</p>
        <p className="text-xs text-slate-500">{card.label}</p>
      </div>
    </Link>
  );
}

export default function FleetPage() {
  const [summary, setSummary] = useState<FleetOverviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFleetOverview();
      setSummary(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load fleet overview"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cards: OverviewCard[] = summary
    ? [
        {
          label: "Service overdue",
          value: summary.overdueService,
          icon: Clock,
          href: "/vehicles",
          urgent: true
        },
        {
          label: "Due for service (30 d)",
          value: summary.dueService,
          icon: Wrench,
          href: "/vehicles"
        },
        {
          label: "Documents expiring (30 d)",
          value: summary.expiringDocs,
          icon: FileWarning,
          href: "/compliance"
        },
        {
          label: "Gate-blocked vehicles",
          value: summary.blockedVehicles,
          icon: ShieldAlert,
          href: "/fleet/gate",
          urgent: true
        },
        {
          label: "Open accident repairs",
          value: summary.openRepairs,
          icon: AlertTriangle,
          href: "/accidents"
        },
        {
          label: "Out of service",
          value: summary.outOfService,
          icon: Car,
          href: "/vehicles",
          urgent: true
        },
        {
          label: "Active tyre issues (poor/disposed)",
          value: summary.activeTyreIssues,
          icon: AlertTriangle,
          href: "/fleet"
        },
        {
          label: "Batteries warranty expiring (30 d)",
          value: summary.batteriesWarrantyExpiring,
          icon: Battery,
          href: "/fleet"
        }
      ]
    : [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageBreadcrumbs />

      {/* Fleet secondary navigation */}
      <nav className="flex flex-wrap gap-2 text-sm">
        {[
          { label: "Vehicles", href: "/vehicles" },
          { label: "Gate", href: "/fleet/gate" },
          { label: "Accidents", href: "/accidents" },
          { label: "Claims", href: "/insurance-claims" },
          { label: "Traffic Fines", href: "/traffic-fines" },
          { label: "Compliance", href: "/compliance" }
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href as any}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Overview cards */}
      {loading ? (
        <div className="flex min-h-28 items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading fleet overview…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error} —{" "}
          <button
            onClick={() => void refresh()}
            className="underline hover:no-underline"
          >
            retry
          </button>
        </div>
      ) : (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Fleet overview</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {cards.map((card) => (
              <SummaryCard key={card.label} card={card} />
            ))}
          </div>
          {summary && (
            <p className="mt-2 text-right text-xs text-slate-400">
              As of {new Date(summary.asOf).toLocaleTimeString()}
            </p>
          )}
        </section>
      )}

      {/* Fleet map below overview */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Live map</h2>
        <div className="-mx-4 sm:-mx-6">
          <FleetMap />
        </div>
      </section>
    </div>
  );
}
