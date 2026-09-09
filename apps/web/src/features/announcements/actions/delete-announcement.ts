"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/features/auth/lib/server";
import { loadAuthzContext } from "@/features/authz/server/context";
import { fetchHasPermission } from "@/features/authz/server/queries";
import { editAnnouncementHref } from "../edit-url";
import { removeAttachmentObjects } from "../server/storage";

/**
 * Delete one announcement and every file attached to it.
 *
 * Reads a single `id` from the form. The village is resolved from the session, exactly as in
 * `./save-announcement.ts` and for exactly the same reason, and it is applied to the delete so an
 * id belonging to another village is a no-op the caller is told about rather than something the
 * policy has to catch.
 *
 * ## The objects go before the row
 *
 * `announcement_attachments_parent_fkey` is `on delete cascade`, so deleting the announcement
 * takes the attachment rows with it — and `announcement_attachments_object_select` makes an
 * object readable only when a row names it. Delete the row first and the files are still in the
 * bucket with nothing left that can see or remove them: unreachable, un-deletable, and still
 * being paid for.
 *
 * The exposure that ordering buys is the mirror image, and it is the smaller one: if the row
 * delete fails after the objects are gone, the announcement stays with attachment rows pointing
 * at files that no longer exist — visible, obviously wrong, and fixable by deleting it again. An
 * invisible leak is not fixable by anybody, because nobody finds it.
 *
 * ## Why it takes the form data alone, and returns nothing
 *
 * The control that dispatches it is a `<form action>` in a Server Component — the shape
 * `features/auth/actions/sign-out.ts` has, and for the reason the comment at its call site in
 * `(portal)/settings/page.tsx` gives: a delete is a mutation, and a link that mutates is followed
 * by every prefetcher and link scanner that touches the page. That form has no `useActionState`
 * to receive a result, so every path here ends in a `redirect`: the board on success, and the
 * edit page carrying a `failed` flag on every refusal, which is where
 * `ANNOUNCEMENT_DELETE_FAILED_MESSAGE` is drawn (`../edit-url.ts`).
 */
export async function deleteAnnouncementAction(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));

  // The one refusal with nowhere to report itself: an id that is not a uuid names no edit page to
  // send anybody back to. It only happens to a tampered form — every rendered one carries the id
  // the page was loaded with.
  if (!id.success) {
    redirect(BOARD_DESTINATION);
  }

  const failedDestination = editAnnouncementHref(id.data, "delete");
  const authz = await loadAuthzContext();

  if (authz.status !== "ok") {
    redirect(failedDestination);
  }

  const villageId = authz.context.village.id;
  const client = await createSupabaseServerClient();

  // The single guard at a mutation boundary, as in `./save-announcement.ts` — `announcements_delete`
  // enforces the same key, and asking first is what turns a refusal into a message.
  const permitted = await fetchHasPermission(client, "announcements.delete", villageId);

  if (permitted !== true) {
    redirect(failedDestination);
  }

  const paths = await fetchAttachmentPaths(client, id.data, villageId);

  if (paths === null) {
    redirect(failedDestination);
  }

  await removeAttachmentObjects(client, paths);

  const { error, count } = await client
    .from("announcements")
    .delete({ count: "exact" })
    .eq("id", id.data)
    .eq("village_id", villageId);

  // `count` rather than `error` alone: a DELETE that matches no visible row is zero rows and no
  // error, so an announcement someone else already removed — or one RLS hid — would otherwise
  // redirect to the board looking like a success.
  if (error !== null || count === 0) {
    console.error(`Deleting announcement ${id.data} failed.`, error);

    redirect(failedDestination);
  }

  // Same argument as the save action's: `/announcements` is a Server Component and the router
  // would otherwise redirect to a cached copy of the board that still lists the deleted post.
  revalidatePath(BOARD_DESTINATION);
  redirect(BOARD_DESTINATION);
}

const BOARD_DESTINATION = "/announcements";

/**
 * Every stored object belonging to one announcement, or `null` if the read failed.
 *
 * `null` and not an empty list, the rule `features/announcements/server/queries.ts` states: an
 * announcement with no attachments and a read that did not answer look identical as `[]`, and
 * treating the second as the first would delete the row and strand its files.
 */
async function fetchAttachmentPaths(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  announcementId: string,
  villageId: string,
): Promise<readonly string[] | null> {
  const { data, error } = await client
    .from("announcement_attachments")
    .select("storage_path")
    .eq("announcement_id", announcementId)
    .eq("village_id", villageId);

  if (error !== null) {
    console.error(`Reading attachments of announcement ${announcementId} failed.`, error);

    return null;
  }

  return data.map((row) => row.storage_path);
}
