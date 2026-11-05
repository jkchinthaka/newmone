"use client";

import { useEffect, useId, useState, type InputHTMLAttributes } from "react";

import { apiClient } from "@/lib/api-client";

type Kind = "unit" | "skill" | "make";
interface Item {
  name: string;
  code?: string | null;
}

/** Items from a master list (active only). Fails quietly: the field still works as plain text. */
export function useMasterList(kind: Kind): Item[] {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    let alive = true;
    apiClient
      .get<{ data: Item[] }>(`/master-data/lists/${kind}`)
      .then((res) => alive && setItems(res.data.data ?? []))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [kind]);
  return items;
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "list" | "onChange" | "value"> & {
  kind: Kind;
  value: string;
  onValueChange: (value: string) => void;
  /** Use the short form (e.g. "kg") as the value instead of the full name. */
  useCode?: boolean;
};

/** Text input that suggests entries from a master list but still accepts anything typed. */
export function MasterListInput({ kind, value, onValueChange, useCode, ...rest }: Props) {
  const id = useId();
  const items = useMasterList(kind);
  return (
    <>
      <input {...rest} list={id} value={value} onChange={(e) => onValueChange(e.target.value)} />
      <datalist id={id}>
        {items.map((item) => {
          const v = useCode && item.code ? item.code : item.name;
          return <option key={item.name} value={v} label={useCode && item.code ? item.name : undefined} />;
        })}
      </datalist>
    </>
  );
}

/** Tap-to-add suggestions for a comma separated text field. */
export function MasterListChips({ kind, value, onValueChange }: { kind: Kind; value: string; onValueChange: (value: string) => void }) {
  const items = useMasterList(kind);
  const chosen = value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const open = items.filter((i) => !chosen.includes(i.name.toLowerCase()));
  if (open.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {open.map((item) => (
        <button
          key={item.name}
          type="button"
          onClick={() => onValueChange(value.trim() ? `${value.trim().replace(/,$/, "")}, ${item.name}` : item.name)}
          className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs text-slate-600 hover:border-brand-300 hover:text-brand-700"
        >
          + {item.name}
        </button>
      ))}
    </div>
  );
}
