"use client";

import { useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/ui/BackLink";
import { BusinessDetailsModal } from "@/components/modals/BusinessDetailsModal";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";

// The owner's "set it up once" hub. A page of cards, reached from the dashboard's
// "Business Hub" link (which replaced the ⚙ gear). Business details open in the
// existing modal; Bank accounts and Team are their own full pages, gathered here
// so they're not scattered through the tool list.

const NAVY = "#0C4A6E";
const MUTED = "#64748b";

type Card = { key: string; icon: string; title: string; desc: string; href?: string };

const CARDS: Card[] = [
  { key: "details", icon: "🏢", title: "Business details", desc: "Your logo, name, contact, how customers pay you, and your VAT & SARS details." },
  { key: "accounts", icon: "💳", title: "Bank accounts", desc: "The accounts you track money against — balances and per-account views.", href: "/accounts" },
  { key: "team", icon: "👥", title: "Team & permissions", desc: "Invite people to your business and set what each person can access.", href: "/team" },
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

  return (
    <div style={{ padding: "20px 16px 100px", maxWidth: 760, margin: "0 auto" }}>
      <BackLink />
      <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: "6px 0 4px" }}>Business Hub</h1>
      <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginBottom: 18 }}>
        Everything about your business in one place — set it up once, change it anytime.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {CARDS.map((c) =>
          c.href ? (
            <Link key={c.key} href={c.href} style={cardStyle}>
              <CardBody card={c} />
            </Link>
          ) : (
            <button
              key={c.key}
              onClick={() => setDetailsOpen(true)}
              disabled={!business}
              style={{ ...cardStyle, cursor: business ? "pointer" : "default", fontFamily: "inherit", textAlign: "left" }}
            >
              <CardBody card={c} />
            </button>
          )
        )}
      </div>

      {detailsOpen && business && <BusinessDetailsModal business={business} onClose={() => setDetailsOpen(false)} />}
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
