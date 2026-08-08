import { redirect } from "next/navigation";

// The Diary tool used to live at /bookings. Keep the old path working — cached
// PWA links, bookmarks and shortcuts still point here — by sending it to /diary.
export default function BookingsRedirect() {
  redirect("/diary");
}
