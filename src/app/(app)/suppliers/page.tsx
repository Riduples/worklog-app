import { requireBusinessProfile } from "@/lib/auth";
import { ContactsView } from "@/components/contacts/ContactsView";

export default async function SuppliersPage() {
  await requireBusinessProfile();
  return <ContactsView only="supplier" />;
}
