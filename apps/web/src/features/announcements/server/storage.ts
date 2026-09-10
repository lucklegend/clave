import "server-only";

import type { createSupabaseServerClient } from "@/features/auth/lib/server";
import type { PreparedAttachment } from "./attachments";

/**
 * Reading and writing the attachment bucket.
 *
 * Every function takes the Supabase client as a **parameter**, the same injection seam
 * `./queries.ts` and `features/authz/server/queries.ts` use, and the client it is given is the
 * request-scoped one from `features/auth/lib/server.ts` — the caller's session, the anon key, and
 * therefore the `storage.objects` policies in `20260909120000_announcements.sql` applying to
 * every call below. **Nothing here uses the service-role key.** `CLAUDE.md` names
 * `features/auth/server/resolve-identifier.ts` as its only reader and says a second one is a
 * decision to raise rather than a convenience; an upload made by someone who is signed in and
 * holds `announcements.create` has no reason to bypass RLS, and making it privileged would mean
 * the object policies were never really enforcing anything.
 */

/** The client `features/auth/lib/server.ts` builds per request, derived so the two cannot drift. */
type PortalClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Matches the bucket created in `supabase/migrations/20260909120000_announcements.sql`. */
export const ANNOUNCEMENT_ATTACHMENTS_BUCKET = "announcement-attachments";

/**
 * Sixty seconds on a signed link, download and inline alike.
 *
 * Long enough for a click to become a saved file, short enough that a URL pasted into a chat is
 * dead before anyone else opens it. A signed URL carries its own authority — it is honoured
 * without a session and without a policy check — so its lifetime is the whole of its access
 * control, and it is minted per request rather than stored anywhere.
 *
 * The routes under `app/(portal)/announcements/[id]/` are what make sixty seconds comfortable:
 * they redirect to a URL minted at the moment of the click, so a modal left open for an hour
 * still downloads, and no signed URL is ever written into HTML that could be cached or pasted.
 */
const DOWNLOAD_URL_TTL_SECONDS = 60;

/**
 * Where one attachment's bytes live.
 *
 * `<village_id>/<announcement_id>/<uuid>.<ext>`, and the first segment is load-bearing: the
 * bucket's insert and delete policies read it with `storage.foldername(name)` and compare it
 * against `villages.id`, so the tenant of an object is decided by its path with no join. A path
 * assembled any other way would land outside every policy and be refused — which is the failure
 * mode we want, but it is why this is one function rather than a template literal at three call
 * sites.
 *
 * `objectName` is the generated `<uuid>.<ext>` from `prepareAttachments`. Nothing an uploader
 * typed appears anywhere in the result.
 */
export function attachmentObjectPath(
  villageId: string,
  announcementId: string,
  objectName: string,
): string {
  return `${villageId}/${announcementId}/${objectName}`;
}

/**
 * Write one prepared attachment's bytes, answering whether they landed.
 *
 * `contentType` is the **canonical** type from the allowlist, carried on the prepared attachment.
 * The browser's `File.type` never reaches Storage: it is a client-supplied string, it is what
 * Supabase would echo back as the object's `Content-Type`, and a `text/html` echoed off our own
 * storage origin is the shape of a stored-XSS bug.
 *
 * `upsert` is `false` and stated rather than left to the default. Object names carry a UUID so a
 * collision is not a real event, but an overwrite would leave the `checksum_sha256` and
 * `byte_size` already recorded in `announcement_attachments` describing bytes that are no longer
 * there — which is exactly the state the migration's missing UPDATE policy is written to prevent.
 */
export async function uploadAttachment(
  client: PortalClient,
  path: string,
  attachment: PreparedAttachment,
): Promise<boolean> {
  const { error } = await client.storage
    .from(ANNOUNCEMENT_ATTACHMENTS_BUCKET)
    .upload(path, attachment.bytes, { contentType: attachment.mimeType, upsert: false });

  if (error !== null) {
    console.error(`Storing attachment "${path}" failed.`, error);

    return false;
  }

  return true;
}

/**
 * Delete objects, answering whether Storage removed every one of them.
 *
 * The two compensating callers — the save action's half-succeeded write and the announcement
 * delete — are already returning a failure and have nothing useful to do with a second one, so
 * they ignore the answer; what they need is that a refusal is not silent, and it is logged here.
 * `actions/remove-attachment.ts` does read it: it must not delete the row that names an object
 * still sitting in the bucket, because the row is the only thing that can find that object again.
 *
 * **A refusal does not have to be an error.** Storage answers a delete it will not perform with
 * an empty list and a 200 — an RLS refusal and a path that was never there look the same — so
 * the count of objects it reports removing is compared against the count asked for rather than
 * `error` being trusted on its own.
 */
export async function removeAttachmentObjects(
  client: PortalClient,
  paths: readonly string[],
): Promise<boolean> {
  if (paths.length === 0) {
    return true;
  }

  const { data, error } = await client.storage
    .from(ANNOUNCEMENT_ATTACHMENTS_BUCKET)
    .remove([...paths]);

  if (error !== null || data.length !== paths.length) {
    console.error(`Removing attachment objects failed: ${paths.join(", ")}.`, error);

    return false;
  }

  return true;
}

/**
 * A short-lived URL for downloading one attachment, or `null` if one could not be minted.
 *
 * `download: fileName` is what makes this a download rather than a view: Storage answers with
 * `Content-Disposition: attachment; filename="…"`, so the browser saves the file instead of
 * rendering it. That matters for the formats we accept — a PDF rendered in a tab is a scripting
 * environment, and rendering anything from a URL a person was handed is a thing we have chosen
 * not to do at all. `fileName` reaches a quoted header value here, which is why
 * `sanitiseFileName` strips control characters and the double quote before it is ever stored.
 *
 * `null` covers both "the read failed" and "you cannot see this object" — Storage does not
 * distinguish them, and neither should the page, since telling someone an object exists but is
 * not theirs is the disclosure the private bucket exists to prevent.
 */
export async function createAttachmentDownloadUrl(
  client: PortalClient,
  path: string,
  fileName: string,
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(ANNOUNCEMENT_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, DOWNLOAD_URL_TTL_SECONDS, { download: fileName });

  if (error !== null) {
    return null;
  }

  return data.signedUrl;
}

/**
 * A short-lived URL for **rendering** one attachment in the browser, or `null` if one could not
 * be minted.
 *
 * **This exists for image previews and for nothing else, and calling it is a security decision.**
 * Omitting `download` is the whole difference from {@link createAttachmentDownloadUrl}: Storage
 * then answers with `Content-Disposition: inline` and the object's stored content type, so the
 * browser renders the bytes instead of saving them. A separate function rather than an option on
 * the existing one, because a `{ download: false }` flag is exactly how a PDF acquires an inline
 * URL by accident — the call sites that must not do this would still compile.
 *
 * `docs/decisions/0004-announcements-and-attachment-uploads.md` D6 said no attachment is ever
 * served inline, and ticket 0011 amends that rather than working around it. What makes the
 * narrowed version safe is a chain that was already there:
 *
 *   * **Only `image/jpeg` and `image/png` may ever be signed this way.** The caller proves it
 *     with `isImageFormat` from `@clavehq/shared` — the single source of truth for that question
 *     — against the stored `mime_type` column, not against anything in the request.
 *   * **SVG is not on the allowlist**, by name and with the reasoning written beside it, so the
 *     one image format that is also a script host cannot be in the bucket to be asked for.
 *   * **The bytes were re-encoded on the way in.** `server/transcode.ts` decodes every image and
 *     writes a fresh file from the pixels, so a JPEG that was also an HTML document is not one
 *     any more, and HEIC has already become JPEG.
 *   * **The content type is the canonical one from the allowlist**, declared by `uploadAttachment`
 *     and never the browser's `File.type`, so a renderer is told exactly what the bytes are
 *     rather than left to guess.
 *
 * And the URL points at the **Storage origin, not at ours**. A rendered object is in Supabase's
 * origin with no access to a portal cookie or a portal DOM, whatever it turns out to contain —
 * which also means the `X-Content-Type-Options: nosniff` that `next.config.ts` puts on our own
 * responses is not on that one. Checked against the running stack rather than assumed; it is the
 * canonical content type above, not a header we control, that is doing the work here.
 */
export async function createAttachmentInlineUrl(
  client: PortalClient,
  path: string,
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(ANNOUNCEMENT_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, DOWNLOAD_URL_TTL_SECONDS);

  if (error !== null) {
    return null;
  }

  return data.signedUrl;
}
