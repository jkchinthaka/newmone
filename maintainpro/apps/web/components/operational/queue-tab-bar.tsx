"use client";

import { ChevronDown } from "lucide-react";

export type QueueTabItem = {
  key: string;
  label: string;
  count?: number;
  /** Red count pill when something is waiting (late, sent back). */
  tone?: "alert";
};

type Props = {
  label: string;
  primary: QueueTabItem[];
  more: QueueTabItem[];
  selectedKey: string;
  moreOpen: boolean;
  onMoreOpenChange: (open: boolean) => void;
  onSelect: (key: string) => void;
  /** Show a count pill only when it is above zero. */
  hideZeroCounts?: boolean;
};

/** Primary queues stay on one row. Secondary queues open in a popover under the More button. */
export function QueueTabBar({ label, primary, more, selectedKey, moreOpen, onMoreOpenChange, onSelect, hideZeroCounts = false }: Props) {
  const selectedMore = more.find((item) => item.key === selectedKey);
  return (
    <div>
      <div className="flex min-w-0 items-center gap-1 border-b border-slate-200 px-2 py-2">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist" aria-label={label}>
          {primary.map((item) => {
            const selected = item.key === selectedKey;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onSelect(item.key)}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                  selected ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
                {item.count != null && !(hideZeroCounts && item.count === 0) ? (
                  <span className={`ml-1.5 rounded-full px-1.5 text-xs ${selected ? "bg-white text-brand-900" : item.tone === "alert" && item.count > 0 ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-800"}`}>
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {more.length ? (
          <div className="relative shrink-0">
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => onMoreOpenChange(!moreOpen)}
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                selectedMore ? "bg-brand-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {selectedMore ? selectedMore.label : "More"}
              <ChevronDown size={14} aria-hidden />
            </button>
            {moreOpen ? (
              <>
                <button type="button" aria-label="Close menu" tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => onMoreOpenChange(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                  {more.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      aria-pressed={item.key === selectedKey}
                      onClick={() => {
                        onSelect(item.key);
                        onMoreOpenChange(false);
                      }}
                      className={`flex min-h-10 w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                        item.key === selectedKey ? "bg-brand-50 font-medium text-brand-800" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.count != null ? <span className="text-xs text-slate-500">{item.count}</span> : null}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
