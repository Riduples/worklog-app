import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { termsDoc } from "@/lib/legal/termsContent";

export const metadata: Metadata = {
  title: "Terms of Service — Worklog",
  description: "The terms that govern your use of Worklog.",
};

export default function TermsPage() {
  return <LegalDocument doc={termsDoc} />;
}
