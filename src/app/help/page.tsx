import type { Metadata } from "next";
import { HelpIndex } from "@/components/help/HelpIndex";
import { HELP_ARTICLES } from "@/lib/help/content";

export const metadata: Metadata = {
  title: "Help Centre — Worklog",
  description: "Step-by-step guides for every part of Worklog — invoices, stock, payroll, tax and more.",
};

export default function HelpPage() {
  return <HelpIndex articles={HELP_ARTICLES} />;
}
