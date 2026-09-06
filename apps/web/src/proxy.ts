import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { readPublicEnv } from "@clavehq/shared";
import type { Database } from "@clavehq/shared";
import { REMEMBER_COOKIE, applyRememberLifetime } from "@/features/auth/lib/cookies";

/** Everything under these prefixes needs a session. */
const PROTECTED_PREFIXES = ["/dashboard"] as const;

/**
 * Next 16 renamed this file convention from `middleware` to `proxy`; the export name has to
 * match the filename or it is never invoked. What it does is unchanged.
 *
 * Two jobs, and they have to happen in this order.
 *
 * 1. **Refresh the access token.** Supabase access tokens expire hourly. A Server Component
 *    cannot write cookies, so `features/auth/lib/server.ts` swallows the write it would need to
 *    persist a refresh — this is the layer that *can* write, and running the refresh
 *    here is what makes that swallow safe rather than lossy.
 * 2. **Guard the portal.** An unauthenticated request to `/dashboard` is sent to `/sign-in`
 *    instead of rendering an empty page.
 *
 * `getClaims()` and not `getSession()`: the session read from a cookie is whatever the cookie
 * says, and the cookie is client-supplied. `getClaims` verifies the JWT's signature, so a
 * forged cookie fails here rather than being trusted through to a page. RLS would still refuse
 * the forged user at the database, but a routing decision should not be made on unverified
 * input in the first place.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const env = readPublicEnv();
  const rememberMe = request.cookies.get(REMEMBER_COOKIE)?.value === "1";

  // Seeded from the request so that cookies Supabase rotates below are visible both to the rest
  // of this function and to the response the browser receives.
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({ request });

          for (const { name, value, options } of cookiesToSet) {
            // The same lifetime policy as the server client applies, so a token refreshed here
            // does not quietly become permanent for a user who left "Remember me" unticked.
            response.cookies.set(name, value, applyRememberLifetime(options, rememberMe));
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) =>
      request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && data?.claims === undefined) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.search = "";

    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  // Everything except Next's own assets and static files. The landing page is included on
  // purpose: it is where the masthead's "Sign in" link lives, and running the refresh there
  // means a returning user's token is already current by the time they click it.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
