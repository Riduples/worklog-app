import type { NextConfig } from "next";

// Security response headers, applied to every route (defense-in-depth). HSTS is
// already set at the Vercel edge, so it isn't duplicated here.
//
// A strict Content-Security-Policy is deliberately NOT set yet: a correct one
// needs a tested pass (Next.js inline hydration scripts + the Supabase/Anthropic
// origins the app talks to) to avoid breaking the app, and X-Frame-Options
// already blocks clickjacking in the meantime. Treat CSP as its own verified
// change.
// Content-Security-Policy. A moderate policy: 'unsafe-inline' is kept for script
// and style because Next.js hydration and the app's inline styles need it (and
// the PayFast checkout page auto-submits via an inline <script>) — a nonce-based
// strict policy is a possible later upgrade. The value is in the TIGHT source
// lists: scripts/connections/images/forms can only reach this origin, Supabase,
// and (for the checkout POST) PayFast — so an injected script can't exfiltrate
// to an attacker's domain, and the app can't be framed. Origins the browser
// actually uses were enumerated from the code (no realtime/wss, no third-party
// analytics; Anthropic is server-side only).
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co",
  "form-action 'self' https://sandbox.payfast.co.za https://www.payfast.co.za",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" }, // legacy clickjacking guard; CSP frame-ancestors 'none' is the modern one
  { key: "X-Content-Type-Options", value: "nosniff" }, // stop MIME-sniffing a response into a script
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Switch off browser features the app doesn't use (file uploads use <input
  // type=file>, which is NOT the camera API, so this is safe).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't advertise the framework (drops X-Powered-By)
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
