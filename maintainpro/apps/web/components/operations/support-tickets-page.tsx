"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState } from "@/components/ui/page-state";
import { createSupportTicket, fetchSupportTickets } from "@/lib/operations-api";

export function SupportTicketsPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const query = useQuery({ queryKey: ["support", "tickets"], queryFn: () => fetchSupportTickets() });

  const createMutation = useMutation({
    mutationFn: () =>
      createSupportTicket({
        title,
        description,
        category: "OTHER",
        severity: "MEDIUM",
        environment: "PRODUCTION"
      }),
    onSuccess: () => {
      toast.success("Support ticket created");
      setTitle("");
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: ["support"] });
    },
    onError: () => toast.error("Could not create ticket")
  });

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">Support Tickets</h2>
      <p className="text-sm text-slate-500">Do not paste passwords, tokens, or secret URLs.</p>

      <form
        className="max-w-xl space-y-3 rounded-xl border bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
      >
        <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea className="w-full rounded border px-3 py-2 text-sm" rows={4} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required />
        <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm text-white" disabled={createMutation.isPending}>
          Create ticket
        </button>
      </form>

      {query.isLoading ? (
        <InlineLoadingState label="Loading tickets…" />
      ) : (
        <ul className="space-y-2">
          {(query.data ?? []).map((t) => (
            <li key={t.id} className="rounded-lg border bg-white p-3 text-sm">
              <p className="font-medium">{t.ticketNo} — {t.title}</p>
              <p className="text-slate-500">{t.status} · {t.severity} · {t.priority}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
