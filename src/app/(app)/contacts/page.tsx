import { redirect } from "next/navigation";

// Contacts split into two tools — /customers and /suppliers — but the old combined
// path lingered, reachable only by typing it. Nothing links here anymore, so keep
// the URL working (cached links, bookmarks) by sending it to /customers, the same
// way /bookings redirects to /diary.
export default function ContactsRedirect() {
  redirect("/customers");
}
