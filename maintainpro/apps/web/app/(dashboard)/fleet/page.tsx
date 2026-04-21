import dynamic from "next/dynamic";

const FleetMap = dynamic(() => import("@/components/charts/fleet-map").then((mod) => mod.FleetMap), {
  ssr: false
});

export default function FleetPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900">Fleet Live Map</h2>
      <p className="text-sm text-slate-500">Live GPS simulation updates for active vehicles over websocket stream.</p>
      <FleetMap />
    </div>
  );
}
