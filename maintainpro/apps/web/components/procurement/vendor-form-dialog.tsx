"use client";

import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";

export interface VendorRecord {
  id: string;
  name: string;
  vendorCode?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  taxNumber?: string | null;
  serviceCategories?: string[] | string | null;
  insuranceRequired?: boolean | null;
  insuranceExpiresAt?: string | null;
  notes?: string | null;
}

const SUGGESTED_CATEGORIES = ["Electrical", "Mechanical", "Tyres", "Pumps", "Civil", "IT", "Spare parts", "Transport"];

function parseCategories(value: VendorRecord["serviceCategories"]): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

const EMPTY = {
  name: "",
  vendorCode: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  website: "",
  taxNumber: "",
  insuranceRequired: false,
  insuranceExpiresAt: "",
  notes: ""
};

const INPUT = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

export function VendorFormDialog({
  open,
  vendor,
  onClose,
  onSaved
}: {
  open: boolean;
  vendor?: VendorRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = Boolean(vendor);

  useEffect(() => {
    if (!open) return;
    setCustomCategory("");
    if (vendor) {
      setForm({
        name: vendor.name ?? "",
        vendorCode: vendor.vendorCode ?? "",
        contactName: vendor.contactName ?? "",
        email: vendor.email ?? "",
        phone: vendor.phone ?? "",
        address: vendor.address ?? "",
        website: vendor.website ?? "",
        taxNumber: vendor.taxNumber ?? "",
        insuranceRequired: Boolean(vendor.insuranceRequired),
        insuranceExpiresAt: vendor.insuranceExpiresAt ? vendor.insuranceExpiresAt.slice(0, 10) : "",
        notes: vendor.notes ?? ""
      });
      setCategories(parseCategories(vendor.serviceCategories));
    } else {
      setForm(EMPTY);
      setCategories([]);
    }
  }, [open, vendor]);

  if (!open) return null;

  const set = (key: keyof typeof EMPTY, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const toggleCategory = (name: string) =>
    setCategories((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  const addCustom = () => {
    const name = customCategory.trim();
    if (name && !categories.includes(name)) setCategories((current) => [...current, name]);
    setCustomCategory("");
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!form.name.trim()) {
      toast.error("Vendor name is required.");
      return;
    }
    if (form.insuranceRequired && !form.insuranceExpiresAt) {
      toast.error("Enter the insurance expiry date, or untick “Insurance required”.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        vendorCode: form.vendorCode.trim() || undefined,
        contactName: form.contactName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        website: form.website.trim() || undefined,
        taxNumber: form.taxNumber.trim() || undefined,
        serviceCategories: categories,
        insuranceRequired: form.insuranceRequired,
        insuranceExpiresAt: form.insuranceExpiresAt || null,
        notes: form.notes.trim() || undefined
      };
      if (vendor) await apiClient.patch(`/suppliers/${vendor.id}`, payload);
      else await apiClient.post("/suppliers", payload);
      toast.success(vendor ? "Vendor updated" : "Vendor created");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not save the vendor."));
    } finally {
      setBusy(false);
    }
  }

  const shown = Array.from(new Set([...SUGGESTED_CATEGORIES, ...categories]));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" role="presentation">
      <form
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit vendor" : "Add vendor"}
        onSubmit={(event) => void submit(event)}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{editing ? "Edit vendor" : "Add vendor"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Basic</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              Name <span className="text-red-600">*</span>
              <input required className={INPUT} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Lanka Tyre Traders" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Vendor code
              <input className={INPUT} value={form.vendorCode} onChange={(e) => set("vendorCode", e.target.value)} placeholder="Optional" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Contact name
              <input className={INPUT} value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input type="email" className={INPUT} value={form.email} onChange={(e) => set("email", e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Phone
              <input className={INPUT} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </label>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">What they do</p>
          <div className="flex flex-wrap gap-2">
            {shown.map((name) => {
              const on = categories.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleCategory(name)}
                  className={`rounded-full border px-3 py-1 text-xs ${on ? "border-brand-600 bg-brand-600 font-semibold text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                >
                  {on ? "" : "+ "}{name}
                </button>
              );
            })}
            <span className="inline-flex items-center gap-1">
              <input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                placeholder="Other…"
                aria-label="Add another service category"
                className="h-8 w-28 rounded-full border border-slate-200 px-3 text-xs"
              />
            </span>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">More details</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              Address
              <input className={INPUT} value={form.address} onChange={(e) => set("address", e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Website
              <input className={INPUT} value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Tax / VAT number
              <input className={INPUT} value={form.taxNumber} onChange={(e) => set("taxNumber", e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={form.insuranceRequired} onChange={(e) => set("insuranceRequired", e.target.checked)} />
              Insurance required
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Insurance expires
              <input type="date" className={INPUT} value={form.insuranceExpiresAt} onChange={(e) => set("insuranceExpiresAt", e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              Notes
              <textarea rows={2} className={INPUT} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 px-3 text-sm">Cancel</button>
          <button type="submit" disabled={busy} className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Saving…" : editing ? "Save changes" : "Create vendor"}
          </button>
        </div>
      </form>
    </div>
  );
}
