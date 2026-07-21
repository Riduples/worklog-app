import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 renamed Middleware to Proxy (same runtime/behavior, new file
// convention: proxy.ts at the src root instead of middleware.ts).
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // .mjs is excluded so the self-hosted pdf.js worker (public/pdf.worker.min.mjs)
  // is served as a plain static asset — it holds no user data and must load without
  // an auth round-trip (a lapsed session would otherwise redirect it to an HTML
  // login page and break the encrypted-statement unlock).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs)$).*)"],
};
