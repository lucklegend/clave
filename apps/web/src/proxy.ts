import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { readPublicEnv } from "@clavehq/shared";
import type { Database } from "@clavehq/shared";
import { REMEMBER_COOKIE, applyRememberLifetime } from "@/features/auth/lib/cookies";

/**
 * The public surface, matched **exactly**.
 *
 * `/` is the landing page and it is the only path that may be public without its children being
 * public too. Moving it into {@link PUBLIC_PREFIXES} would make every path on the site start
 * with a public prefix, which reverts this file to allow-by-default while looking like a
 * tidy-up. That asymmetry is the whole reason there are two lists.
 */
const PUBLIC_EXACT = ["/"] as const;

/**
 * The public surface, matched by prefix — the path itself and everything under it.
 *
 * This list and {@link PUBLIC_EXACT} are the *public* paths; everything else the matcher sees
 * needs a session. That is the inverse of listing the protected paths, and deliberately so: a
 * portal route nobody remembered to name is then guarded rather than open. Forgetting costs a
 * redirect loop, which is loud and fixed in minutes, instead of an unauthenticated read of a
 * village's data, which is silent.
 *
 * `/auth/callback` has to be named here or Google sign-in breaks in an infinite loop, every
 * time. The callback arrives carrying a PKCE code and *no session cookie yet* — exchanging the
 * code for that cookie is the route's entire job — so the guard would find no claims and send
 * the browser to `/sign-in`, which sends it to Google, which returns it to the callback. The
 * symptom looks exactly like a misconfigured redirect URL in Supabase, and would be chased
 * there first. `/sign-in` is the same shape of mistake one step earlier: unlisted, it redirects
 * to itself forever.
 */
const PUBLIC_PREFIXES = ["/sign-in", "/auth/callback"] as const;

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
 * 2. **Guard everything that is not public.** An unauthenticated request to any path outside
 *    {@link PUBLIC_EXACT} and {@link PUBLIC_PREFIXES} is sent to `/sign-in` instead of
 *    rendering an empty page.
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

  if (!isPublicPath(request.nextUrl.pathname) && data?.claims === undefined) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    // The deep link is dropped rather than carried in a `next` parameter. A redirect target
    // taken from the URL is how this becomes an open redirect, and `auth/callback/route.ts`
    // records the same objection about its own `next`.
    signInUrl.search = "";

    return NextResponse.redirect(signInUrl);
  }

  return response;
}

/** Whether `pathname` may be served without a session. Exact for `/`, by prefix for the rest. */
function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.some((path) => pathname === path)) {
    return true;
  }

  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export const config = {
  // Everything except Next's own assets and the static files below. The landing page is included
  // on purpose: it is where the masthead's "Sign in" link lives, and running the refresh there
  // means a returning user's token is already current by the time they click it.
  //
  // Now that the guard denies by default, this matcher is a security boundary in both
  // directions. A path excluded here is not "public" — it is *unguarded*, because the proxy
  // never runs on it, and it gets no token refresh either. Adding an exclusion is a decision to
  // open a route, not a performance tweak.
  //
  // Hence an explicit list of file names rather than the tempting "any last segment with a dot
  // in it": `users_username_format` in the identity migration permits `.` in a username, so
  // that shortcut would silently unguard a future `/u/jane.doe`. Everything named is a file a
  // client fetches before it could possibly have a session — the ACME challenges under
  // `.well-known/` are fetched by a certificate authority, and `assetlinks.json` /
  // `apple-app-site-association` are fetched by Android and iOS to verify the universal links
  // `apps/mobile` will register.
  //
  // Each file name is anchored with `$` so the exclusion names that one path and not everything
  // it prefixes — unanchored, `robots\.txt` would also unguard `/robots.txtevil`. `.well-known/`
  // is the one exclusion left as a prefix rather than a file, and deliberately so: RFC 8615 makes
  // `/.well-known/` itself a namespace, not a file, so anchoring it to one name would be wrong in
  // the other direction — it has to keep matching whatever the ACME client or the app-link
  // verifier asks for next.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$|site\\.webmanifest$|apple-app-site-association$|\\.well-known/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
