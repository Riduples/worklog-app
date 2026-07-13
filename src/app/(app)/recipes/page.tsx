import { requireBusinessProfile } from "@/lib/auth";
import { RecipesView } from "@/components/recipes/RecipesView";

export default async function RecipesPage() {
  await requireBusinessProfile();
  return <RecipesView />;
}
