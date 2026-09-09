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
 * Take one file off an announcement that already has it: the object out of the bucket, then the
 * row out of `announcement_attachments`.
 *
 * A dedicated action rather than a branch of `./save-announcement.ts`. That action refuses a set
 * of files entire and writes nothing when any of them is bad, which is the right shape for an
 * upload and the wrong one for a removal: a person taking a file off a post should not have their
 * removal undone because the same submission carried an unrelated rejection, and the compose form
 * has no way to express "this file, gone" in the `FormData` it builds. It is also dispatched from
 * a `<form action>` in a Server Component, so — exactly as in `./delete-announcement.ts` — it
 * takes the form data alone, returns nothing, and reports a refusal by redirecting to the edit
 * page with a flag it draws `ATTACHMENT_REMOVE_FAILED_MESSAGE` from.
 *
 * ## The object goes before the row
 *
 * The same ordering `./delete-announcement.ts` records, for a sharper version of the same reason:
 * `storage_path` lives in the row and nowhere else. Delete the row first and the only pointer to
 * those bytes is gone with it — `announcement_attachments_object_select` makes the object
 * unreadable at the same moment — so what is left in the bucket cannot be listed, reached or
 * removed by anybody, and is still being paid for. The reverse failure leaves a row naming an
 * object that is not there: a download that 404s, which is visible and fixable.
 *
 * The row is only deleted once Storage confirms it removed the object, which is why
 * `removeAttachmentObjects` reports rather than swallowing.
 *
 * ## The capability
 *
 * `announcements.update`, not `.delete`. Taking a file off a post is an edit of that post — the
 * post survives it — and the migration is written the same way round: both
 * `announcement_attachments_write` and `announcement_attachments_object_delete` accept `.update`.
 * `.delete` is the key for destroying the announcement itself.
 */
export async function removeAttachmentAction(formData: FormData): Promise<void> {
  const attachmentId = z.uuid().safeParse(formData.get("attachmentId"));
  const announcementId = z.uuid().safeParse(formData.get("announcementId"));

  // The announcement id is the destination and nothing else: the delete below is scoped by the
  // attachment's own id and the session's village, so a tampered value here buys a redirect to
  // an edit page that will 404, not somebody else's file. Without a valid one there is no page to
  // report to at all, which is the only reason this branch leaves for the board.
  if (!announcementId.success) {
    redirect("/announcements");
  }

  const failedDestination = editAnnouncementHref(announcementId.data, "attachment");

  if (!attachmentId.success) {
    redirect(failedDestination);
  }

  const authz = await loadAuthzContext();

  if (authz.status !== "ok") {
    redirect(failedDestination);
  }

  const villageId = authz.context.village.id;
  const client = await createSupabaseServerClient();

  // The single guard at a mutation boundary, as in the other two actions: the policies enforce
  // the same key, and asking first is what turns a silent zero-row delete into a message.
  const permitted = await fetchHasPermission(client, "announcements.update", villageId);

  if (permitted !== true) {
    redirect(failedDestination);
  }

  const { data: attachment, error: readError } = await client
    .from("announcement_attachments")
    .select("storage_path")
    .eq("id", attachmentId.data)
    .eq("village_id", villageId)
    .maybeSingle();

  // `null` here is a file that is already gone, or one this caller cannot see — both mean there
  // is nothing to remove and nothing to say beyond the one message.
  if (readError !== null || attachment === null) {
    console.error(`Reading attachment ${attachmentId.data} failed.`, readError);

    redirect(failedDestination);
  }

  const removed = await removeAttachmentObjects(client, [attachment.storage_path]);

  if (!removed) {
    redirect(failedDestination);
  }

  const { error, count } = await client
    .from("announcement_attachments")
    .delete({ count: "exact" })
    .eq("id", attachmentId.data)
    .eq("village_id", villageId);

  // `count` rather than `error` alone, as in `./delete-announcement.ts`: a DELETE that matches no
  // visible row is zero rows and no error, and this one has already removed the object — a row
  // left behind now names bytes that are not there, which is exactly what the message is for.
  if (error !== null || count === 0) {
    console.error(`Removing attachment ${attachmentId.data} failed.`, error);

    redirect(failedDestination);
  }

  // The board draws a per-announcement file count, so it is stale the moment this succeeds — the
  // same argument the save action's `revalidatePath` records.
  revalidatePath("/announcements");
  redirect(editAnnouncementHref(announcementId.data));
}
