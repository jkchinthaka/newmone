"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, X } from "lucide-react";

import type { WorkOrder } from "./types";

type CompleteWorkOrderModalProps = {
  open: boolean;
  workOrder: WorkOrder | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { actualCost: number; actualHours: number }) => void;
};

export function CompleteWorkOrderModal({
  open,
  workOrder,
  submitting,
  onClose,
  onSubmit
}: CompleteWorkOrderModalProps) {
  const [actualCost, setActualCost] = useState("");
  const [actualHours, setActualHours] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setActualCost(workOrder?.actualCost?.toString() ?? "");
    setActualHours(workOrder?.actualHours?.toString() ?? "");
  }, [open, workOrder]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Complete Work Order</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Enter actual cost and hours to complete {workOrder?.woNumber ?? "this work order"}.
                </p>
              </div>
              <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
                <X size={15} />
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                const cost = Number(actualCost);
                const hours = Number(actualHours);

                if (!Number.isFinite(cost) || !Number.isFinite(hours) || cost <= 0 || hours <= 0) {
                  return;
                }

                onSubmit({ actualCost: cost, actualHours: hours });
              }}
              className="space-y-4 px-5 py-4"
            >
              <label className="space-y-1 text-sm text-slate-700">
                <span className="font-medium">Actual Cost</span>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={actualCost}
                  onChange={(event) => setActualCost(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span className="font-medium">Actual Hours</span>
                <input
                  required
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={actualHours}
                  onChange={(event) => setActualHours(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                />
              </label>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-70"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Mark Completed
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
