import type { NextConfig } from "next";

// Security response headers, applied to every route (defense-in-depth). HSTS is
// already set at the Vercel edge, so it isn't duplicated here.
//
// A strict Content-Security-Policy is deliberately NOT set yet: a correct one
// needs a tested pass (Next.js inline hydration scripts + the Supabase/Anthropic
// origins the app talks to) to avoid breaking the app, and X-Frame-Options
// already blocks clickjacking in the meantime. Treat CSP as its own verified
// change.
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" }, // clickjacking: no external site may frame the app
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
