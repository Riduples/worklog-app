import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_PATHS = ["/login", "/signup"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not remove: refreshes the session cookie on every request. Removing
  // this call (or not reading the result) causes random session drops.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = AUTH_PATHS.some((p) => pathname.startsWith(p));
  // /accept-invite must work both logged-out (preview + login/signup prompt)
  // and logged-in (accept button) — it's public but not an "auth route" (an
  // already-logged-in user should NOT be bounced away from it like /login).
  //
  // The PayFast ITN and the cron routes are called server-to-server with no
  // session cookie (the ITN from PayFast, /api/cron/* from Vercel Cron). If they
  // weren't public they'd be redirected to /login and never run — so they pass
  // through here; each route enforces its own auth (PayFast's signature, or the
  // CRON_SECRET bearer) and trusts nothing about the session.
  const isPublicRoute =
    pathname === "/" ||
    isAuthRoute ||
    pathname.startsWith("/accept-invite") ||
    pathname.startsWith("/pricing") ||
    pathname === "/api/payfast/notify" ||
    pathname.startsWith("/api/cron/");

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
