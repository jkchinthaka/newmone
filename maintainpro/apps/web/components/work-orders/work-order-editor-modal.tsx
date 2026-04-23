"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";

import { asDateInputValue, toTitleCase } from "./helpers";
import { WORK_ORDER_PRIORITIES, WORK_ORDER_TYPES, type UpdateWorkOrderInput, type WorkOrder } from "./types";

type WorkOrderEditorMode = "create" | "edit";

type WorkOrderCreateFormValue = {
  title: string;
  description: string;
  priority: (typeof WORK_ORDER_PRIORITIES)[number];
  type: (typeof WORK_ORDER_TYPES)[number];
  dueDate?: string;
  assetId?: string;
  vehicleId?: string;
  scheduleId?: string;
};

type WorkOrderEditFormValue = UpdateWorkOrderInput;

type WorkOrderEditorModalProps = {
  open: boolean;
  mode: WorkOrderEditorMode;
  workOrder?: WorkOrder | null;
  submitting: boolean;
  onClose: () => void;
  onCreate: (values: WorkOrderCreateFormValue) => void;
  onEdit: (values: WorkOrderEditFormValue) => void;
};

export function WorkOrderEditorModal({
  open,
  mode,
  workOrder,
  submitting,
  onClose,
  onCreate,
  onEdit
}: WorkOrderEditorModalProps) {
  const isCreateMode = mode === "create";

  const initialState = useMemo(
    () => ({
      title: workOrder?.title ?? "",
      description: workOrder?.description ?? "",
      priority: workOrder?.priority ?? "MEDIUM",
      type: workOrder?.type ?? "CORRECTIVE",
      dueDate: asDateInputValue(workOrder?.dueDate),
      assetId: workOrder?.assetId ?? "",
      vehicleId: workOrder?.vehicleId ?? "",
      scheduleId: workOrder?.scheduleId ?? "",
      estimatedCost: workOrder?.estimatedCost?.toString() ?? "",
      estimatedHours: workOrder?.estimatedHours?.toString() ?? ""
    }),
    [workOrder]
  );

  const [formState, setFormState] = useState(initialState);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormState(initialState);
  }, [initialState, open]);

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
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {isCreateMode ? "Create Work Order" : `Edit ${workOrder?.woNumber ?? "Work Order"}`}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {isCreateMode
                    ? "Provide details to create a new work order."
                    : "Update editable work order fields and save changes."}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();

                if (!formState.title.trim() || !formState.description.trim()) {
                  return;
                }

                if (isCreateMode) {
                  onCreate({
                    title: formState.title.trim(),
                    description: formState.description.trim(),
                    priority: formState.priority,
                    type: formState.type,
                    dueDate: formState.dueDate ? new Date(`${formState.dueDate}T00:00:00.000Z`).toISOString() : undefined,
                    assetId: formState.assetId.trim() || undefined,
                    vehicleId: formState.vehicleId.trim() || undefined,
                    scheduleId: formState.scheduleId.trim() || undefined
                  });
                  return;
                }

                onEdit({
                  title: formState.title.trim(),
                  description: formState.description.trim(),
                  dueDate: formState.dueDate ? new Date(`${formState.dueDate}T00:00:00.000Z`).toISOString() : undefined,
                  estimatedCost: formState.estimatedCost ? Number(formState.estimatedCost) : undefined,
                  estimatedHours: formState.estimatedHours ? Number(formState.estimatedHours) : undefined
                });
              }}
              className="space-y-4 px-5 py-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                  <span className="font-medium">Title</span>
                  <input
                    required
                    value={formState.title}
                    onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                  />
                </label>

                <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                  <span className="font-medium">Description</span>
                  <textarea
                    required
                    value={formState.description}
                    onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                  />
                </label>

                {isCreateMode ? (
                  <>
                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-medium">Priority</span>
                      <select
                        value={formState.priority}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            priority: event.target.value as WorkOrderCreateFormValue["priority"]
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                      >
                        {WORK_ORDER_PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {toTitleCase(priority)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-medium">Type</span>
                      <select
                        value={formState.type}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            type: event.target.value as WorkOrderCreateFormValue["type"]
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                      >
                        {WORK_ORDER_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {toTitleCase(type)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <>
                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-medium">Estimated Cost</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formState.estimatedCost}
                        onChange={(event) =>
                          setFormState((current) => ({ ...current, estimatedCost: event.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                      />
                    </label>

                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-medium">Estimated Hours</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={formState.estimatedHours}
                        onChange={(event) =>
                          setFormState((current) => ({ ...current, estimatedHours: event.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                      />
                    </label>
                  </>
                )}

                <label className="space-y-1 text-sm text-slate-700">
                  <span className="font-medium">Due Date</span>
                  <input
                    type="date"
                    value={formState.dueDate}
                    onChange={(event) => setFormState((current) => ({ ...current, dueDate: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                  />
                </label>

                {isCreateMode ? (
                  <>
                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-medium">Asset ID (optional)</span>
                      <input
                        value={formState.assetId}
                        onChange={(event) => setFormState((current) => ({ ...current, assetId: event.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                      />
                    </label>

                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-medium">Vehicle ID (optional)</span>
                      <input
                        value={formState.vehicleId}
                        onChange={(event) => setFormState((current) => ({ ...current, vehicleId: event.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                      />
                    </label>

                    <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                      <span className="font-medium">Schedule ID (optional)</span>
                      <input
                        value={formState.scheduleId}
                        onChange={(event) => setFormState((current) => ({ ...current, scheduleId: event.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                      />
                    </label>
                  </>
                ) : null}
              </div>

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
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                  {isCreateMode ? "Create" : "Save Changes"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
