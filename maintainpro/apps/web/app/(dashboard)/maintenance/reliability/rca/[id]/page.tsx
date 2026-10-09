"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type Capa = {
  id: string;
  kind: string;
  description: string;
  status: string;
  ownerId: string | null;
  dueDate: string | null;
  evidenceJson: string;
  verifiedAt: string | null;
  verifiedById: string | null;
  verificationNote: string | null;
};

type RcaDetail = {
  id: string;
  status: string;
  source: string | null;
  assetId: string | null;
  failureCode: string | null;
  problemStatement: string;
  impact: string | null;
  ownerId: string | null;
  dueDate: string | null;
  createdAt: string;
  method: string | null;
  rootCause: string | null;
  evidenceJson: string;
  effectiveness: string | null;
  effectivenessNote: string | null;
  effectivenessVerifiedAt: string | null;
  effectivenessVerifiedById: string | null;
  capaActions: Capa[];
  workOrders: Array<{ id: string; woNumber: string; status: string; createdAt: string }>;
  activity: Array<{ id: string; action: string; reason: string | null; createdAt: string; actorId: string | null }>;
};

const METHODS = ["FIVE_WHYS", "FISHBONE", "FAULT_TREE", "OTHER"];

export default function RcaDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const [rootCause, setRootCause] = useState("");
  const [method, setMethod] = useState("FIVE_WHYS");
  const [impact, setImpact] = useState("");
  const [capa, setCapa] = useState({ description: "", kind: "CORRECTIVE", dueDate: "", evidence: "" });
  const [effectiveness, setEffectiveness] = useState("EFFECTIVE");
  const [notes, setNotes] = useState("");

  const query = useQuery({
    queryKey: withTenantScope(["admin", "rca", id]),
    queryFn: async () => (await apiClient.get<{ data: RcaDetail }>(`/reliability/rca/${id}`)).data.data
  });

  const saveAnalysis = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/reliability/rca/${id}`, { rootCause, method, impact });
    },
    onSuccess: () => {
      toast.success("Root cause saved");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "rca", id]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We couldn't save the root cause."))
  });

  const addCapa = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/reliability/rca/${id}/capa`, {
        kind: capa.kind,
        description: capa.description,
        dueDate: capa.dueDate || undefined
      });
    },
    onSuccess: async () => {
      toast.success("CAPA added");
      setCapa({ description: "", kind: "CORRECTIVE", dueDate: "", evidence: "" });
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "rca", id]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We couldn't add the CAPA."))
  });

  const updateCapa = useMutation({
    mutationFn: async (input: { capaId: string; status: string; evidence?: string[]; verificationNote?: string }) => {
      await apiClient.patch(`/reliability/capa/${input.capaId}`, {
        status: input.status,
        evidence: input.evidence,
        verificationNote: input.verificationNote
      });
    },
    onSuccess: () => {
      toast.success("CAPA updated. The RCA stays open until effectiveness is reviewed.");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "rca", id]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We couldn't update the CAPA."))
  });

  const verify = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/reliability/rca/${id}/effectiveness`, { result: effectiveness, notes });
    },
    onSuccess: () => {
      toast.success("Effectiveness recorded");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "rca", id]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We couldn't record effectiveness."))
  });

  if (query.isLoading) return <LoadingState title="Loading RCA" description="Fetching the investigation." />;
  if (query.isError || !query.data) {
    return <ErrorState title="We couldn't load this RCA." description={getApiErrorMessage(query.error, "Request failed")} onRetry={() => query.refetch()} />;
  }
  const rca = query.data;
  const shownRoot = rootCause || rca.rootCause || "";
  const shownImpact = impact || rca.impact || "";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Link href="/maintenance/reliability?tab=rca" className="text-sm text-brand-700 underline">Back to reliability</Link>
      <header>
        <h1 className="page-title">RCA {rca.id.slice(0, 8)}</h1>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-slate-500">Status</dt><dd>{rca.status}</dd></div>
          <div><dt className="text-slate-500">Source</dt><dd>{rca.source || "—"}</dd></div>
          <div><dt className="text-slate-500">Asset</dt><dd className="font-mono text-xs">{rca.assetId || "—"}</dd></div>
          <div><dt className="text-slate-500">Failure code</dt><dd>{rca.failureCode || "—"}</dd></div>
          <div><dt className="text-slate-500">Owner</dt><dd className="font-mono text-xs">{rca.ownerId || "—"}</dd></div>
          <div><dt className="text-slate-500">Created</dt><dd>{new Date(rca.createdAt).toLocaleString()}</dd></div>
          <div><dt className="text-slate-500">Due</dt><dd>{rca.dueDate ? new Date(rca.dueDate).toLocaleDateString() : "—"}</dd></div>
        </dl>
      </header>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Problem statement</h2>
        <p className="mt-2 text-sm text-slate-700">{rca.problemStatement}</p>
      </section>
      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Root cause analysis</h2>
        <label className="block text-sm">Impact
          <textarea className="mt-1 w-full rounded border px-3 py-2" rows={2} value={shownImpact} onChange={(event) => setImpact(event.target.value)} />
        </label>
        <label className="block text-sm">Method
          <select className="mt-1 rounded border px-3 py-2" value={method || rca.method || "FIVE_WHYS"} onChange={(event) => setMethod(event.target.value)}>
            {METHODS.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}
          </select>
        </label>
        <label className="block text-sm">Root cause
          <textarea className="mt-1 w-full rounded border px-3 py-2" rows={4} value={shownRoot} onChange={(event) => setRootCause(event.target.value)} />
        </label>
        <button type="button" className="rounded bg-brand-600 px-4 py-2 text-sm text-white" disabled={saveAnalysis.isPending} onClick={() => saveAnalysis.mutate()}>Save root cause</button>
      </section>
      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">CAPA actions</h2>
        {rca.capaActions.length === 0 ? <p className="text-sm text-slate-600">No CAPA actions yet.</p> : null}
        <ul className="space-y-3">
          {rca.capaActions.map((action) => (
            <li key={action.id} className="rounded border border-slate-200 p-3 text-sm">
              <p className="font-medium">{action.description}</p>
              <p className="text-slate-600">{action.kind} · {action.status} · due {action.dueDate ? new Date(action.dueDate).toLocaleDateString() : "—"}</p>
              <p className="text-slate-600">Owner {action.ownerId || "—"} · verified {action.verifiedAt ? new Date(action.verifiedAt).toLocaleString() : "—"}</p>
              {action.verificationNote ? <p>Verification: {action.verificationNote}</p> : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {action.status === "OPEN" ? <button type="button" className="rounded border px-2 py-1" onClick={() => updateCapa.mutate({ capaId: action.id, status: "IN_PROGRESS" })}>Start</button> : null}
                {action.status === "IN_PROGRESS" ? <button type="button" className="rounded border px-2 py-1" onClick={() => updateCapa.mutate({ capaId: action.id, status: "VERIFIED", evidence: ["completed"], verificationNote: "Work completed and awaiting effectiveness review" })}>Mark completed</button> : null}
              </div>
            </li>
          ))}
        </ul>
        <form className="grid gap-2 border-t border-slate-200 pt-3" onSubmit={(event) => { event.preventDefault(); addCapa.mutate(); }}>
          <select className="rounded border px-3 py-2 text-sm" value={capa.kind} onChange={(event) => setCapa((form) => ({ ...form, kind: event.target.value }))}>
            <option value="CORRECTIVE">Corrective</option>
            <option value="PREVENTIVE">Preventive</option>
          </select>
          <textarea className="rounded border px-3 py-2 text-sm" rows={2} required placeholder="Action" value={capa.description} onChange={(event) => setCapa((form) => ({ ...form, description: event.target.value }))} />
          <input type="date" className="rounded border px-3 py-2 text-sm" value={capa.dueDate} onChange={(event) => setCapa((form) => ({ ...form, dueDate: event.target.value }))} />
          <button type="submit" className="w-fit rounded bg-slate-900 px-3 py-2 text-sm text-white" disabled={addCapa.isPending}>Add CAPA</button>
        </form>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Linked work orders</h2>
        {rca.workOrders.length === 0 ? <p className="mt-2 text-sm text-slate-600">No linked work orders.</p> : (
          <ul className="mt-2 space-y-1 text-sm">
            {rca.workOrders.map((order) => (
              <li key={order.id}><Link className="text-brand-700 underline" href={`/work-orders?wo=${order.id}`}>{order.woNumber}</Link> · {order.status}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Effectiveness review</h2>
        <p className="text-sm text-slate-600">Current: {rca.effectiveness || "Not reviewed"}{rca.effectivenessNote ? ` — ${rca.effectivenessNote}` : ""}</p>
        <select className="rounded border px-3 py-2 text-sm" value={effectiveness} onChange={(event) => setEffectiveness(event.target.value)}>
          <option value="EFFECTIVE">Effective</option>
          <option value="PARTIALLY_EFFECTIVE">Partially effective</option>
          <option value="INEFFECTIVE">Ineffective</option>
        </select>
        <textarea className="w-full rounded border px-3 py-2 text-sm" rows={2} placeholder="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <button type="button" className="rounded bg-brand-600 px-4 py-2 text-sm text-white" disabled={verify.isPending} onClick={() => verify.mutate()}>Record effectiveness</button>
        {rca.effectiveness === "INEFFECTIVE" ? <p className="text-sm text-amber-800">This RCA was reopened so further CAPA can be added.</p> : null}
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Activity</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {rca.activity.length === 0 ? <li>No audit entries yet.</li> : rca.activity.map((entry) => (
            <li key={entry.id}>{new Date(entry.createdAt).toLocaleString()} · {entry.action} · {entry.reason || "—"}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
