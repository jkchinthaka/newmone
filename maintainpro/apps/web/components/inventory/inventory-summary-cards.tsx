import { AlertTriangle, Boxes, PackageSearch, ShoppingCart, Sparkles, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

import { formatCurrency } from "./helpers";
import { InventoryInsights, InventorySummary } from "./types";

type SummaryCardKey = "all" | "low" | "critical" | "out" | "pending";

type InventorySummaryCardsProps = {
  summary: InventorySummary;
  insights: InventoryInsights;
  activeCard: SummaryCardKey;
  onCardSelect: (key: SummaryCardKey) => void;
};

const cards: Array<{
  key: SummaryCardKey;
  title: string;
  accent: string;
  icon: typeof Boxes;
  renderValue: (summary: InventorySummary) => string;
  subtitle: string;
}> = [
  {
    key: "all",
    title: "Total Inventory Value",
    accent: "from-sky-500 to-blue-600",
    icon: Boxes,
    renderValue: (summary) => formatCurrency(summary.totalValue),
    subtitle: "Across all active spare parts"
  },
  {
    key: "low",
    title: "Low Stock",
    accent: "from-amber-500 to-orange-600",
    icon: TrendingDown,
    renderValue: (summary) => String(summary.lowStockCount),
    subtitle: "Items below minimum stock"
  },
  {
    key: "critical",
    title: "Critical",
    accent: "from-rose-500 to-red-600",
    icon: AlertTriangle,
    renderValue: (summary) => String(summary.criticalCount),
    subtitle: "Items below reorder point"
  },
  {
    key: "out",
    title: "Out of Stock",
    accent: "from-red-600 to-rose-700",
    icon: PackageSearch,
    renderValue: (summary) => String(summary.outOfStockCount),
    subtitle: "Immediate replenishment needed"
  },
  {
    key: "pending",
    title: "Pending Purchase Orders",
    accent: "from-indigo-500 to-blue-700",
    icon: ShoppingCart,
    renderValue: (summary) => String(summary.pendingPurchaseOrders),
    subtitle: "Open procurement queue"
  }
];

export function InventorySummaryCards({ summary, insights, activeCard, onCardSelect }: InventorySummaryCardsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-5 md:grid-cols-2">
        {cards.map((card, index) => {
          const Icon = card.icon;
          const isActive = activeCard === card.key;

          return (
            <motion.button
              key={card.key}
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
                <p className="mt-2 text-xs text-white/90">{card.subtitle}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 to-sky-50 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-brand-700">Most Used Part (30 days)</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {insights.mostUsedPart ? `${insights.mostUsedPart.partName} (${insights.mostUsedPart.quantity})` : "No usage data yet"}
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
