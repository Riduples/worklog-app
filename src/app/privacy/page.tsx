import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { privacyDoc } from "@/lib/legal/privacyContent";

export const metadata: Metadata = {
  title: "Privacy Policy — Worklog",
  description: "How Worklog collects, uses and protects your personal information, in line with POPIA.",
};

export default function PrivacyPage() {
  return <LegalDocument doc={privacyDoc} />;
}
