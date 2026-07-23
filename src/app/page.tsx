import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/marketing/LandingPage";

export const metadata: Metadata = {
  title: "Worklog — All-in-one app for South African small businesses",
  description:
    "Run the money, invoices, stock, staff and tax for your small business — all in one simple app, in plain English and priced in Rand. Try Worklog free for 14 days, no card needed.",
};

export default async function Home() {
  // Logged-in visitors go straight to their dashboard; everyone else sees the
  // marketing site. The root is public in middleware, so a logged-out visitor
  // reaches this instead of being bounced to /login.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return <LandingPage />;
}
