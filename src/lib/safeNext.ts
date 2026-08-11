// A post-auth redirect target must stay ON this site. An attacker-supplied
// ?next=https://evil.example (or the protocol-relative //evil.example, or
// /\evil.example) would turn a genuine login on worklog.co.za into an off-site
// redirect — a phishing aid on the trusted domain. Accept ONLY a single-slash
// relative path; anything else falls back to the caller's default.
//
// Mirrors the check AnnouncementBanner.safeHref uses, but stricter: no external
// http(s) URLs are allowed for a login redirect, only same-origin paths.
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;
  if (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) return next;
  return fallback;
}
