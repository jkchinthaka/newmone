import { MasterListPage } from "@/components/admin/master-list-page";

export default function Page() {
  return <MasterListPage kind="make" title="Makes & models" help="Manufacturers and models to pick instead of typing. Add as Toyota Hilux." placeholder="New make or model, e.g. Toyota Hilux" />;
}
