import { requireBusinessProfile } from "@/lib/auth";
import { BookingsView } from "@/components/bookings/BookingsView";

export default async function DiaryPage() {
  await requireBusinessProfile();
  return <BookingsView />;
}
