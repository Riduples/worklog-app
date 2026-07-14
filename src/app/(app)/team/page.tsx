import { requireBusinessProfile } from "@/lib/auth";
import { TeamView } from "@/components/team/TeamView";

export default async function TeamPage() {
  await requireBusinessProfile();
  return <TeamView />;
}
