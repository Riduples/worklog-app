import { requireBusinessProfile } from "@/lib/auth";
import { ContactsReportsView } from "@/components/reports/ContactsReportsView";

export default async function ContactsReportsPage() {
  await requireBusinessProfile();
  return <ContactsReportsView />;
}
