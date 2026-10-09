"use client";

import { ChevronDown } from "lucide-react";

export type QueueTabItem = {
  key: string;
  label: string;
  count?: number;
};

type Props = {
  label: string;
  primary: QueueTabItem[];
  more: QueueTabItem[];
  selectedKey: string;
  moreOpen: boolean;
  onMoreOpenChange: (open: boolean) => void;
  onSelect: (key: string) => void;
};

/** Primary queues stay on one row. Secondary queues open in the page flow so they are not clipped. */
export function QueueTabBar({ label, primary, more, selectedKey, moreOpen, onMoreOpenChange, onSelect }: Props) {
  const selectedMore = more.find((item) => item.key === selectedKey);
  return (
    <div>
      <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-2">
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
                {item.count != null ? (
                  <span className={`ml-1.5 rounded-full px-1.5 text-xs ${selected ? "bg-white/20" : "bg-slate-200"}`}>
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {more.length ? (
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => onMoreOpenChange(!moreOpen)}
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
              selectedMore || moreOpen ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            {selectedMore ? selectedMore.label : "More"}
            <ChevronDown size={14} aria-hidden />
          </button>
        ) : null}
      </div>
      {moreOpen && more.length ? (
        <div className="grid grid-cols-1 gap-1 border-b border-slate-200 px-2 py-2 sm:grid-cols-2 lg:grid-cols-3">
          {more.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={item.key === selectedKey}
              onClick={() => {
                onSelect(item.key);
                onMoreOpenChange(false);
              }}
              className={`flex min-h-10 items-center justify-between rounded-md px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                item.key === selectedKey ? "bg-brand-50 font-medium text-brand-800" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>{item.label}</span>
              {item.count != null ? <span className="text-xs text-slate-500">{item.count}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
