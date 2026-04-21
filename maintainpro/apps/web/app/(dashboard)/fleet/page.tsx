import dynamic from "next/dynamic";

const FleetMap = dynamic(() => import("@/components/charts/fleet-map").then((mod) => mod.FleetMap), {
  ssr: false
});

export default function FleetPage() {
  return (
    <div className="-m-4 sm:-m-6">
      <FleetMap />
    </div>
  );
}
