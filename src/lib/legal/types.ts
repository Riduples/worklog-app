// Structured content model for the legal documents. The multi-agent drafting
// pipeline emits this exact shape (see legal-docs-workflow.js CONTENT_SCHEMA);
// termsContent.ts and privacyContent.ts hold the finalized output, and
// LegalDocument.tsx renders it. Keeping the documents as structured data — not
// raw HTML — means no dangerouslySetInnerHTML and consistent styling.

export type LegalBlock = {
  type: "paragraph" | "bullets" | "numbered";
  /** Present for `paragraph`. */
  text?: string;
  /** Present for `bullets` / `numbered`. */
  items?: string[];
};

export type LegalSection = {
  heading: string;
  blocks: LegalBlock[];
};

export type LegalDoc = {
  documentTitle: string;
  /** e.g. "Effective: {{EFFECTIVE_DATE}}". */
  effectiveDateNote?: string;
  intro?: string;
  sections: LegalSection[];
  /** The {{TOKEN}} names the content relies on — for auditing what must be filled in. */
  placeholdersUsed?: string[];
};
