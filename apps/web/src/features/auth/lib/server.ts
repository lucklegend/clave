import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { readPublicEnv } from "@clavehq/shared";
import type { Database } from "@clavehq/shared";
import { REMEMBER_COOKIE, applyRememberLifetime } from "./cookies";

/**
 * The request-scoped Supabase client. Carries the anon key and the caller's session, so every
 * query it makes runs as that user and is filtered by the RLS policies in
 * `supabase/migrations/20260906120000_identity_and_rbac.sql`. This is the client that should be
 * reaching the database for anything a user does.
 *
 * Created per request rather than once at module scope: it closes over one request's cookies,
 * and a shared instance would hand one user's session to the next.
 */
export async function createSupabaseServerClient() {
  const env = readPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // The marker is read here, inside the setter, rather than captured when the client is
          // built: the sign-in action writes it moments before `signInWithPassword` triggers
          // this callback, and Next's cookie store reflects a write within the same request.
          const rememberMe = cookieStore.get(REMEMBER_COOKIE)?.value === "1";

          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, applyRememberLifetime(options, rememberMe));
            }
          } catch {
            // Next forbids writing cookies while rendering a Server Component, and a page that
            // reads the session can trip a token refresh mid-render. Swallowing is correct here
            // rather than lazy: `src/proxy.ts` runs the same refresh on every matching
            // request and *can* write, so the refreshed token is already persisted by the time
            // rendering starts. Rethrowing would turn a successful refresh into a 500.
          }
        },
      },
    },
  );
}
