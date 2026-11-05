import { MasterListPage } from "@/components/admin/master-list-page";

export default function Page() {
  return <MasterListPage kind="make" title="Makes" help="Manufacturers and models to pick instead of typing. Add as Toyota Hilux." placeholder="New make, e.g. Toyota" />;
}
