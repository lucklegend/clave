import { NextResponse } from "next/server";
import { Zip, ZipPassThrough } from "fflate";
import { loadAnnouncementForFiles } from "@/features/announcements/server/attachment-access";
import { createAttachmentDownloadUrl } from "@/features/announcements/server/storage";
import type { AnnouncementAttachment } from "@/features/announcements/types";
import { sanitiseFileName } from "@/features/announcements/validation/file-name";
import type { createSupabaseServerClient } from "@/features/auth/lib/server";

/**
 * Every attachment on one announcement, as a zip, built while it is being sent.
 *
 * "Download all" is an ordinary `<a href>` because of this route: no client JavaScript, no archive
 * assembled in the browser, and the same single authorisation point as every other file link —
 * `features/announcements/server/attachment-access.ts`, whose doc comment carries the reasoning
 * about RLS and about why every refusal here is a 404.
 *
 * **Nothing is buffered.** The archive is written into a `TransformStream` as fflate produces it,
 * and each attachment's bytes are read from Storage a chunk at a time and pushed straight through,
 * so memory holds one chunk rather than one archive. `ATTACHMENT_LIMITS` allows 25 MiB of
 * attachments per announcement today and an edit appends more, so an implementation that assembled
 * the whole zip first would scale its memory with the cap and with every concurrent click on this
 * link.
 *
 * **`ZipPassThrough`, so entries are stored rather than deflated.** Every format on the allowlist —
 * JPEG, PNG, PDF and the three OOXML packages, which are themselves zips — is already compressed.
 * Deflating them again spends CPU per request to save approximately nothing, and it is CPU spent on
 * the server while the person waits.
 */
export async function GET(_request: Request, context: RouteContext<"/announcements/[id]/archive">) {
  const { id } = await context.params;
  const access = await loadAnnouncementForFiles(id);

  if (!access.ok) {
    return new NextResponse(null, {
      status: access.status,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { announcement } = access;

  // An announcement with nothing attached has no archive, and answering with an empty zip would be
  // a file that opens to nothing rather than an answer. The view only draws this link when there is
  // something to download; a hand-typed URL is what reaches this line.
  if (announcement.attachments.length === 0) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const fileName = archiveFileName(announcement.title, announcement.id);

  return new NextResponse(archiveStream(access.client, announcement.attachments), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      // Per caller and per village, like every other response in this feature: the archive is
      // assembled from rows RLS admitted for *this* session, so no shared cache may keep it. There
      // is no `Content-Length` to send either — the length is not known until the last entry has
      // been read, which is the price of not buffering.
      "Cache-Control": "no-store",
    },
  });
}

/** The client `features/auth/lib/server.ts` builds per request, derived so the two cannot drift. */
type PortalClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** `ZipPassThrough` ends an entry with a final chunk, which is allowed to carry no bytes. */
const END_OF_ENTRY = new Uint8Array(0);

/**
 * The response body: a stream that is already being written to by the time this returns.
 *
 * `fflate`'s `Zip` calls `ondata` **synchronously** from inside `push` and `end`, so the chunks it
 * produces are collected here and written by the pump between source chunks. That ordering is what
 * gives the route backpressure: awaiting the write before reading the next chunk from Storage means
 * a slow client slows the download rather than filling a queue in memory.
 */
function archiveStream(
  client: PortalClient,
  attachments: readonly AnnouncementAttachment[],
): ReadableStream<Uint8Array> {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const pending: Uint8Array[] = [];
  const zip = new Zip();
  let failure: Error | null = null;

  zip.ondata = (error, chunk) => {
    // `Zip` reports a failure by calling this with an error rather than by throwing, and it is
    // read by the pump: throwing from inside fflate's own call stack would unwind through `push`
    // and leave the archive half-described with no way to say so on a response already sent.
    if (error !== null) {
      failure = error;

      return;
    }

    pending.push(chunk);
  };

  // Deliberately not awaited. The caller returns `readable` as the response body immediately, and
  // this keeps filling it while those bytes are already on their way to the browser.
  void writeArchive({ zip, writer, pending, client, attachments, readFailure: () => failure });

  return readable;
}

/**
 * Read every attachment out of Storage and into the archive, one at a time.
 *
 * A failure part-way through can only be reported by aborting the stream. The status line and the
 * headers left before the first byte of the first file was read, so there is no 500 left to send —
 * the browser sees a connection that ended early and the partial file it saved will not open, which
 * is the honest outcome and the reason the failure is logged here with the path that caused it.
 */
async function writeArchive({
  zip,
  writer,
  pending,
  client,
  attachments,
  readFailure,
}: {
  zip: Zip;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  pending: Uint8Array[];
  client: PortalClient;
  attachments: readonly AnnouncementAttachment[];
  readFailure: () => Error | null;
}): Promise<void> {
  const taken = new Set<string>();

  async function drain(): Promise<void> {
    const failure = readFailure();

    if (failure !== null) {
      throw failure;
    }

    for (let chunk = pending.shift(); chunk !== undefined; chunk = pending.shift()) {
      await writer.write(chunk);
    }
  }

  try {
    for (const attachment of attachments) {
      // Signed here rather than for the whole set up front: five URLs minted at once would all be
      // ageing against the same sixty seconds while the first file is still being read, and a slow
      // client would then be handed an expired token for the last of them.
      const url = await createAttachmentDownloadUrl(
        client,
        attachment.storage_path,
        attachment.file_name,
      );

      if (url === null) {
        throw new Error(`No signed URL for "${attachment.storage_path}".`);
      }

      const response = await fetch(url);

      if (!response.ok || response.body === null) {
        throw new Error(`Storage answered ${response.status} for "${attachment.storage_path}".`);
      }

      const entry = new ZipPassThrough(uniqueEntryName(taken, attachment.file_name));
      zip.add(entry);

      const reader = response.body.getReader();

      for (;;) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        entry.push(value);
        await drain();
      }

      entry.push(END_OF_ENTRY, true);
      await drain();
    }

    // Writes the central directory. Without it the bytes already sent are not an archive.
    zip.end();
    await drain();
    await writer.close();
  } catch (cause) {
    console.error("Streaming an announcement archive failed.", cause);

    await writer.abort(cause);
  }
}

/**
 * What the browser saves the archive as: the announcement's title, slugged, or its id.
 *
 * ASCII letters, digits and hyphens only, which is narrower than `Content-Disposition` allows and
 * deliberately so — the value is interpolated into a quoted header, and a name that cannot contain
 * a quote, a semicolon or a newline cannot break out of one. A title that slugs away to nothing
 * (one written entirely in a non-Latin script, say) falls back to the id, which always produces a
 * name.
 */
function archiveFileName(title: string, announcementId: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    // Trimmed after the slice, not before, so a cut that lands mid-word does not leave the hyphen
    // it fell on at the end of the name.
    .slice(0, 60)
    .replace(/^-+|-+$/gu, "");

  return `${slug === "" ? announcementId : slug}.zip`;
}

/**
 * A name no other entry in this archive is using.
 *
 * Two attachments on one announcement can carry the same `file_name` — nothing forbids attaching
 * `receipt.pdf` twice, and an edit appends rather than replaces — and two entries with one name
 * make an archive whose extraction silently drops a file. A ` (2)` before the extension is what a
 * file manager would have done.
 *
 * Compared case-insensitively, because the collision that matters happens at extraction time on a
 * filesystem that mostly does not distinguish `Report.pdf` from `report.pdf`.
 *
 * `sanitiseFileName` runs again here even though it already ran before the name was stored: it is
 * what reduces a name to its last path segment, and an entry name carrying `../` is the zip-slip
 * bug. It is cheap, and an archive is the one place these names become paths again.
 */
function uniqueEntryName(taken: Set<string>, fileName: string): string {
  const name = sanitiseFileName(fileName);
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";

  for (let attempt = 1; ; attempt += 1) {
    const candidate = attempt === 1 ? name : `${stem} (${attempt})${extension}`;
    const key = candidate.toLowerCase();

    if (!taken.has(key)) {
      taken.add(key);

      return candidate;
    }
  }
}
