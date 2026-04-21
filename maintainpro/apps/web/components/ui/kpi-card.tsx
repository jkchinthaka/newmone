type KpiCardProps = {
  label: string;
  value: string;
  delta?: string;
};

export function KpiCard({ label, value, delta }: KpiCardProps) {
  return (
    <div className="card">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value mt-2">{value}</p>
      {delta ? <p className="mt-2 text-xs text-emerald-600">{delta}</p> : null}
    </div>
  );
}
