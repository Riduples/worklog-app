import Link from "next/link";

// Public marketing home for worklog.co.za. Server component — static content,
// so no client JS. Brand + inline-style approach mirrors /pricing so the two
// read as one site. Logged-in visitors never reach this (the root page redirects
// them to /dashboard); this is the front door for everyone else.

const NAVY = "#0C4A6E";
const ORANGE = "#E8A33D";
const OFFWHITE = "#F0F0EF";
const INK = "#1e293b";
const MUTED = "#64748b";

const WHO = [
  { icon: "🔧", label: "Tradespeople" },
  { icon: "💇", label: "Salons & barbers" },
  { icon: "🛒", label: "Spaza shops" },
  { icon: "💻", label: "Freelancers" },
  { icon: "🚗", label: "Gig workers" },
  { icon: "🍳", label: "Caterers" },
];

const FEATURES = [
  { icon: "💰", title: "Money in & out", desc: "Log income and expenses in seconds — or just type it in plain words and let Quick Log sort it out." },
  { icon: "📤", title: "Invoices & quotes", desc: "Send professional invoices and quotes from your phone, and see at a glance who still owes you." },
  { icon: "🏦", title: "Snap your bank statement", desc: "Upload a statement and Worklog reads every transaction for you — no typing them out one by one." },
  { icon: "🧾", title: "Tax made clear", desc: "VAT, PAYE, provisional tax — see what's due and when, with a tax jar that sets money aside as you earn." },
  { icon: "📊", title: "Know your numbers", desc: "Profit, cash flow and what you're owed — always up to date, in language that actually makes sense." },
  { icon: "📱", title: "Lives on your phone", desc: "Install it like an app. Built mobile-first for people who run their business on the move." },
];

const STEPS = [
  { n: "1", title: "Sign up free", desc: "No card needed. You're in and set up in a couple of minutes — we'll even help you personally on WhatsApp." },
  { n: "2", title: "Log your money", desc: "Type it, snap a bank statement, or send an invoice. Every rand in and out, captured as you go." },
  { n: "3", title: "See where you stand", desc: "Your profit, your tax, and who owes you — sorted automatically, ready whenever you (or SARS) need it." },
];

const WHY = [
  { t: "No limits, ever.", d: "Unlimited invoices, transactions and records on every plan. Other apps count; we don't." },
  { t: "Priced in Rand, stays in Rand.", d: "Your price doesn't move with the exchange rate — no dollar surprises." },
  { t: "We set you up personally.", d: "Every new subscriber gets one-on-one setup help on WhatsApp. You're never left to figure it out alone." },
  { t: "Built for South Africa.", d: "VAT, SARS deadlines and plain language — not accounting jargon translated from somewhere else." },
];

export function LandingPage() {
  return (
    <main style={{ background: "#fff", color: INK }}>
      {/* ── Header ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #e8eef2",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/worklog-logo.png" alt="Worklog" style={{ height: 26, width: "auto", display: "block" }} />
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link href="/pricing" style={{ fontSize: 13.5, fontWeight: 700, color: NAVY, textDecoration: "none", padding: "8px 10px" }}>
            Pricing
          </Link>
          <Link href="/login" style={{ fontSize: 13.5, fontWeight: 700, color: NAVY, textDecoration: "none", padding: "8px 10px" }}>
            Log in
          </Link>
          <Link
            href="/signup"
            style={{ fontSize: 13.5, fontWeight: 800, color: "#fff", background: ORANGE, textDecoration: "none", padding: "9px 16px", borderRadius: 10 }}
          >
            Start free
          </Link>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section style={{ background: NAVY, color: "#fff", padding: "52px 20px 56px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 40, alignItems: "center" }}>
          <div style={{ flex: "1 1 340px", minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "#7DD3FC", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>
              Bookkeeping for South African small businesses
            </div>
            <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1, margin: "0 0 16px" }}>
              Every Rand.<br />Every Job.<br />
              <span style={{ color: ORANGE }}>Logged.</span>
            </h1>
            <p style={{ fontSize: 16, color: "#BAE6FD", lineHeight: 1.6, marginBottom: 24, maxWidth: 480 }}>
              The dead-simple way for tradespeople, freelancers and small shops to track money in and out, send
              invoices, and stay ready for SARS — without the accountant-speak.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <Link
                href="/signup"
                style={{ background: ORANGE, color: "#fff", fontWeight: 800, fontSize: 15, padding: "14px 26px", borderRadius: 12, textDecoration: "none" }}
              >
                Start free →
              </Link>
              <Link
                href="/pricing"
                style={{ background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.25)", color: "#fff", fontWeight: 700, fontSize: 15, padding: "14px 26px", borderRadius: 12, textDecoration: "none" }}
              >
                See pricing
              </Link>
            </div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>
              14 days free · No card needed · Cancel anytime
            </div>
          </div>

          {/* Product hint card — built from divs, not a screenshot, so it always
              looks crisp and never blocks launch on real captures. */}
          <div style={{ flex: "1 1 300px", display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 320, background: "#fff", borderRadius: 20, padding: "20px 20px 22px", boxShadow: "0 24px 60px rgba(0,0,0,0.35)", color: INK }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 }}>This month</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: NAVY, margin: "2px 0 2px" }}>R18,240</div>
              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginBottom: 16 }}>money left ▲ 12%</div>

              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1, background: "#F0F9FF", borderRadius: 12, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "#0369A1", fontWeight: 800 }}>MONEY IN</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0369A1" }}>R42,100</div>
                </div>
                <div style={{ flex: 1, background: "#fef2f2", borderRadius: 12, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "#b91c1c", fontWeight: 800 }}>MONEY OUT</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#b91c1c" }}>R23,860</div>
                </div>
              </div>

              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🏦</span>
                <div style={{ fontSize: 12, color: "#92400e", fontWeight: 700 }}>R5,880 set aside for SARS</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Who it's for ── */}
      <section style={{ background: OFFWHITE, padding: "26px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={{ textAlign: "center", fontSize: 12.5, color: MUTED, fontWeight: 700, marginBottom: 16 }}>
            Made for the way you actually work
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
            {WHO.map((w) => (
              <div key={w.label} style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 999, padding: "8px 16px", fontSize: 13, fontWeight: 700, color: NAVY, display: "flex", alignItems: "center", gap: 8 }}>
                <span>{w.icon}</span>
                <span>{w.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Empathy / the shift ── */}
      <section style={{ padding: "48px 20px 8px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: NAVY, marginBottom: 14, lineHeight: 1.25 }}>
            Shoebox full of slips? Invoices on WhatsApp? Dreading tax season?
          </h2>
          <p style={{ fontSize: 15.5, color: MUTED, lineHeight: 1.7 }}>
            You&apos;re brilliant at your trade — the paperwork is just the part nobody warned you about. Worklog turns
            the pile of slips and half-remembered payments into clean records you actually understand, so you always know
            what you made, what you owe, and what&apos;s yours to keep.
          </p>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: "36px 16px 8px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Everything your business needs in one place</h2>
          <p style={{ textAlign: "center", fontSize: 14, color: MUTED, marginBottom: 28 }}>No add-ons, no upsells for the basics — it&apos;s all in there.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: "20px" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: NAVY, marginBottom: 5 }}>{f.title}</div>
                <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" style={{ padding: "48px 16px", marginTop: 20, background: OFFWHITE }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 800, color: NAVY, marginBottom: 28 }}>Up and running in three steps</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {STEPS.map((s) => (
              <div key={s.n} style={{ flex: "1 1 260px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: "22px 20px" }}>
                <div style={{ width: 34, height: 34, borderRadius: 999, background: NAVY, color: "#fff", fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  {s.n}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.65 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Worklog ── */}
      <section id="why" style={{ padding: "48px 16px 8px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 800, color: NAVY, marginBottom: 24 }}>Why Worklog?</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {WHY.map((w) => (
              <div key={w.t} style={{ flex: "1 1 380px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "18px 20px" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 5 }}>{w.t}</div>
                <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.6 }}>{w.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing teaser ── */}
      <section style={{ padding: "44px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 18, padding: "28px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0369A1", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Simple, honest pricing</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: NAVY, marginBottom: 6 }}>Plans from R79/month</div>
          <p style={{ fontSize: 14, color: MUTED, marginBottom: 18, lineHeight: 1.6 }}>All VAT-inclusive. Every plan unlimited. Try everything free for 14 days — no card needed.</p>
          <Link href="/pricing" style={{ display: "inline-block", background: NAVY, color: "#fff", fontWeight: 800, fontSize: 15, padding: "13px 28px", borderRadius: 12, textDecoration: "none" }}>
            See all plans →
          </Link>
        </div>
      </section>

      {/* ── Trust ── */}
      <section style={{ padding: "0 16px 44px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
          <p style={{ fontSize: 14.5, color: MUTED, lineHeight: 1.7 }}>
            Your records are private, backed up, and <strong style={{ color: INK }}>never sold</strong>. POPIA matters to us
            because it matters to you — read our{" "}
            <Link href="/privacy" style={{ color: NAVY, fontWeight: 700 }}>Privacy Policy</Link>.
          </p>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ background: NAVY, color: "#fff", textAlign: "center", padding: "52px 20px" }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Stop guessing. Start logging.</h2>
        <p style={{ fontSize: 15, color: "#BAE6FD", marginBottom: 22 }}>Try Worklog free for 14 days — no card needed.</p>
        <Link href="/signup" style={{ display: "inline-block", background: ORANGE, color: "#fff", fontWeight: 800, fontSize: 16, padding: "15px 34px", borderRadius: 12, textDecoration: "none" }}>
          Start free →
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: "#082f44", color: "#cbd5e1", padding: "36px 20px 30px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 28, justifyContent: "space-between" }}>
          <div style={{ flex: "1 1 240px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/worklog-logo-light.png" alt="Worklog" style={{ height: 24, marginBottom: 12 }} />
            <p style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.6, maxWidth: 300 }}>
              Bookkeeping that speaks your language. Every Rand, every job, logged.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 40 }}>
            <FooterCol title="Product" links={[["Features", "/#features"], ["Pricing", "/pricing"], ["Log in", "/login"], ["Start free", "/signup"]]} />
            <FooterCol title="Legal" links={[["Terms of Service", "/terms"], ["Privacy Policy", "/privacy"]]} />
            <FooterCol title="Contact" links={[["hello@worklogsolutions.co.za", "mailto:hello@worklogsolutions.co.za"]]} />
          </div>
        </div>
        <div style={{ maxWidth: 1040, margin: "22px auto 0", paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 11.5, color: "#64748b" }}>
          © 2026 Worklog Solutions (Pty) Ltd. All rights reserved.
        </div>
      </footer>
    </main>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#7DD3FC", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {links.map(([label, href]) => (
          <Link key={label} href={href} style={{ fontSize: 12.5, color: "#cbd5e1", textDecoration: "none" }}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
