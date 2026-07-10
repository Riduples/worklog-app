import { requireBusinessProfile } from "@/lib/auth";
import { QuotesView } from "@/components/quotes/QuotesView";

export default async function QuotesPage() {
  await requireBusinessProfile();
  return <QuotesView />;
}
