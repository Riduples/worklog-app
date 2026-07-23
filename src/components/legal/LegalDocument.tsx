import Link from "next/link";
import type { LegalBlock, LegalDoc } from "@/lib/legal/types";
import { fillTokens } from "@/lib/legal/company";

// Renders a structured legal document (Terms / Privacy) as a clean, readable
// public page. Server component — the content is static, so no client JS. Every
// string passes through fillTokens() so {{COMPANY_NAME}} etc. resolve from the
// single company config.

const NAVY = "#0C4A6E";
const INK = "#1e293b";
const MUTED = "#64748b";

export function LegalDocument({ doc }: { doc: LegalDoc }) {
  return (
    <main style={{ background: "#F0F0EF", color: INK, minHeight: "100vh" }}>
      <header style={{ background: NAVY, color: "#fff", padding: "34px 20px 28px", textAlign: "center" }}>
        <Link href="/" style={{ display: "inline-block", marginBottom: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/worklog-logo-light.png" alt="Worklog" style={{ height: 26, width: "auto", display: "block" }} />
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 auto 6px", maxWidth: 620, lineHeight: 1.2 }}>
          {fillTokens(doc.documentTitle)}
        </h1>
        {doc.effectiveDateNote && (
          <p style={{ fontSize: 12.5, color: "#BAE6FD", margin: 0 }}>{fillTokens(doc.effectiveDateNote)}</p>
        )}
      </header>

      <article style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px 48px" }}>
        <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: "26px 24px 30px", marginTop: -14 }}>
          {doc.intro && (
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "#374151", marginBottom: 22 }}>{fillTokens(doc.intro)}</p>
          )}

          {doc.sections.map((section, i) => (
            <section key={i} style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 8, lineHeight: 1.4 }}>
                {fillTokens(section.heading)}
              </h2>
              {section.blocks.map((block, j) => (
                <BlockView key={j} block={block} />
              ))}
            </section>
          ))}

          <footer style={{ borderTop: "1px solid #e2e8f0", marginTop: 28, paddingTop: 18, fontSize: 12.5, color: MUTED }}>
            <p style={{ marginBottom: 12 }}>
              Questions about this document? Contact us at {fillTokens("{{SUPPORT_EMAIL}}")}.
            </p>
            <Link href="/terms" style={{ color: NAVY, fontWeight: 700, marginRight: 18, textDecoration: "none" }}>Terms of Service</Link>
            <Link href="/privacy" style={{ color: NAVY, fontWeight: 700, textDecoration: "none" }}>Privacy Policy</Link>
          </footer>
        </div>
      </article>
    </main>
  );
}

function BlockView({ block }: { block: LegalBlock }) {
  const base: React.CSSProperties = { fontSize: 13.5, lineHeight: 1.7, color: "#374151", marginBottom: 10 };

  if (block.type === "paragraph") {
    return <p style={base}>{fillTokens(block.text ?? "")}</p>;
  }

  const items = block.items ?? [];
  if (block.type === "numbered") {
    return (
      <ol style={{ ...base, paddingLeft: 22 }}>
        {items.map((it, i) => (
          <li key={i} style={{ marginBottom: 6 }}>{fillTokens(it)}</li>
        ))}
      </ol>
    );
  }
  return (
    <ul style={{ ...base, paddingLeft: 22 }}>
      {items.map((it, i) => (
        <li key={i} style={{ marginBottom: 6 }}>{fillTokens(it)}</li>
      ))}
    </ul>
  );
}
