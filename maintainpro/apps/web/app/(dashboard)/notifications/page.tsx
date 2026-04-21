const notifications = [
  { id: "1", title: "Work order assigned", unread: true },
  { id: "2", title: "Utility bill due in 7 days", unread: true },
  { id: "3", title: "Vehicle service milestone reached", unread: false }
];

export default function NotificationsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900">Notifications</h2>
        <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-100">Mark all read</button>
      </div>
      <div className="space-y-2">
        {notifications.map((item) => (
          <article key={item.id} className={`card ${item.unread ? "border-brand-200" : ""}`}>
            <p className="text-sm font-medium text-slate-800">{item.title}</p>
            <p className="mt-1 text-xs text-slate-500">{item.unread ? "Unread" : "Read"}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
