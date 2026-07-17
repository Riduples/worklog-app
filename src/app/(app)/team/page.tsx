import { requirePlanAccess } from "@/lib/auth";
import { TeamView } from "@/components/team/TeamView";

export default async function TeamPage() {
  await requirePlanAccess("team");
  return <TeamView />;
}
