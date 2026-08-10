import { Suspense } from "react";
import { requireBusinessProfile } from "@/lib/auth";
import { BookingsView } from "@/components/bookings/BookingsView";

export default async function DiaryPage() {
  await requireBusinessProfile();
  // Suspense because BookingsView reads ?open=<id> via useSearchParams (to deep-
  // link an appointment open from the dashboard), which opts the tree into
  // client-side rendering — same as the dashboard page.
  return (
    <Suspense>
      <BookingsView />
    </Suspense>
  );
}
