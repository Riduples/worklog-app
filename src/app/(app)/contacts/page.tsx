import { requireBusinessProfile } from "@/lib/auth";
import { ContactsView } from "@/components/contacts/ContactsView";

export default async function ContactsPage() {
  await requireBusinessProfile();
  return <ContactsView />;
}
