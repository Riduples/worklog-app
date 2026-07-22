import type { Metadata } from "next";
import Link from "next/link";
import { PLAN_ORDER, TIERS, PLAN_FEATURES } from "@/lib/tiers";

export const metadata: Metadata = {
  title: "Pricing — Worklog",
  description: "Simple, honest bookkeeping pricing in Rand. Solo R79, Trade R149, Structured R229 — all VAT-inclusive. Try everything free for 14 days, no card needed.",
};

// Brand palette.
const NAVY = "#0C4A6E";
const ORANGE = "#E8A33D";
const OFFWHITE = "#F0F0EF";
const INK = "#1e293b";
const MUTED = "#64748b";

const WHY = [
  { t: "No limits, ever.", d: "Unlimited invoices, transactions and records on every plan. Other apps count; we don't." },
  { t: "Priced in Rand, stays in Rand.", d: "Your price doesn't move with the exchange rate — no dollar surprises." },
  { t: "We set you up personally.", d: "Every new subscriber gets one-on-one setup help on WhatsApp. You're never left to figure it out alone." },
  { t: "Built for South Africa.", d: "VAT, SARS deadlines and plain language — not accounting jargon translated from somewhere else." },
];

const FAQ = [
  { q: "What happens after my 14-day trial?", a: "You get full access to everything (Structured level) for 14 days. After that, pick the plan that fits. No card needed to start — we only ask for payment when you're ready. If you don't choose a plan, your account becomes read-only: you can still see and download your records anytime — though documents carry a light trial watermark until you start a plan." },
  { q: "What if I miss a payment?", a: "Your account switches to read-only — you can always see and download your records. We'll never lock you out of your own numbers." },
  { q: "How do I pay?", a: "Card, instant EFT, SnapScan or Zapper. Whatever works for you." },
  { q: "Can I get my records out?", a: "Always. Every plan lets you download your own records anytime. They're yours." },
  { q: "Do you do my taxes?", a: "No — Worklog keeps your records straight and shows you what's due and when, but we're not accountants and don't give tax advice. We make your accountant's job (and bill) smaller." },
  { q: "What about my data?", a: "Your records are private, backed up, and never sold. POPIA matters to us because it matters to you." },
];

export default function PricingPage() {
  return (
    <main style={{ background: OFFWHITE, color: INK, minHeight: "100vh" }}>
      {/* Hero */}
      <section style={{ background: NAVY, color: "#fff", padding: "48px 20px 40px", textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/worklog-logo-light.png" alt="Worklog" style={{ height: 30, marginBottom: 28 }} />
        <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.15, margin: "0 auto 14px", maxWidth: 620 }}>
          Every Rand. Every Job. Logged.
        </h1>
        <p style={{ fontSize: 15, color: "#BAE6FD", lineHeight: 1.6, maxWidth: 520, margin: "0 auto 18px" }}>
          Simple, honest pricing in Rand. No dollar surprises, no hidden costs, no limits on your records.
        </p>
        <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 22 }}>Try everything free for 14 days. No card needed.</p>
        <Link
          href="/signup"
          style={{ display: "inline-block", background: ORANGE, color: "#fff", fontWeight: 800, fontSize: 15, padding: "13px 28px", borderRadius: 12, textDecoration: "none" }}
        >
          Start free →
        </Link>
      </section>

      {/* Plans */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "36px 16px 8px" }}>
        <p style={{ textAlign: "center", fontSize: 12.5, color: MUTED, marginBottom: 24 }}>
          All prices include VAT. Cancel or pause anytime. Your records stay yours.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
          {PLAN_ORDER.map((plan) => {
            const tier = TIERS[plan];
            const copy = PLAN_FEATURES[plan];
            const featured = Boolean(tier.badge);
            return (
              <div
                key={plan}
                style={{
                  flex: "1 1 280px",
                  maxWidth: 340,
                  background: "#fff",
                  border: `2px solid ${featured ? ORANGE : "#e2e8f0"}`,
                  borderRadius: 18,
                  padding: "22px 22px 26px",
                  boxShadow: featured ? "0 8px 28px rgba(232,163,61,0.18)" : "0 2px 10px rgba(0,0,0,0.05)",
                  position: "relative",
                }}
              >
                {tier.badge && (
                  <div style={{ position: "absolute", top: -12, left: 22, background: ORANGE, color: "#fff", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6, padding: "4px 12px", borderRadius: 20 }}>
                    ⭐ {tier.badge}
                  </div>
                )}
                <div style={{ fontSize: 19, fontWeight: 800, color: NAVY }}>{tier.label}</div>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 14 }}>{copy.tagline}</div>
                <div style={{ marginBottom: 18 }}>
                  <span style={{ fontSize: 34, fontWeight: 800, color: NAVY }}>{tier.price.replace("/mo", "")}</span>
                  <span style={{ fontSize: 14, color: MUTED, fontWeight: 600 }}>/month</span>
                </div>
                <Link
                  href="/signup"
                  style={{
                    display: "block", textAlign: "center", textDecoration: "none", marginBottom: 18,
                    background: featured ? ORANGE : NAVY, color: "#fff", fontWeight: 700, fontSize: 14,
                    padding: "11px", borderRadius: 11,
                  }}
                >
                  Start free trial
                </Link>
                <div>
                  {copy.features.map((f) => (
                    <div key={f} style={{ display: "flex", gap: 9, marginBottom: 9, fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                      <span style={{ color: featured ? ORANGE : "#0369A1", fontWeight: 800 }}>✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why Worklog */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "36px 16px" }}>
        <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 22 }}>Why Worklog?</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          {WHY.map((w) => (
            <div key={w.t} style={{ flex: "1 1 380px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: NAVY, marginBottom: 4 }}>{w.t}</div>
              <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{w.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Annual deal */}
      <section style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px 36px", textAlign: "center" }}>
        <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: NAVY, marginBottom: 4 }}>Pay for 10 months, get 12.</div>
          <div style={{ fontSize: 13, color: MUTED }}>Ask us about annual billing after your trial.</div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 12px" }}>
        <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 20 }}>Questions</h2>
        {FAQ.map((f) => (
          <div key={f.q} style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "16px 18px", marginBottom: 10 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{f.q}</div>
            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.65 }}>{f.a}</div>
          </div>
        ))}
      </section>

      {/* Footer CTA */}
      <section style={{ background: NAVY, color: "#fff", textAlign: "center", padding: "40px 20px" }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Stop guessing. Start logging.</h2>
        <p style={{ fontSize: 14, color: "#BAE6FD", marginBottom: 20 }}>Try Worklog free for 14 days — no card needed.</p>
        <Link
          href="/signup"
          style={{ display: "inline-block", background: ORANGE, color: "#fff", fontWeight: 800, fontSize: 15, padding: "13px 30px", borderRadius: 12, textDecoration: "none" }}
        >
          Start free →
        </Link>
        <div style={{ marginTop: 22, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#7DD3FC", textDecoration: "none", fontWeight: 700 }}>Log in</Link>
        </div>
      </section>
    </main>
  );
}
