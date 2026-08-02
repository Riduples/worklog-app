import { requireBusinessProfile } from "@/lib/auth";
import { ContactsView } from "@/components/contacts/ContactsView";

export default async function CustomersPage() {
  await requireBusinessProfile();
  return <ContactsView only="client" />;
}
