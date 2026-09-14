"use client";

import type { WorkOrderQueueItem } from "@/lib/work-order-queues-api";
import { MobileRecordCard, ResponsiveDataList } from "@/components/ui/mobile-record-card";

import {
  formatDate,
  getAssetLabel,
  getPriorityClass,
  getStatusClass,
  getTechnicianName,
  toTitleCase
} from "./helpers";

function categoryPath(row: WorkOrderQueueItem) {
  const parts = [row.categoryNameSnapshot, row.typeNameSnapshot, row.issueNameSnapshot].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Unclassified / Legacy";
}

type Props = {
  rows: WorkOrderQueueItem[];
  onOpen: (row: WorkOrderQueueItem) => void;
};

/** Mobile card list — avoids squeezing the desktop WO table onto phones. */
export function WorkOrderMobileCardList({ rows, onOpen }: Props) {
  return (
    <ResponsiveDataList>
      {rows.map((row) => {
        const primaryAction = row.actionRequired?.[0];
        return (
          <MobileRecordCard
            key={row.id}
            title={row.woNumber}
            subtitle={row.title}
            badge={
              <span className={`rounded-full px-2 py-0.5 text-xs ${getPriorityClass(row.priority)}`}>
                {toTitleCase(row.priority)}
              </span>
            }
            fields={[
              {
                label: "Status",
                value: (
                  <span className={`rounded-full px-2 py-0.5 text-xs ${getStatusClass(row.status)}`}>
                    {toTitleCase(row.status.replaceAll("_", " "))}
                    {primaryAction ? ` · ${primaryAction.label}` : ""}
                  </span>
                )
              },
              { label: "Asset", value: getAssetLabel(row) },
              { label: "Technician", value: row.primaryAssigneeName ?? getTechnicianName(row) },
              {
                label: "Due",
                value: `${formatDate(row.dueDate)}${
                  row.overdueDays && row.overdueDays > 0 ? ` (${row.overdueDays}d overdue)` : ""
                }`
              },
              { label: "Category", value: categoryPath(row) }
            ]}
            actions={
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="min-h-11 w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
              >
                View Work Order
              </button>
            }
          />
        );
      })}
    </ResponsiveDataList>
  );
}
