import "server-only";

import { createClient } from "@supabase/supabase-js";
import { readPublicEnv } from "@clavehq/shared";
import type { Database } from "@clavehq/shared";

/**
 * Username → email resolution, and the only thing in this app that holds the service-role key.
 *
 * ## Why a privileged client at all
 *
 * The lookup happens *before* the caller is authenticated, so they are `anon`, and the
 * migration revokes every privilege on `public.users` from `anon`. Something has to read the
 * table on their behalf.
 *
 * ## Why not a `security definer` RPC granted to `anon`
 *
 * Because a function `anon` may call is a function anyone holding the anon key may call — and
 * the anon key is compiled into the browser bundle by design. An RPC that turns a username into
 * an email address would be a public endpoint for harvesting the email of every account on the
 * platform, callable in a loop. Moving the read behind `import "server-only"` means the only
 * way to reach it is through this app's own server actions, where the result is consumed
 * immediately and never returned to the caller.
 *
 * ## Blast radius
 *
 * The service-role key bypasses RLS entirely, so this module exports exactly one function and
 * no client. Nothing else in the codebase should import `@supabase/supabase-js` with this key,
 * and adding a second export here is the wrong way to solve any future problem.
 *
 * `import "server-only"` makes a client-component import a *build* error rather than a runtime
 * leak — the guarantee is enforced by the bundler, not by convention.
 */
export async function resolveUsernameToEmail(username: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("users")
    .select("email")
    // `username` is `citext`, so this compares case-insensitively in the database and the user
    // does not have to reproduce the capitalisation they signed up with.
    .eq("username", username)
    .maybeSingle();

  // A database failure and a missing row are both "no email", and the caller turns both into
  // the same rejection. Distinguishing them here would only give the sign-in form two shapes
  // of failure to leak.
  if (error !== null || data === null) {
    return null;
  }

  return data.email;
}

function createAdminClient() {
  const env = readPublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceRoleKey === undefined || serviceRoleKey.length === 0) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Copy apps/web/.env.example to " +
        "apps/web/.env.local and fill it in from the output of `pnpm supabase start`.",
    );
  }

  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      // This client must never acquire, persist or refresh a session. It is a privileged
      // one-shot reader; anything that made it stateful would risk that state outliving the
      // request and being reused for a different user.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
