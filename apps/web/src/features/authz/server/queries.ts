import "server-only";

import type { createSupabaseServerClient } from "@/features/auth/lib/server";
import { toPermissionSet } from "../permissions";
import type { PermissionSet, Village } from "../types";

/**
 * The three reads behind `AuthzContext`, and the only place in the portal that talks to the
 * authorisation schema.
 *
 * Every function here takes the Supabase client as a parameter rather than building one. That is
 * the injection seam for this feature: a caller can see which client a read runs as, and the day
 * a test runner lands these can be driven with a stub instead of a live session. `context.ts` is
 * where the request-scoped client is actually constructed, because a client built from
 * `cookies()` cannot be handed in from anywhere further out than the request.
 *
 * `import "server-only"` for the same reason `features/auth/server/resolve-identifier.ts` carries
 * it: a client component that imported these would ship the reads into the browser, and the
 * bundler should refuse that rather than leave it to review.
 *
 * **Every function returns `null` on a failed read, and never an empty result.** An empty list
 * and a broken query are different claims about the world that look identical once they reach a
 * component — see the `AuthzResult` doc comment in `../types.ts`.
 */

/** The client `context.ts` builds per request, derived so the two cannot disagree. */
type PortalClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Every village the caller may see, ordered by name.
 *
 * This is also the tenancy check, which is why it is one query and not two: the `villages_select`
 * policy already filters the table to the caller's home village, the villages they hold a scoped
 * grant in, and — for a super admin — the whole platform. Asking whether a village is in this
 * list *is* asking whether they may be there, so a separate membership call could only ever
 * disagree with the switcher it sits beside.
 *
 * `public.current_village_ids()` is the wrong instrument for that check and is deliberately not
 * used: it returns nothing for a super admin with no home village and no scoped grant, so
 * checking membership against it locks super admins out of the portal entirely while
 * `villages_select` hands them every row.
 *
 * The `name` ordering is load-bearing rather than cosmetic. `context.ts` falls back to the first
 * village in this list when the caller has no home village, and an unordered select gives
 * whatever order the plan happens to produce — the portal would open on a different village
 * between two renders, with no cookie or URL segment to contradict it.
 */
export async function fetchAccessibleVillages(
  client: PortalClient,
): Promise<readonly Village[] | null> {
  const { data, error } = await client
    .from("villages")
    .select("id, name, slug, tier")
    .order("name");

  if (error !== null) {
    return null;
  }

  return data;
}

/**
 * The caller's *home* village id — `users.village_id`, the village they belong to, which is not
 * the same thing as the scope of any grant they hold.
 *
 * Wrapped in an object rather than returned bare, because `null` already means something here: a
 * super admin, or a Google sign-up nobody has placed yet, legitimately has no home village. The
 * wrapper keeps "the read failed" (`null`) apart from "the read says they have none"
 * (`{ villageId: null }`), which otherwise collapse into the same silent fallback.
 *
 * Filtered by `id` even though RLS would already narrow it: the `users_select` policy lets a
 * village admin read every member of their village, so an unfiltered select returns a page of
 * rows to answer a question about one.
 */
export async function fetchHomeVillageId(
  client: PortalClient,
  userId: string,
): Promise<{ villageId: string | null } | null> {
  const { data, error } = await client
    .from("users")
    .select("village_id")
    .eq("id", userId)
    .maybeSingle();

  // A missing profile row is a broken invariant, not an answer — `handle_new_user` creates one
  // for every `auth.users` insert — so it is reported as a failed read rather than as "no home
  // village", which would quietly open the portal on someone else's village.
  if (error !== null || data === null) {
    return null;
  }

  return { villageId: data.village_id };
}

/**
 * Every capability the caller holds in `villageId`, in one round trip.
 *
 * `public.user_permission_keys` takes no user id — the caller is always the caller — so there is
 * nothing to pass here that could ask about somebody else. The precedence it resolves (a `deny`
 * beats everything including super admin, a direct `allow` beats a missing role grant) lives in
 * `20260908130000_user_permission_keys.sql` and must not be re-implemented on this side.
 *
 * An empty set is a real answer and is returned as one: a resident in a village that has not
 * given them a role yet holds nothing, and that is not a failure.
 */
export async function fetchPermissionKeys(
  client: PortalClient,
  villageId: string,
): Promise<PermissionSet | null> {
  const { data, error } = await client.rpc("user_permission_keys", { p_village: villageId });

  if (error !== null) {
    return null;
  }

  // Parsed here, at the boundary the strings arrive on, so no caller downstream can hold an
  // unparsed key and no caller can forget to parse.
  return toPermissionSet(data);
}
