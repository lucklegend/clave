import "server-only";

import { cache } from "react";
import { isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/features/auth/lib/server";
import { fetchAccessibleVillages, fetchHomeVillageId, fetchPermissionKeys } from "./queries";
import type { AuthzResult, Village } from "../types";

/**
 * Resolve the caller, their village and their capabilities — once per request, however many times
 * it is asked for.
 *
 * React's `cache()` is what makes this safe to call from everywhere. The portal layout, the
 * navigation drawer, the top bar and the page each need the answer, and each calling it directly
 * is what keeps the shell server-first: no context provider, and no defensive fetch in a layout
 * that then has to drill the result down. Without the memo that is four copies of the same reads;
 * with it, the first caller pays and the rest read the value it resolved.
 *
 * **`cache()` and never `unstable_cache` or `"use cache"`.** They read as interchangeable and are
 * opposites: `cache()` is per-request memoisation that dies with the request, while both of the
 * others persist *across* requests, keyed on their arguments. A permission set computed for one
 * caller and replayed for the next is a cross-tenant escalation that RLS can never catch, because
 * RLS was satisfied — for the first caller. `docs/FRONTEND.md` §1 states the rule; this is the
 * seam it was written about. Two round trips per render is the price, and it will look exactly
 * like something to optimise.
 */
export const loadAuthzContext = cache(resolveAuthzContext);

async function resolveAuthzContext(): Promise<AuthzResult> {
  const client = await createSupabaseServerClient();

  // `getUser`, not `getClaims`: it revalidates the token against the auth server rather than
  // trusting what the cookie claims, which is the reason `dashboard/page.tsx` already records.
  // The proxy verifies a signature and routes on it; the identity everything below is authorised
  // against should come from the auth server itself.
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  // `supabase-js` does not throw here: a transport failure or a 5xx from `/auth/v1/user` comes
  // back as `{ data: { user: null }, error: AuthRetryableFetchError }`, the same shape as a
  // genuine "no session". Only two things mean the auth server looked and found nothing —
  // `AuthSessionMissingError` (no session to check) and a 401 `AuthApiError` (the token it did
  // find is invalid or expired) — and only those two are `signed-out`. Everything else is a read
  // that failed to answer the question, which is `unavailable`, exactly as the two queries below
  // already treat their own failures.
  if (error !== null) {
    if (isAuthSessionMissingError(error) || (isAuthApiError(error) && error.status === 401)) {
      return { status: "signed-out" };
    }

    return { status: "unavailable" };
  }

  if (user === null) {
    return { status: "signed-out" };
  }

  // Independent reads, so they overlap rather than queue. Neither depends on the other's answer.
  const [villages, home] = await Promise.all([
    fetchAccessibleVillages(client),
    fetchHomeVillageId(client, user.id),
  ]);

  if (villages === null || home === null) {
    return { status: "unavailable" };
  }

  const village = resolveVillage(villages, home.villageId);

  if (village === undefined) {
    return { status: "no-villages" };
  }

  const permissions = await fetchPermissionKeys(client, village.id);

  if (permissions === null) {
    return { status: "unavailable" };
  }

  if (permissions.size === 0) {
    return { status: "no-access" };
  }

  return { status: "ok", context: { userId: user.id, villages, village, permissions } };
}

/**
 * The village the portal opens on: the caller's home village while they can still reach it, and
 * otherwise the first village they can.
 *
 * Server-resolved on every request, with **no cookie and no `/v/[village]` URL segment** — a
 * deliberate scope decision for ticket 0007, whose consequence is that the switcher pill renders
 * as designed and cannot switch. Changing that is a ticket with a scope mechanism in it rather
 * than a line added here, and the shape of that mechanism is what decides whether the portal's
 * routes can stay flat.
 *
 * The home village is looked up *in the accessible list* rather than trusted from
 * `users.village_id` directly, so the village the shell scopes to is always one of the entries the
 * switcher shows and always one RLS has already admitted. Returns `undefined` when there are no
 * accessible villages at all — which is the caller's `"no-villages"` case, and incidentally why
 * there is no unchecked index here.
 */
function resolveVillage(villages: readonly Village[], homeVillageId: string | null) {
  const home = villages.find((village) => village.id === homeVillageId);

  return home ?? villages.at(0);
}
