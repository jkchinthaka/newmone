"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, PauseCircle, X } from "lucide-react";

import type { WorkOrder } from "./types";

type HoldWorkOrderModalProps = {
  open: boolean;
  workOrder: WorkOrder | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { delayReason: string }) => void;
};

export function HoldWorkOrderModal({
  open,
  workOrder,
  submitting,
  onClose,
  onSubmit
}: HoldWorkOrderModalProps) {
  const [delayReason, setDelayReason] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setDelayReason(workOrder?.delayReason ?? "");
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
                <h3 className="text-lg font-semibold text-slate-900">Place Work Order On Hold</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Capture why {workOrder?.woNumber ?? "this work order"} is being paused before it can be resumed.
                </p>
              </div>
              <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
                <X size={15} />
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();

                const reason = delayReason.trim();
                if (reason.length < 3) {
                  return;
                }

                onSubmit({ delayReason: reason });
              }}
              className="space-y-4 px-5 py-4"
            >
              <label className="space-y-1 text-sm text-slate-700">
                <span className="font-medium">Hold reason (required)</span>
                <textarea
                  required
                  minLength={3}
                  rows={3}
                  value={delayReason}
                  onChange={(event) => setDelayReason(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                  placeholder="Explain what is blocking this work order..."
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
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-70"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <PauseCircle size={14} />}
                  Put On Hold
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
