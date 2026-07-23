import Link from "next/link";
import type { HelpArticle, HelpBlock } from "@/lib/help/types";

// Renders one help article. Server component (static content). Brand-matched to
// the marketing + legal pages.

const NAVY = "#0C4A6E";
const ORANGE = "#E8A33D";
const INK = "#1e293b";
const MUTED = "#64748b";

export function HelpArticleView({ article, allArticles }: { article: HelpArticle; allArticles: HelpArticle[] }) {
  const related = (article.related ?? [])
    .map((slug) => allArticles.find((a) => a.slug === slug))
    .filter((a): a is HelpArticle => Boolean(a));

  return (
    <main style={{ background: "#F0F0EF", color: INK, minHeight: "100vh" }}>
      <header style={{ background: NAVY, color: "#fff", padding: "22px 20px 26px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/worklog-logo-light.png" alt="Worklog" style={{ height: 24, width: "auto", display: "block" }} />
            </Link>
            <Link href="/help" style={{ fontSize: 12.5, fontWeight: 700, color: "#7DD3FC", textDecoration: "none" }}>
              ← All help
            </Link>
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: "#7DD3FC", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
            {article.category}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 8px", lineHeight: 1.2 }}>{article.title}</h1>
          <p style={{ fontSize: 14, color: "#BAE6FD", margin: 0, lineHeight: 1.6 }}>{article.summary}</p>
        </div>
      </header>

      <article style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px 48px" }}>
        <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: "24px 22px 28px", marginTop: -12 }}>
          {article.sections.map((section, i) => (
            <section key={i} style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 16.5, fontWeight: 800, color: NAVY, marginBottom: 10, lineHeight: 1.35 }}>{section.heading}</h2>
              {section.blocks.map((block, j) => (
                <BlockView key={j} block={block} />
              ))}
            </section>
          ))}

          {related.length > 0 && (
            <section style={{ borderTop: "1px solid #e2e8f0", marginTop: 26, paddingTop: 18 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: NAVY, marginBottom: 10 }}>Related guides</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/help/${r.slug}`}
                    style={{ fontSize: 13.5, fontWeight: 700, color: "#0369A1", textDecoration: "none" }}
                  >
                    {r.title} →
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 22, fontSize: 12.5, color: MUTED, lineHeight: 1.7 }}>
          Still stuck? Open the in-app help assistant, or email us at{" "}
          <a href="mailto:hello@worklogsolutions.co.za" style={{ color: NAVY, fontWeight: 700 }}>hello@worklogsolutions.co.za</a>.
          <div style={{ marginTop: 10 }}>
            <Link href="/help" style={{ color: ORANGE, fontWeight: 800, textDecoration: "none" }}>← Back to the Help Centre</Link>
          </div>
        </div>
      </article>
    </main>
  );
}

function BlockView({ block }: { block: HelpBlock }) {
  const p: React.CSSProperties = { fontSize: 14, lineHeight: 1.7, color: "#374151", marginBottom: 12 };
  const items = block.items ?? [];

  switch (block.type) {
    case "paragraph":
      return <p style={p}>{block.text}</p>;
    case "steps":
      return (
        <ol style={{ ...p, paddingLeft: 22, display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((it, i) => (
            <li key={i} style={{ paddingLeft: 4 }}>{it}</li>
          ))}
        </ol>
      );
    case "bullets":
      return (
        <ul style={{ ...p, paddingLeft: 22, display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case "tip":
      return (
        <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#0369A1", lineHeight: 1.6, display: "flex", gap: 8 }}>
          <span style={{ flexShrink: 0 }}>💡</span>
          <span>{block.text}</span>
        </div>
      );
    case "warning":
      return (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#92400e", lineHeight: 1.6, display: "flex", gap: 8 }}>
          <span style={{ flexShrink: 0 }}>⚠️</span>
          <span>{block.text}</span>
        </div>
      );
    default:
      return null;
  }
}
