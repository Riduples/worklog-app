import { requireBusinessProfile } from "@/lib/auth";
import { CostCalculatorView } from "@/components/recipes/CostCalculatorView";

export default async function RecipesPage() {
  await requireBusinessProfile();
  return <CostCalculatorView />;
}
