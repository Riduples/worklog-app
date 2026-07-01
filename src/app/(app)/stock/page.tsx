import { requireBusinessProfile } from "@/lib/auth";
import { StockView } from "@/components/stock/StockView";

export default async function StockPage() {
  await requireBusinessProfile();
  return <StockView />;
}
