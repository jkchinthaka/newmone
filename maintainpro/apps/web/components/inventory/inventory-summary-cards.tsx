import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, PackageSearch, RefreshCcw, ShieldAlert, Sparkles, Undo2 } from "lucide-react";
import { motion } from "framer-motion";

import { formatCurrency } from "./helpers";
import { InventoryDashboardKpis, InventoryInsights, InventorySummary } from "./types";

type SummaryCardKey = "all" | "low" | "critical" | "out" | "pending";

type InventorySummaryCardsProps = {
  summary: InventorySummary;
  insights: InventoryInsights;
  dashboard?: InventoryDashboardKpis | null;
  activeCard: SummaryCardKey;
  onCardSelect: (key: SummaryCardKey) => void;
};

const cards: Array<{
  key: SummaryCardKey;
  title: string;
  accent: string;
  icon: typeof Boxes;
  renderValue: (summary: InventorySummary) => string;
  subtitle: (summary: InventorySummary) => string;
}> = [
  {
    key: "all",
    title: "Total Items",
    accent: "from-sky-500 to-blue-600",
    icon: Boxes,
    renderValue: (summary) => String(summary.totalItems),
    subtitle: () => "Active items in item master"
  },
  {
    key: "all",
    title: "On Hand",
    accent: "from-emerald-500 to-teal-600",
    icon: Sparkles,
    renderValue: (summary) => String(summary.onHand),
    subtitle: (summary) => `Available ${summary.available}`
  },
  {
    key: "all",
    title: "Available",
    accent: "from-cyan-500 to-sky-700",
    icon: ShieldAlert,
    renderValue: (summary) => String(summary.available),
    subtitle: (summary) => `Reserved ${summary.reserved}`
  },
  {
    key: "all",
    title: "Reserved",
    accent: "from-indigo-500 to-violet-700",
    icon: RefreshCcw,
    renderValue: (summary) => String(summary.reserved),
    subtitle: () => "Held for approved work orders"
  },
  {
    key: "low",
    title: "Low Stock",
    accent: "from-amber-500 to-orange-600",
    icon: AlertTriangle,
    renderValue: (summary) => String(summary.lowStockCount),
    subtitle: () => "Items below minimum stock"
  },
  {
    key: "out",
    title: "Out of Stock",
    accent: "from-red-600 to-rose-700",
    icon: PackageSearch,
    renderValue: (summary) => String(summary.outOfStockCount),
    subtitle: () => "Immediate replenishment needed"
  }
];

export function InventorySummaryCards({ summary, insights, dashboard, activeCard, onCardSelect }: InventorySummaryCardsProps) {
  const operational = [
    { label: "Today IN", value: dashboard?.todayIn ?? 0, icon: ArrowDownToLine },
    { label: "Today OUT", value: dashboard?.todayOut ?? 0, icon: ArrowUpFromLine },
    { label: "Today Returns", value: dashboard?.todayReturns ?? 0, icon: Undo2 },
    { label: "Today Adjustments", value: dashboard?.todayAdjustments ?? 0, icon: RefreshCcw },
    { label: "Pending Imports", value: dashboard?.pendingImports ?? 0, icon: AlertTriangle },
    { label: "Import Errors", value: dashboard?.importErrors ?? 0, icon: ShieldAlert }
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-6 md:grid-cols-2">
        {cards.map((card, index) => {
          const Icon = card.icon;
          const isActive = activeCard === card.key && (card.title === "Total Items" || card.title === "Low Stock" || card.title === "Out of Stock");

          return (
            <motion.button
              key={`${card.title}-${index}`}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
              onClick={() => onCardSelect(card.key)}
              className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                isActive ? "border-brand-500 shadow-lg shadow-brand-100" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-md"
              }`}
            >
              <div className={`pointer-events-none absolute inset-0 opacity-90 bg-gradient-to-br ${card.accent}`} />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(255,255,255,0.35),transparent_45%)]" />
              <div className="relative text-white">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/85">{card.title}</p>
                  <span className="rounded-lg bg-white/20 p-2 backdrop-blur-sm">
                    <Icon size={16} />
                  </span>
                </div>
                <p className="mt-4 text-2xl font-semibold leading-none">{card.renderValue(summary)}</p>
                <p className="mt-2 text-xs text-white/90">{card.subtitle(summary)}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {operational.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                <Icon size={14} className="text-slate-400" />
              </div>
              <p className="mt-2 text-xl font-semibold text-slate-900">{item.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 to-sky-50 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-brand-700">Inventory Value</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {summary.totalValue == null ? "Not shown — reliable cost data is incomplete" : formatCurrency(summary.totalValue)}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-amber-700">Stale Inventory</p>
          <p className="mt-2 text-lg font-semibold text-amber-900">{insights.stalePartCount} items with no movement for 60+ days</p>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-700" />
            <p className="text-xs uppercase tracking-[0.14em] text-indigo-700">Smart Recommendation</p>
          </div>
          <p className="mt-2 text-sm text-indigo-900">
            Average daily consumption is <strong>{insights.avgDailyConsumption.toFixed(2)}</strong>. Consider enabling auto-reorder for critical parts.
          </p>
        </div>
      </div>
    </div>
  );
}

export type { SummaryCardKey };
