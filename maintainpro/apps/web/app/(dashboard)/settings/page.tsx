export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900">Settings</h2>
      <section className="card space-y-3">
        <h3 className="text-sm font-medium text-slate-700">User Profile</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" defaultValue="Platform Admin" />
          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" defaultValue="admin@maintainpro.local" />
        </div>
      </section>
      <section className="card space-y-3">
        <h3 className="text-sm font-medium text-slate-700">Role Management</h3>
        <p className="text-sm text-slate-600">Configure SUPER_ADMIN, ADMIN, MANAGER, TECHNICIAN, DRIVER, and VIEWER access matrices.</p>
      </section>
      <section className="card space-y-3">
        <h3 className="text-sm font-medium text-slate-700">System Configuration</h3>
        <p className="text-sm text-slate-600">Manage notification channels, SLA thresholds, utility rates, and integration credentials.</p>
      </section>
    </div>
  );
}
