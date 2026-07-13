import { requireBusinessProfile } from "@/lib/auth";
import { BookingsView } from "@/components/bookings/BookingsView";

export default async function BookingsPage() {
  await requireBusinessProfile();
  return <BookingsView />;
}
