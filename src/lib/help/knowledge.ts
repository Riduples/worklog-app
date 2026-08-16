import { HELP_ARTICLES } from "@/lib/help/content";
import type { HelpArticle } from "@/lib/help/types";

// The Help Centre, flattened into one plain-text corpus that Loggy (the in-app
// help assistant) reads as its knowledge base. This is the SAME content users
// browse at /help — so the bot's answers and the published guides can never
// drift apart: regenerate the guides and Loggy re-learns automatically.
//
// Kept deliberately simple (no embeddings / retrieval): 42 guides is small
// enough to hand the model the whole thing every call, and the system prompt is
// marked cacheable at the call site so the repeat cost is a tenth of the first.

function blocksToText(blocks: HelpArticle["sections"][number]["blocks"]): string {
  return blocks
    .map((b) => {
      if (b.type === "paragraph" || b.type === "tip" || b.type === "warning") {
        return b.type === "tip" ? `Tip: ${b.text ?? ""}` : b.type === "warning" ? `Note: ${b.text ?? ""}` : (b.text ?? "");
      }
      // steps / bullets
      return (b.items ?? []).map((i) => `- ${i}`).join("\n");
    })
    .filter(Boolean)
    .join("\n");
}

function articleToText(a: HelpArticle): string {
  const sections = a.sections.map((s) => `## ${s.heading}\n${blocksToText(s.blocks)}`).join("\n\n");
  return `# ${a.title}\n(category: ${a.category} · slug: ${a.slug})\n${a.summary}\n\n${sections}`;
}

// Every valid guide slug — used to constrain the assistant's `guideSlug` output
// to a real, linkable guide (so it can never invent a /help URL that 404s).
export const HELP_SLUGS: string[] = HELP_ARTICLES.map((a) => a.slug);

// The full corpus, guides separated by a rule so the model sees clear boundaries.
export const HELP_KNOWLEDGE: string = HELP_ARTICLES.map(articleToText).join("\n\n———\n\n");
