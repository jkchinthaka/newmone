import { MasterListPage } from "@/components/admin/master-list-page";

export default function Page() {
  return <MasterListPage kind="skill" title="Skills & trades" help="Electrician, welder, plumber... used when assigning jobs to people." placeholder="New skill, e.g. Welder" />;
}
