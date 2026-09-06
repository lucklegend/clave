import type { CookieOptions } from "@supabase/ssr";

/**
 * The "Remember me" checkbox, made real.
 *
 * The checkbox is not a preference stored against the account — it decides the lifetime of the
 * session cookies this browser is about to be given, and nothing else. Supabase's own cookies
 * arrive from `@supabase/ssr` carrying its default (very long) `maxAge`; the sign-in action
 * writes this marker first, and {@link applyRememberLifetime} reads it back on every cookie
 * Supabase sets, in this request and in every later refresh.
 *
 * A separate marker cookie rather than a parameter threaded through the client, because the
 * cookies are also rewritten by `src/proxy.ts` on token refresh, long after the sign-in request
 * is over. The choice has to live somewhere the refresh can still see it.
 */
export const REMEMBER_COOKIE = "clavehq-remember";

/** 30 days. Long enough to be worth ticking, short enough that a shared machine forgets. */
export const REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * `httpOnly`, because nothing in the browser needs to read this and a script that can read it
 * can also flip a session cookie into a persistent one on a machine that is not the user's.
 */
export function rememberMarkerOptions(rememberMe: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    // Plain http on localhost during development would drop a `secure` cookie silently.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Unchecked means the marker itself is a session cookie too, so it expires exactly when
    // the session cookies it governs do and cannot outlive them.
    ...(rememberMe ? { maxAge: REMEMBER_MAX_AGE_SECONDS } : {}),
  };
}

/**
 * Rewrites the lifetime of one cookie Supabase is setting.
 *
 * Only `maxAge` and `expires` are touched. `httpOnly`, `sameSite`, `secure`, `path` and `domain`
 * are left exactly as `@supabase/ssr` set them: the browser client reads the session from
 * `document.cookie`, so forcing `httpOnly` here would sign the user out of every client
 * component while leaving the server convinced they are signed in.
 *
 * Not remembered → both fields removed, which is what makes a cookie a *session* cookie: it is
 * gone when the browser closes. Remembered → capped at 30 days rather than left at Supabase's
 * default, so "remember me" has a stated bound instead of an open-ended one.
 */
export function applyRememberLifetime(
  options: CookieOptions | undefined,
  rememberMe: boolean,
): CookieOptions {
  const next = { ...options };

  // Both are deleted rather than omitted by a rest-destructure: `expires` and `maxAge` are
  // alternative spellings of the same thing, and leaving either one behind would keep the
  // cookie persistent while the other said otherwise.
  delete next.maxAge;
  delete next.expires;

  if (rememberMe) {
    next.maxAge = REMEMBER_MAX_AGE_SECONDS;
  }

  return next;
}
