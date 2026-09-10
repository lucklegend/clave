import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/features/auth/lib/server";
import { can } from "@/features/authz/permissions";
import { loadAuthzContext } from "@/features/authz/server/context";
import { fetchAnnouncementById } from "./queries";
import type { AnnouncementRecord } from "../types";

/**
 * The one authorisation path in front of an attachment's bytes, shared by the two route handlers
 * under `app/(portal)/announcements/view/[id]/`.
 *
 * It is one function rather than the same twelve lines twice because the two routes must never
 * disagree about who may read a file: the download-and-inline route and the archive route hand a
 * caller exactly the same objects, and a check that drifts in one of them is a tenancy bug in a
 * place nobody would think to look.
 *
 * Three things happen here, in this order, and each one refuses on its own:
 *
 *   1. **The id is parsed as a uuid** before it can reach PostgREST, which answers a malformed
 *      uuid with an error — and an error is how `./queries.ts` says "the database is down". A
 *      junk id is a stale link, not an outage; `[id]/edit/page.tsx` records the same reasoning.
 *   2. **The caller is checked for `announcements.create`**, the capability the board itself
 *      gates on. Not `announcements.read`: that key is seeded to every role for the future
 *      resident feed, so gating on it would hand every owner and tenant a working download link
 *      for their village's drafts.
 *   3. **The announcement is loaded, and the attachment is found inside it.** This is the part
 *      that makes RLS the authority: `announcements_select` decides whether this caller may see
 *      this row at all, and `announcement_attachments_select` delegates its own visibility to
 *      that same row. Querying `announcement_attachments` by id directly — or trusting the path
 *      and signing a `storage_path` built from it — would put the tenancy decision in this file,
 *      where a mistake is silent.
 *
 * The Supabase client is built here rather than injected, for the reason `authz/server/context.ts`
 * gives for doing the same: a client derived from `cookies()` cannot be handed in from further
 * out than the request. It is returned to the caller so that the signed URL is minted with the
 * very session the checks above were made against.
 */
export type AnnouncementFileAccess =
  | {
      ok: true;
      /** The caller's own request-scoped client — the anon key and their session, never service-role. */
      client: Awaited<ReturnType<typeof createSupabaseServerClient>>;
      announcement: AnnouncementRecord;
    }
  | { ok: false; status: 404 | 503 };

/**
 * Resolve `announcementId` for a caller who wants its files, or say with which status to refuse.
 *
 * **404 is the refusal for every "no", and that is deliberate.** A caller without the capability,
 * a caller from another village, an id that was never a uuid and an announcement that has been
 * deleted all get the same answer, so the response cannot be used to establish that a particular
 * announcement exists somewhere. 403 would answer that question every time it was asked.
 *
 * 503 is kept apart from it because a database that did not answer is not a file that is not
 * there. An `<img>` that 404s tells the view the attachment is gone; an outage rendered as "gone"
 * is the quietest kind of wrong, and `./queries.ts` returns `null` separately from `{ row: null }`
 * precisely so that this distinction survives the read.
 */
export async function loadAnnouncementForFiles(
  announcementId: string,
): Promise<AnnouncementFileAccess> {
  const identifier = z.uuid().safeParse(announcementId);

  if (!identifier.success) {
    return { ok: false, status: 404 };
  }

  const result = await loadAuthzContext();

  // A signed-out caller does not normally reach here — `src/proxy.ts` is deny-by-default and
  // redirects one to `/sign-in` — but a session revoked between that check and this one lands
  // as `signed-out`, and a route handler serving an `<img>` has nothing useful to do with a
  // redirect to a sign-in form. It is a 404 with the rest.
  if (result.status === "unavailable") {
    return { ok: false, status: 503 };
  }

  if (result.status !== "ok" || !can(result.context.permissions, "announcements.create")) {
    return { ok: false, status: 404 };
  }

  const client = await createSupabaseServerClient();
  const found = await fetchAnnouncementById(client, identifier.data);

  if (found === null) {
    return { ok: false, status: 503 };
  }

  if (found.row === null) {
    return { ok: false, status: 404 };
  }

  return { ok: true, client, announcement: found.row };
}
