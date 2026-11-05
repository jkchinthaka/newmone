import { MasterListPage } from "@/components/admin/master-list-page";

export default function Page() {
  return <MasterListPage kind="unit" title="Units of measure" help="Used for parts, fuel and meters. Add a unit once and pick it everywhere." placeholder="New unit, e.g. Litre" showCode codePlaceholder="Short form, e.g. L" />;
}
