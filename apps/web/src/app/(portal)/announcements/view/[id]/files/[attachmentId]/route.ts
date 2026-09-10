import { NextResponse } from "next/server";
import { z } from "zod";
import { findAttachmentTypeByMimeType, isImageFormat } from "@clavehq/shared";
import { loadAnnouncementForFiles } from "@/features/announcements/server/attachment-access";
import {
  createAttachmentDownloadUrl,
  createAttachmentInlineUrl,
} from "@/features/announcements/server/storage";

/**
 * One attachment, fetched at the moment it is asked for.
 *
 * **Nothing about this route puts a signed URL in a page.** The announcement view links here, at
 * our own origin, and this handler mints the Storage URL when the link is followed — so a modal
 * left open past the sixty-second TTL still downloads, no credential is ever written into HTML
 * that could be cached or screenshotted, and there is exactly one place where an attachment is
 * authorised. `features/announcements/server/attachment-access.ts` is that place; read its doc
 * comment for why the announcement is loaded rather than the attachment queried by id.
 *
 * Two things it serves, and the difference between them is the security decision in this file:
 *
 *   * By default, a **download** — `Content-Disposition: attachment`, the browser saves the file.
 *   * With `?inline=1`, a **render** — and only for `image/jpeg` and `image/png`.
 *
 * The repo's other Route Handler, `app/auth/callback/route.ts`, is the shape this follows.
 */
export async function GET(
  request: Request,
  context: RouteContext<"/announcements/view/[id]/files/[attachmentId]">,
) {
  const { id, attachmentId } = await context.params;
  const attachment = z.uuid().safeParse(attachmentId);

  // Parsed before it reaches PostgREST for the same reason the announcement id is — see
  // `loadAnnouncementForFiles` — except that this one never reaches the database at all: it is
  // compared against ids already fetched with the announcement.
  if (!attachment.success) {
    return refuse(404);
  }

  const access = await loadAnnouncementForFiles(id);

  if (!access.ok) {
    return refuse(access.status);
  }

  // Found *in the announcement's own attachments*, which is what makes RLS the authority on
  // visibility: the row came back embedded under a parent the caller was allowed to read. An id
  // belonging to another village's announcement is simply not in this list.
  const row = access.announcement.attachments.find((candidate) => candidate.id === attachment.data);

  if (row === undefined) {
    return refuse(404);
  }

  const wantsInline = new URL(request.url).searchParams.get("inline") === "1";

  if (!wantsInline) {
    const url = await createAttachmentDownloadUrl(access.client, row.storage_path, row.file_name);

    return url === null ? refuse(404) : found(url);
  }

  // **The whole of the amendment to ADR 0004 D6.**
  //
  // D6 said no attachment is ever served inline, because a stored file rendered in a browser is
  // a stored file running inside our own security context. Ticket 0011 narrows that rather than
  // dropping it: an image preview is inline serving, so inline serving is restricted to the two
  // formats that can be *proved* safe to render — `image/jpeg` and `image/png`, decided by
  // `isImageFormat` in `@clavehq/shared` against the row's stored `mime_type` and never against
  // anything in the request. `createAttachmentInlineUrl`'s doc comment carries the rest of the
  // chain (SVG is off the allowlist, images are re-encoded on upload, and the bytes are served
  // from the Storage origin under the canonical content type they were stored with).
  //
  // **404, not 403.** A PDF's id with `?inline=1` is a request for something this route does not
  // serve, and answering "forbidden" would confirm that the id names a real attachment — the same
  // disclosure every other refusal here avoids. It also keeps the failure indistinguishable from
  // a caller who may not see the announcement at all, which is the point.
  if (!isInlineRenderable(row.mime_type)) {
    return refuse(404);
  }

  const url = await createAttachmentInlineUrl(access.client, row.storage_path);

  return url === null ? refuse(404) : found(url);
}

/** Whether a stored MIME type is one of the two the D6 amendment admits for inline rendering. */
function isInlineRenderable(mimeType: string): boolean {
  const type = findAttachmentTypeByMimeType(mimeType);

  // A type this build does not recognise fails closed. `mime_type` is written from the allowlist,
  // so an unrecognised value means a row from a build that knew a format this one does not — and
  // "I do not know what this is" is never a reason to render it.
  return type !== undefined && isImageFormat(type.format);
}

/**
 * A 302 to the signed URL.
 *
 * 302 rather than Next's default 307: the method is irrelevant on a GET-only route, and 302 is
 * what an `<img>`, a `<a download>` and every intermediary already understand as "the bytes are
 * over there for now".
 *
 * **`no-store` is not decoration.** The response body is a URL carrying its own authority for the
 * next sixty seconds, and the answer is different for every caller and every village. A shared
 * cache that kept one would hand the next person a working link to somebody else's file.
 */
function found(signedUrl: string): NextResponse {
  return NextResponse.redirect(signedUrl, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}

/** An empty refusal, with no body to say which of the several possible "no"s this one was. */
function refuse(status: 404 | 503): NextResponse {
  return new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });
}
