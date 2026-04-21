"use client";

import { Download, Search } from "lucide-react";

const rows = [
  { tag: "AST-1001", name: "Compressor Unit", category: "Machine", status: "Active", location: "Plant A" },
  { tag: "AST-1002", name: "CNC Line 4", category: "Equipment", status: "Under Maintenance", location: "Plant B" },
  { tag: "AST-1003", name: "Boiler Core", category: "Infrastructure", status: "Active", location: "Plant A" }
];

export default function AssetsPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-slate-900">Assets</h2>
        <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Create Asset</button>
      </div>

      <div className="card flex items-center gap-3">
        <Search size={16} className="text-slate-500" />
        <input className="w-full bg-transparent text-sm outline-none" placeholder="Search by tag, category, location" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2">Asset Tag</th>
              <th className="py-2">Name</th>
              <th className="py-2">Category</th>
              <th className="py-2">Status</th>
              <th className="py-2">Location</th>
              <th className="py-2 text-right">QR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tag} className="border-b border-slate-100">
                <td className="py-3 font-medium text-slate-800">{row.tag}</td>
                <td className="py-3">{row.name}</td>
                <td className="py-3">{row.category}</td>
                <td className="py-3">{row.status}</td>
                <td className="py-3">{row.location}</td>
                <td className="py-3 text-right">
                  <button className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-100">
                    <Download size={12} /> QR
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
