import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/features/auth/lib/server";

/**
 * The signed-in person's profile row — read **once per request**, however many callers ask for
 * it.
 *
 * There are two: the shell's account avatar wants a display name, and `/settings` wants the whole
 * row. They render in the same pass, so before this was memoised the portal read the same
 * `public.users` row twice and paid two round trips for one row.
 *
 * `cache()` is what makes that one read, and it is also why this builds its own client instead of
 * taking one as a parameter the way `features/authz/server/queries.ts` does. `cache()` keys on
 * its arguments by identity, and `createSupabaseServerClient()` returns a fresh object every
 * call — a client parameter would make the layout's call and the page's call two different keys
 * and two different reads, which is the thing being fixed. `features/authz/server/context.ts`
 * builds its client for the same reason: a client closed over `cookies()` cannot be handed in
 * from further out than the request anyway.
 *
 * A read of its own, and not a widening of `AuthzContext`. That type answers *what may this
 * caller do*, and a display name is not part of that answer — putting a profile behind the
 * authorisation seam would make every route that only wanted permissions pay for it.
 *
 * **Unlike the reads in `features/authz/server/queries.ts` this does not keep a failed read apart
 * from an empty answer**, and the difference is deliberate: there, an empty permission set and a
 * broken query mean opposite things and are rendered differently. Here both render the same
 * avatar with no initials in it and the same "—" in the profile cards, so a second shape would be
 * a distinction with no consumer.
 */
export const loadAccountProfile = cache(fetchAccountProfile);

async function fetchAccountProfile(userId: string) {
  const client = await createSupabaseServerClient();

  // `villages(name)` is the caller's *home* village, which is what `/settings` states as a fact
  // about the account — not the village the shell happens to be scoped to. Only the name: the
  // slug and the tier the pill needs come from `AuthzContext`, which already holds them.
  const { data, error } = await client
    .from("users")
    .select("full_name, username, email, status, villages(name)")
    .eq("id", userId)
    .maybeSingle();

  if (error !== null) {
    return null;
  }

  return data;
}

/**
 * The display name for the app bar's account avatar.
 *
 * Three columns because a portal account may have any of them: `full_name` is what an invited
 * member has, `username` what someone who signed up with one has, and `email` the fallback for a
 * Google sign-up nobody has filled in yet. Ordered most human first.
 */
export async function loadAccountName(userId: string): Promise<string | null> {
  const profile = await loadAccountProfile(userId);

  if (profile === null) {
    return null;
  }

  return profile.full_name ?? profile.username ?? profile.email;
}
