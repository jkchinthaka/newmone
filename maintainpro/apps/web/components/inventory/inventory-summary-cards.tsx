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
    title: "ERP Snapshot",
    accent: "from-emerald-500 to-teal-600",
    icon: Sparkles,
    renderValue: (summary) => String(summary.onHand),
    subtitle: () => "Last synchronized Bileeta quantity"
  },
  {
    key: "all",
    title: "Advisory",
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
    subtitle: () => "Advisory, from the ERP snapshot"
  },
  {
    key: "out",
    title: "Out of Stock",
    accent: "from-red-600 to-rose-700",
    icon: PackageSearch,
    renderValue: (summary) => String(summary.outOfStockCount),
    subtitle: () => "ERP snapshot quantity is zero"
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
      <div className="summary-strip">
        {cards.map((card, index) => {
          const isActive = activeCard === card.key && (card.title === "Total Items" || card.title === "Low Stock" || card.title === "Out of Stock");

          return (
            <motion.button
              key={`${card.title}-${index}`}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
              onClick={() => onCardSelect(card.key)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-md border border-brand-100 bg-white px-3 py-2 text-left text-sm text-ink ${
                isActive ? "border-brand-600 bg-brand-50" : ""
              }`}
            >
              <div className="text-ink">
                <p className="text-sm text-brand-800">{card.title}</p>
                <p className="text-lg font-semibold tabular-nums">{card.renderValue(summary)}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="summary-strip">
        {operational.map((item) => (
          <span key={item.label} className="text-sm text-ink">
            <span className="font-semibold tabular-nums">{item.value}</span> {item.label}
          </span>
        ))}
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
