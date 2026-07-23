import Link from "next/link";
import type { HelpArticle } from "@/lib/help/types";
import { HELP_CATEGORIES } from "@/lib/help/types";

// The /help landing: a browsable index of every guide, grouped by category.
// Server component. Brand-matched to the marketing site.

const NAVY = "#0C4A6E";
const ORANGE = "#E8A33D";
const INK = "#1e293b";
const MUTED = "#64748b";

export function HelpIndex({ articles }: { articles: HelpArticle[] }) {
  // Preserve the given article order within each category; order the categories
  // by HELP_CATEGORIES, then any leftover categories at the end.
  const known = HELP_CATEGORIES.map((c) => c.name);
  const extra = Array.from(new Set(articles.map((a) => a.category))).filter((c) => !known.includes(c));
  const order = [...HELP_CATEGORIES, ...extra.map((name) => ({ name, icon: "📄", blurb: "" }))];

  return (
    <main style={{ background: "#F0F0EF", color: INK, minHeight: "100vh" }}>
      <header style={{ background: NAVY, color: "#fff", padding: "24px 20px 40px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/worklog-logo-light.png" alt="Worklog" style={{ height: 26, width: "auto", display: "block" }} />
            </Link>
            <Link href="/dashboard" style={{ fontSize: 12.5, fontWeight: 700, color: "#7DD3FC", textDecoration: "none" }}>
              Go to app →
            </Link>
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 8px" }}>Help Centre</h1>
          <p style={{ fontSize: 15, color: "#BAE6FD", margin: 0, maxWidth: 560, lineHeight: 1.6 }}>
            Step-by-step guides for every part of Worklog — from setting up your business to running payroll and filing with SARS.
          </p>
        </div>
      </header>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 48px" }}>
        {articles.length === 0 ? (
          <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: "28px", marginTop: -22, textAlign: "center", color: MUTED, fontSize: 14 }}>
            Guides are on their way.
          </div>
        ) : (
          order.map((cat) => {
            const inCat = articles.filter((a) => a.category === cat.name);
            if (inCat.length === 0) return null;
            return (
              <section key={cat.name} style={{ marginTop: 26 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 20 }}>{cat.icon}</span>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: 0 }}>{cat.name}</h2>
                  {cat.blurb && <span style={{ fontSize: 12.5, color: MUTED }}>{cat.blurb}</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {inCat.map((a) => (
                    <Link
                      key={a.slug}
                      href={`/help/${a.slug}`}
                      style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "16px 18px", textDecoration: "none", display: "block" }}
                    >
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: NAVY, marginBottom: 4 }}>{a.title}</div>
                      <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.55 }}>{a.summary}</div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })
        )}

        <div style={{ textAlign: "center", marginTop: 32, fontSize: 12.5, color: MUTED, lineHeight: 1.7 }}>
          Can&apos;t find what you need? Open the in-app help assistant, or email{" "}
          <a href="mailto:hello@worklogsolutions.co.za" style={{ color: NAVY, fontWeight: 700 }}>hello@worklogsolutions.co.za</a>.
          <div style={{ marginTop: 12 }}>
            <Link href="/signup" style={{ display: "inline-block", background: ORANGE, color: "#fff", fontWeight: 800, fontSize: 14, padding: "11px 24px", borderRadius: 11, textDecoration: "none" }}>
              Start free →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
