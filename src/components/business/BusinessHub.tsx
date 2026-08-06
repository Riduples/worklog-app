"use client";

import { useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/ui/BackLink";
import { BusinessDetailsModal } from "@/components/modals/BusinessDetailsModal";
import { WhatsAppConnectModal } from "@/components/modals/WhatsAppConnectModal";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";

// The owner's "set it up once" hub. A page of cards, reached from the dashboard's
// "Business Hub" link (which replaced the ⚙ gear). Business details and Connect
// WhatsApp open in modals; Bank accounts and Team are their own full pages,
// gathered here so they're not scattered through the tool list.

const NAVY = "#0C4A6E";
const MUTED = "#64748b";

// A card either links to a page (href) or opens a modal (action).
type Card = { key: string; icon: string; title: string; desc: string; href?: string; action?: "details" | "whatsapp" };

const CARDS: Card[] = [
  { key: "details", icon: "🏢", title: "Business details", desc: "Your logo, name, contact, how customers pay you, and your VAT & SARS details.", action: "details" },
  { key: "accounts", icon: "💳", title: "Bank accounts", desc: "The accounts you track money against — balances and per-account views.", href: "/accounts" },
  { key: "team", icon: "👥", title: "Team & permissions", desc: "Invite people to your business and set what each person can access.", href: "/team" },
  { key: "whatsapp", icon: "💬", title: "Connect WhatsApp", desc: "Link your WhatsApp number to log income & expenses by message or photo — no app needed.", action: "whatsapp" },
];

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1.5px solid #e2e8f0",
  borderRadius: 16,
  padding: "18px",
  textDecoration: "none",
  display: "block",
  width: "100%",
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
};

export function BusinessHub() {
  const { data: business } = useBusinessProfile();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  return (
    <div style={{ padding: "20px 16px 100px", maxWidth: 760, margin: "0 auto" }}>
      <BackLink />
      <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: "6px 0 4px" }}>Business Hub</h1>
      <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginBottom: 18 }}>
        Everything about your business in one place — set it up once, change it anytime.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {CARDS.map((c) => {
          if (c.href) {
            return (
              <Link key={c.key} href={c.href} style={cardStyle}>
                <CardBody card={c} />
              </Link>
            );
          }
          // Modal cards. Business details needs the loaded profile; Connect
          // WhatsApp loads its own status, so it's never disabled.
          const onClick = c.action === "whatsapp" ? () => setWhatsappOpen(true) : () => setDetailsOpen(true);
          const disabled = c.action === "details" && !business;
          return (
            <button
              key={c.key}
              onClick={onClick}
              disabled={disabled}
              style={{ ...cardStyle, cursor: disabled ? "default" : "pointer", fontFamily: "inherit", textAlign: "left" }}
            >
              <CardBody card={c} />
            </button>
          );
        })}
      </div>

      {detailsOpen && business && <BusinessDetailsModal business={business} onClose={() => setDetailsOpen(false)} />}
      {whatsappOpen && <WhatsAppConnectModal onClose={() => setWhatsappOpen(false)} />}
    </div>
  );
}

function CardBody({ card }: { card: Card }) {
  return (
    <>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{card.icon}</div>
      <div style={{ fontSize: 15.5, fontWeight: 800, color: NAVY, marginBottom: 4 }}>{card.title}</div>
      <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.55 }}>{card.desc}</div>
    </>
  );
}
