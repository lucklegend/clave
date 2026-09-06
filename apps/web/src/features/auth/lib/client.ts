"use client";

import { createBrowserClient } from "@supabase/ssr";
import { readPublicEnv } from "@clavehq/shared";
import type { Database } from "@clavehq/shared";

/**
 * The browser-side Supabase client, for client components that need to react to auth state —
 * a sign-out that has to clear local UI, a realtime subscription.
 *
 * `createBrowserClient` memoises internally, so calling this per component is not per-component
 * state; it is the same client and the same session each time.
 *
 * Signing *in* deliberately does not go through here. It runs in `../actions/sign-in.ts` as a
 * server action, so the password never enters the client bundle's control flow and the failure
 * path can be made uniform in one place.
 */
export function createSupabaseBrowserClient() {
  const env = readPublicEnv();

  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
