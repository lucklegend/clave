"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ANNOUNCEMENT_SAVE_FAILED_MESSAGE,
  ATTACHMENTS_REFUSED_MESSAGE,
  announcementDraftSchema,
  type AnnouncementDraftFields,
  type SaveAnnouncementFailure,
  type SaveAnnouncementResult,
} from "@clavehq/shared";
import { createSupabaseServerClient } from "@/features/auth/lib/server";
import { loadAuthzContext } from "@/features/authz/server/context";
import { fetchHasPermission } from "@/features/authz/server/queries";
import { prepareAttachments, type PreparedAttachment } from "../server/attachments";
import { scanFile } from "../server/scan";
import { attachmentObjectPath, removeAttachmentObjects, uploadAttachment } from "../server/storage";
import { transcodeImage } from "../server/transcode";

/**
 * The board's one write path: create an announcement, or edit one that exists.
 *
 * ## Where the village comes from
 *
 * From `loadAuthzContext()`, and never from the form. A `village_id` that arrives in a POST body
 * is a cross-tenant write with a friendly name — the RLS policy would be the only thing between
 * it and another village's board, and a policy is a second line of defence, not a first.
 * `announcementDraftSchema` has no `villageId` field for the same reason, so there is nothing to
 * read even if someone reached for it.
 *
 * ## Where the author comes from
 *
 * From the same place. `created_by` is set to the resolved user id on insert; a `created_by` in
 * the form data is ignored outright. The database says the same thing twice more:
 * `announcements_insert`'s `with check` requires `created_by = auth.uid()`, so a forged id is a
 * refused insert rather than a false byline, and `announcements_guard_created_by` freezes the
 * column afterwards.
 *
 * ## The form fields this reads
 *
 *   * `title`, `body`, `intent`, `publishAt` — the draft, parsed by `announcementDraftSchema`.
 *   * `id` — present only when editing. Its presence is what makes this an update.
 *   * `attachments` — zero to five files, under one repeated field name.
 *
 * `publishAt` must carry a timezone offset (`2026-09-10T14:30+08:00`). A native `datetime-local`
 * input submits a naive value, and the schema rejects it rather than reinterpret it in the
 * server's zone; the compose form converts before submitting, and a naive value that gets here
 * surfaces as a field error on `publishAt` instead of scheduling a post for the wrong hour.
 *
 * Shaped for `useActionState`, so it takes the previous state and returns the next one. On
 * success it does not return at all — `redirect` throws — which is why the return type has no
 * success variant.
 */
export async function saveAnnouncementAction(
  _previous: SaveAnnouncementResult | null,
  formData: FormData,
): Promise<SaveAnnouncementResult> {
  const parsed = announcementDraftSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    intent: formData.get("intent"),
    publishAt: formData.get("publishAt"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the fields below.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const target = readAnnouncementId(formData);

  if (target === null) {
    return { ok: false, message: ANNOUNCEMENT_SAVE_FAILED_MESSAGE };
  }

  const authz = await loadAuthzContext();

  // Anything but `"ok"` is a caller with no village to write into: signed out, no village, no
  // capabilities, or a failed read. One message covers all four — see
  // `ANNOUNCEMENT_SAVE_FAILED_MESSAGE`, whose doc comment is the argument.
  if (authz.status !== "ok") {
    return { ok: false, message: ANNOUNCEMENT_SAVE_FAILED_MESSAGE };
  }

  const { userId, village } = authz.context;
  const client = await createSupabaseServerClient();

  // The explicit guard, and the point of it. `announcements_insert` and `announcements_update`
  // in `20260909120000_announcements.sql` enforce exactly this, so nothing gets written without
  // it either way — but an RLS refusal arrives as zero rows affected, or as a bare 42501, and
  // neither is something a person can read. Asking first turns a silent no-op into a sentence.
  //
  // `fetchHasPermission` (`public.user_has_permission`) and not the batch
  // `fetchPermissionKeys` (`public.user_permission_keys`): the batch answers a whole page's
  // worth of gates in one round trip and is what draws the drawer, and this is the single guard
  // at a mutation boundary that `CLAUDE.md` reserves the singular function for.
  const permitted = await fetchHasPermission(
    client,
    target.id === null ? "announcements.create" : "announcements.update",
    village.id,
  );

  if (permitted !== true) {
    return { ok: false, message: ANNOUNCEMENT_SAVE_FAILED_MESSAGE };
  }

  // Before anything is written. The pipeline refuses a set entire, so a rejection here leaves no
  // row and no object to compensate for — which is why it runs ahead of the insert rather than
  // between the insert and the upload.
  const prepared = await prepareAttachments(readAttachments(formData), {
    transcodeImage,
    scanFile,
  });

  if (!prepared.ok) {
    return {
      ok: false,
      message: ATTACHMENTS_REFUSED_MESSAGE,
      attachmentErrors: prepared.rejections.map((rejection) => ({
        fileName: rejection.fileName,
        message: rejection.message,
      })),
    };
  }

  const scope = { villageId: village.id, userId };
  const announcementId = await writeAnnouncement(client, target, parsed.data, scope);

  if (announcementId === null) {
    return { ok: false, message: ANNOUNCEMENT_SAVE_FAILED_MESSAGE };
  }

  const stored = await storeAttachments(client, prepared.attachments, {
    ...scope,
    announcementId,
  });

  if (!stored) {
    // The compensating path, and the part of this action a reader will not infer.
    //
    // Rows are written before bytes are uploaded, because `announcement_attachments_object_select`
    // makes an object readable only when a row names it — the reverse order would leave a window
    // in which the bytes exist and nothing can reach them. The cost of that order is this: an
    // upload that fails leaves rows pointing at objects that are not there, and an attachment row
    // with no object behind it is a download link that 404s forever. `storeAttachments` has
    // already removed the rows and objects it wrote; what is left is the announcement itself.
    //
    // Only if *this call* created it. An edit whose upload failed keeps its announcement — the
    // post existed before and deleting it would turn a failed attachment into a lost notice,
    // which is a far worse outcome than the field edits that stay applied.
    if (target.id === null) {
      await deleteAnnouncement(client, announcementId, village.id);
    }

    return { ok: false, message: ANNOUNCEMENT_SAVE_FAILED_MESSAGE };
  }

  // The repo's first `revalidatePath`, because it is the repo's first action that writes
  // something a *different* route renders — sign-in only ever redirected to a page that resolves
  // its own session. `/announcements` is a Server Component reading the board, and without this
  // the client router serves the copy it already has, so a post saved a second ago is missing
  // from the list it redirects to. Not a manual refetch: the data is not in a client cache to
  // invalidate, it is in the router's, and this is the API that owns it.
  revalidatePath(BOARD_DESTINATION);
  redirect(BOARD_DESTINATION);
}

const BOARD_DESTINATION = "/announcements";

/** The client `features/auth/lib/server.ts` builds per request, derived so the two cannot drift. */
type PortalClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** The village and the person, resolved from the session and passed down rather than re-read. */
type WriteScope = { villageId: string; userId: string };

/**
 * Which announcement is being saved: `{ id: null }` to create one, `{ id }` to edit that one, and
 * `null` when the form carried an `id` that is not a uuid.
 *
 * The wrapper is what keeps those three apart — the same idiom `fetchHomeVillageId` uses in
 * `features/authz/server/queries.ts`. Collapsing the malformed case into "create" would answer a
 * tampered form by quietly writing a second announcement, which is the kind of helpfulness that
 * shows up in a support ticket as a duplicate nobody posted.
 */
function readAnnouncementId(formData: FormData): { id: string | null } | null {
  const raw = formData.get("id");

  if (typeof raw !== "string" || raw === "") {
    return { id: null };
  }

  const parsed = z.uuid().safeParse(raw);

  return parsed.success ? { id: parsed.data } : null;
}

/**
 * The files the picker submitted, under the one repeated `attachments` field name.
 *
 * Empty entries are dropped rather than passed on: a file input that was never used still submits
 * one `File` with an empty name and zero bytes, and handing that to the pipeline would refuse
 * every form that attaches nothing. Nothing else about these `File`s is trusted — `size` and
 * `type` are re-derived from the bytes inside `prepareAttachments`.
 */
function readAttachments(formData: FormData): readonly File[] {
  return formData.getAll("attachments").filter(isAttachedFile);
}

function isAttachedFile(entry: FormDataEntryValue): entry is File {
  return entry instanceof File && entry.size > 0;
}

/**
 * The (status, publish_at) pair for an intent.
 *
 * `announcements_publish_at_iff_published` requires the two to agree — a published row carries a
 * time, a draft carries none — so they are decided together, in one place, rather than assembled
 * at two call sites that could drift into a Postgres error.
 *
 * "Publish now" and "schedule" collapse into one branch on purpose. The schema's transform drops
 * `publishAt` unless the intent is `"schedule"`, so a `Date` here *is* a schedule and its absence
 * *is* "now" — and "now" is read from the server clock at write time rather than from a field the
 * browser filled in, which is the same reason the schedule case insists on an offset.
 */
function publicationColumns(fields: AnnouncementDraftFields) {
  if (fields.intent === "draft") {
    return { status: "draft", publish_at: null } as const;
  }

  const publishAt = fields.publishAt instanceof Date ? fields.publishAt : new Date();

  return { status: "published", publish_at: publishAt.toISOString() } as const;
}

/**
 * Insert or update the announcement row, answering with its id or `null`.
 *
 * `null` covers both a failed write and one RLS filtered away. The update deliberately reads its
 * result back: an UPDATE that matches no visible row is not an error in PostgREST, it is zero
 * rows, and without the read-back a revoked capability or an id belonging to another village
 * would look exactly like a successful save.
 *
 * `created_by` is written on insert and never on update — the guard trigger would reject the
 * second, and there is nothing to say: authorship is set once.
 */
async function writeAnnouncement(
  client: PortalClient,
  target: { id: string | null },
  fields: AnnouncementDraftFields,
  scope: WriteScope,
): Promise<string | null> {
  const columns = { title: fields.title, body: fields.body, ...publicationColumns(fields) };

  if (target.id === null) {
    const { data, error } = await client
      .from("announcements")
      .insert({ ...columns, village_id: scope.villageId, created_by: scope.userId })
      .select("id")
      .single();

    if (error !== null) {
      console.error("Creating an announcement failed.", error);

      return null;
    }

    return data.id;
  }

  const { data, error } = await client
    .from("announcements")
    .update(columns)
    .eq("id", target.id)
    // Redundant against the policy and cheap: it keeps an id from another village from being the
    // thing the policy has to catch.
    .eq("village_id", scope.villageId)
    .select("id")
    .maybeSingle();

  if (error !== null || data === null) {
    console.error("Updating an announcement failed.", error);

    return null;
  }

  return data.id;
}

/**
 * Write the attachment rows, then their bytes, and undo both if any upload fails.
 *
 * Rows first: `announcement_attachments_object_select` makes an object readable only when a row
 * naming it is readable, so the row is what the file hangs from. Uploads are sequential for the
 * reason `prepareAttachments` gives about its own loop, and because a failure has to know exactly
 * which objects made it into the bucket before it.
 *
 * The undo is scoped to the paths *this call* generated, never to the announcement, so an edit
 * that adds a sixth file keeps the five that were already attached to it.
 */
async function storeAttachments(
  client: PortalClient,
  attachments: readonly PreparedAttachment[],
  scope: WriteScope & { announcementId: string },
): Promise<boolean> {
  if (attachments.length === 0) {
    return true;
  }

  const pending = attachments.map((attachment) => ({
    attachment,
    path: attachmentObjectPath(scope.villageId, scope.announcementId, attachment.objectName),
  }));

  const { error } = await client.from("announcement_attachments").insert(
    pending.map(({ attachment, path }) => ({
      announcement_id: scope.announcementId,
      village_id: scope.villageId,
      storage_path: path,
      file_name: attachment.fileName,
      mime_type: attachment.mimeType,
      byte_size: attachment.byteSize,
      checksum_sha256: attachment.checksumSha256,
      created_by: scope.userId,
    })),
  );

  if (error !== null) {
    console.error("Recording announcement attachments failed.", error);

    return false;
  }

  const uploaded: string[] = [];

  for (const { attachment, path } of pending) {
    const stored = await uploadAttachment(client, path, attachment);

    if (!stored) {
      await removeAttachmentObjects(client, uploaded);
      await deleteAttachmentRows(
        client,
        pending.map((entry) => entry.path),
      );

      return false;
    }

    uploaded.push(path);
  }

  return true;
}

/** Best effort, on a path that is already returning a failure. A refusal is logged, not raised. */
async function deleteAttachmentRows(client: PortalClient, paths: readonly string[]): Promise<void> {
  const { error } = await client
    .from("announcement_attachments")
    .delete()
    .in("storage_path", [...paths]);

  if (error !== null) {
    console.error(`Removing attachment rows failed: ${paths.join(", ")}.`, error);
  }
}

/** Likewise best effort: the announcement this call created, being taken back. */
async function deleteAnnouncement(
  client: PortalClient,
  id: string,
  villageId: string,
): Promise<void> {
  const { error } = await client
    .from("announcements")
    .delete()
    .eq("id", id)
    .eq("village_id", villageId);

  if (error !== null) {
    console.error(`Rolling back announcement ${id} failed.`, error);
  }
}

/**
 * The first issue per field, keyed by field name.
 *
 * Walks `issues` rather than going through `z.flattenError`, for the reason `toFieldErrors` in
 * `features/auth/actions/sign-in.ts` spells out: matching the path segment against a literal
 * narrows to exactly the keys the union declares, with nothing asserted.
 */
function toFieldErrors(error: z.ZodError): SaveAnnouncementFailure["fieldErrors"] {
  const result: NonNullable<SaveAnnouncementFailure["fieldErrors"]> = {};

  for (const issue of error.issues) {
    const [field] = issue.path;

    // First issue wins, as in sign-in: a field with two problems shows the first thing wrong
    // with it rather than the last.
    if (field === "title" && result.title === undefined) {
      result.title = issue.message;
    }

    if (field === "body" && result.body === undefined) {
      result.body = issue.message;
    }

    if (field === "intent" && result.intent === undefined) {
      result.intent = issue.message;
    }

    if (field === "publishAt" && result.publishAt === undefined) {
      result.publishAt = issue.message;
    }
  }

  return result;
}
