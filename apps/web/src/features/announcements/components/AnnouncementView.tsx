import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { findAttachmentTypeByMimeType, isImageFormat } from "@clavehq/shared";
import { createSupabaseServerClient } from "@/features/auth/lib/server";
import { can } from "@/features/authz/permissions";
import type { PermissionSet } from "@/features/authz/types";
import { filledButton, outlinedButton } from "@/features/brand/cta";
import { announcementHref, editAnnouncementHref } from "../edit-url";
import { formatBytes } from "../format-bytes";
import { fetchAnnouncementById } from "../server/queries";
import { announcementDisplayStatus } from "../status";
import type { AnnouncementAttachment } from "../types";
import { StatusBadge } from "./StatusBadge";

/**
 * An announcement as a reader sees it: title, status, who posted it and when, the words, the
 * files, and the way back to the editor.
 *
 * **One component, two routes.** `@modal/(.)view/[id]/page.tsx` draws this inside a dialog over the
 * board and `view/[id]/page.tsx` draws it as a full page; whichever way somebody arrived, they read the
 * same markup. That only holds because **the read lives here rather than in the routes**: the uuid
 * parse, `fetchAnnouncementById`, `notFound()` for a row RLS will not show, and the notice for a
 * read that failed are all below, so there is no second copy of any of them to drift. What the
 * routes own is the gate in front of this — session, then `announcements.create` — because a route
 * is reachable on its own and inherits nothing from the page it is drawn over.
 *
 * **A Server Component, with no client leaf under it.** Everything here is markup and links: the
 * file controls are anchors to route handlers that mint a signed URL when they are followed, and
 * "Download all" is an anchor to the archive route, so nothing on this view needs state, an effect
 * or a fetch from the browser. The announcement, its attachments and the caller's permission set
 * therefore never enter the bundle — the same seam `Modal` describes for the body it is handed.
 *
 * **No signed URL is rendered here.** A Storage URL lives sixty seconds and a modal can sit open
 * for ten minutes, so every link points at this origin — `…/files/[attachmentId]`, that route with
 * `?inline=1`, and `…/archive` — and the signing happens at click time behind them. See
 * `app/(portal)/announcements/view/[id]/files/[attachmentId]/route.ts`, which is also where the D6
 * amendment is enforced: this view decides what to *draw* as an image, that route decides what may
 * be *served* as one, and both ask `@clavehq/shared` the same question.
 */
export type AnnouncementViewProps = {
  /** The `[id]` segment, straight from the URL and not yet known to be a uuid. */
  id: string;
  /**
   * The caller's capabilities in the current village, already resolved by the route's own gate.
   *
   * Passed down rather than resolved again so the view and the gate in front of it can never
   * answer from two different permission sets. It decides the Edit button, on
   * `announcements.update`.
   */
  permissions: PermissionSet;
};

// Built once at module scope rather than once per render, on `StatusBadge`'s reasoning, and in
// `Asia/Manila` for the same reason: the people reading it are a Philippine HOA board, not the box
// the Next server runs on. Date only, because the *time* that matters to a reader is the publish
// time, which `StatusBadge` prints in full two lines above this one — repeating it to the minute
// here would put two timestamps of equal weight on one header.
const postedOnFormat = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Manila",
});

export async function AnnouncementView({ id, permissions }: AnnouncementViewProps) {
  const identifier = z.uuid().safeParse(id);

  // Parsed before it reaches PostgREST, which answers a malformed uuid with an error — and an
  // error is how `server/queries.ts` says "the database is down". A junk id is a stale link, not
  // an outage; `[id]/edit/page.tsx` and `server/attachment-access.ts` both record the same rule.
  if (!identifier.success) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const found = await fetchAnnouncementById(supabase, identifier.data);

  if (found === null) {
    return <FailedRead />;
  }

  // A row this caller may not see, one that was deleted, and one that never existed are all the
  // same 404 — saying which would confirm that an announcement exists in some other village.
  if (found.row === null) {
    notFound();
  }

  const announcement = found.row;
  const { images, documents } = splitAttachments(announcement.attachments);

  return (
    // A reading column, capped near the 680px the compose and edit pages give their own column.
    // The dialog is 512px inside its padding and never reaches this cap, so it costs nothing
    // there; on the full page, whose `<main>` is the board's 1180px, it is what keeps the status
    // badge beside the title it belongs to and the file list from stretching a metre wide.
    <article className="max-w-[720px]">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        {/* `basis-72` rather than a breakpoint: the badge drops below the title when the column is
            narrow, which is a fact about the space this view was given — 512px inside the dialog,
            far more on the page — and not about the size of the window. */}
        <div className="min-w-0 flex-1 basis-72">
          <h2 className="headline-s text-on-surface">{announcement.title}</h2>
          <p className="body-m mt-1.5 text-on-surface-variant">
            Posted by{" "}
            <strong className="font-medium text-on-surface">
              {announcement.authorName ?? "Removed account"}
            </strong>{" "}
            on {postedOnFormat.format(new Date(announcement.created_at))}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <StatusBadge
            status={announcementDisplayStatus(announcement, new Date())}
            publishAt={announcement.publish_at}
          />
        </div>
      </header>

      {/* The body is plain text that was typed into a textarea, so its newlines are the only
          formatting it has and `whitespace-pre-wrap` is what keeps them. Deliberately not run
          through a markdown renderer: nothing writes markdown into that field, and turning stored
          text into markup is how a post becomes a script tag. `break-words` because a pasted URL
          is longer than 512px of dialog. */}
      <p className="body-l mt-6 max-w-[62ch] whitespace-pre-wrap break-words text-on-surface">
        {announcement.body}
      </p>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h3 className="title-m text-on-surface">Files</h3>

          {/* One file is already one click away in the list below, so the archive earns its place
              only from two upwards. `outlinedButton` carries no label colour by design — see
              `features/brand/cta.ts` — so this call site states its own. */}
          {announcement.attachments.length > 1 && (
            <a
              href={`${announcementHref(announcement.id)}/archive`}
              className={`${outlinedButton} shrink-0 text-primary`}
            >
              <DownloadGlyph />
              Download all
            </a>
          )}
        </div>

        {announcement.attachments.length === 0 ? (
          <p className="body-m mt-3 rounded-m border border-outline-variant px-4 py-8 text-center text-on-surface-variant">
            No files are attached to this announcement.
          </p>
        ) : (
          <>
            {images.length > 0 && <ImageGrid announcementId={announcement.id} images={images} />}
            {documents.length > 0 && (
              <DocumentList announcementId={announcement.id} documents={documents} />
            )}
          </>
        )}
      </section>

      {can(permissions, "announcements.update") && (
        <div className="mt-8 flex justify-end border-t border-outline-variant pt-6">
          {/* A `<Link>`, not an anchor: the editor is a page, and from inside the dialog this is a
              soft navigation that leaves the board where it is. The file controls above are plain
              anchors for the opposite reason — a route handler is not a page and must not be
              prefetched or client-navigated to. */}
          <Link href={editAnnouncementHref(announcement.id)} className={filledButton}>
            Edit announcement
          </Link>
        </div>
      )}
    </article>
  );
}

/**
 * The attachments split into the ones this view renders and the ones it lists.
 *
 * Decided from the stored `mime_type` through `@clavehq/shared`, never from the file name and
 * never from `mime_type.startsWith("image/")`: `isImageFormat` is the one place that question is
 * answered, and the route that serves an image inline asks it too. A string test here would be a
 * second opinion about which files are images, sitting a click away from the security guard that
 * holds the first.
 *
 * A MIME type this build does not recognise falls to the document list. That is the fail-closed
 * answer — it is a row written by a build that knew a format this one does not, and "I do not know
 * what this is" is never a reason to put it in an `<img>`.
 */
function splitAttachments(attachments: readonly AnnouncementAttachment[]) {
  const images: AnnouncementAttachment[] = [];
  const documents: AnnouncementAttachment[] = [];

  for (const attachment of attachments) {
    const type = findAttachmentTypeByMimeType(attachment.mime_type);
    const isImage = type !== undefined && isImageFormat(type.format);

    (isImage ? images : documents).push(attachment);
  }

  return { images, documents };
}

/** Where a single attachment is fetched. `?inline=1` on the same route is the preview. */
function attachmentHref(announcementId: string, attachmentId: string): string {
  return `${announcementHref(announcementId)}/files/${attachmentId}`;
}

// `auto-fill` rather than a fixed column count or a breakpoint, for the reason the header records:
// this component is laid out inside a 560px dialog and inside a 1180px page, and the grid should
// answer to the width it was handed rather than to the width of the window. At 512px of dialog
// that is two columns; on the page it is five.
const imageGridClasses = "mt-3 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3";

// The overlay download control: a control sitting on somebody's photograph, where no contrast can
// be assumed from the content underneath.
//
// **`inverse-surface` / `inverse-on-surface`, opaque, is what makes that provable.** M3 gives a
// `scrim` role but no on-scrim content colour, and this scheme's `--md-scrim` is `#000000` in both
// themes while every on-colour flips with the scheme — so a translucent scrim disc would have to
// take its icon colour from a token that is legible on black in *both* themes, and there is none.
// The inverse pair is M3's answer to "a surface that contrasts with the current scheme" (it is
// what a snackbar is drawn from), it clears AA in both, and being opaque it clears it over any
// photograph rather than over most of them.
//
// `m3-state` is deliberately not used: it paints its state layer by setting `background-color`,
// which on a filled control replaces the fill instead of layering over it. So the hover is
// composited by hand, base colour first — the arithmetic and the `color-mix` fallback hazard are
// both written out at `filledButton` in `features/brand/cta.ts`.
const overlayDownloadClasses =
  "absolute top-2 right-2 inline-flex size-12 items-center justify-center rounded-full " +
  "bg-inverse-surface text-inverse-on-surface shadow-[var(--md-elev-1)] " +
  "transition-[background-color] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] " +
  "hover:bg-[color-mix(in_srgb,var(--md-inverse-surface),var(--md-inverse-on-surface)_8%)]";

/**
 * The images, drawn rather than listed.
 *
 * `object-contain` on a fixed 4:3 tile, not `object-cover`: an attachment here is as likely to be
 * a scanned notice as a photograph of a gate, and cropping a notice hides the words that are the
 * whole point of attaching it. The tile's aspect ratio is fixed in CSS, which is also what holds
 * the layout still while a lazily-loaded image arrives.
 */
function ImageGrid({
  announcementId,
  images,
}: {
  announcementId: string;
  images: readonly AnnouncementAttachment[];
}) {
  return (
    <ul className={imageGridClasses}>
      {images.map((image) => (
        <li
          key={image.id}
          className="relative overflow-hidden rounded-m border border-outline-variant bg-surface-container-highest"
        >
          {/* `next/image` cannot serve this and the rule is disabled rather than worked around:
              the source is a same-origin route handler that answers `no-store` and 302s to a
              short-lived signed URL, so the optimiser would have to re-fetch it server-side
              without the caller's session — which is exactly the request that must 404. The alt
              text is the file name because that is the only description anybody wrote; inventing
              one would describe a picture this code has never seen. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${attachmentHref(announcementId, image.id)}?inline=1`}
            alt={image.file_name}
            loading="lazy"
            decoding="async"
            className="block aspect-[4/3] w-full object-contain"
          />

          {/* Icon-only, so `aria-label` carries the whole meaning and `title` gives a mouse user
              the same words — the convention `SidebarToggle` sets. Named with the file, because a
              grid of them would otherwise announce "Download" four times. */}
          <a
            href={attachmentHref(announcementId, image.id)}
            type={image.mime_type}
            aria-label={`Download ${image.file_name}`}
            title={`Download ${image.file_name}`}
            className={overlayDownloadClasses}
          >
            <DownloadGlyph />
          </a>
        </li>
      ))}
    </ul>
  );
}

// A transparent icon control, so `m3-state` is right here where it was wrong over the photograph.
const rowDownloadClasses =
  "m3-state inline-flex size-12 shrink-0 items-center justify-center rounded-full " +
  "text-on-surface-variant";

/**
 * The files that are not images: one row each, name over size, with the way to get it at the row's
 * top right.
 *
 * The same row vocabulary as `AttachmentList` on the edit page — the divided card, the 4/3 inset,
 * the name over its size — because these are the same objects at a different moment in their life.
 * It carries no remove control: this view is read-only, and removing a file is what the editor is
 * for.
 */
function DocumentList({
  announcementId,
  documents,
}: {
  announcementId: string;
  documents: readonly AnnouncementAttachment[];
}) {
  return (
    <ul className="mt-3 divide-y divide-outline-variant rounded-m border border-outline-variant bg-surface">
      {documents.map((file) => (
        <li key={file.id} className="flex items-start gap-3 py-3 pr-2 pl-4">
          <span className="min-w-0 flex-1 py-2">
            <span className="body-m block truncate text-on-surface">{file.file_name}</span>
            <span className="body-s num block text-on-surface-variant">
              {formatBytes(file.byte_size)}
            </span>
          </span>

          {/* No `download` attribute: the route this points at redirects to a Storage URL carrying
              `Content-Disposition: attachment`, which is what makes the file save rather than
              render — and `download` is ignored across origins anyway, which that redirect
              crosses. `type` is the canonical MIME from the allowlist, the hint the attribute
              exists for. */}
          <a
            href={attachmentHref(announcementId, file.id)}
            type={file.mime_type}
            aria-label={`Download ${file.file_name}`}
            title={`Download ${file.file_name}`}
            className={rowDownloadClasses}
          >
            <DownloadGlyph />
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * What a failed read renders — a database that did not answer, and not an announcement that is not
 * there.
 *
 * The two are kept apart all the way from `fetchAnnouncementById`'s `null` versus `{ row: null }`,
 * so an outage is never drawn as a 404. Same wording as the edit page's own outage notice, since
 * it is the same outage.
 */
function FailedRead() {
  return (
    <div>
      <h2 className="headline-s text-on-surface">Announcement</h2>
      <p className="body-l mt-3 max-w-[62ch] text-on-surface-variant">
        This announcement could not be loaded. Reload the page; if it keeps happening, the database
        is the place to look.
      </p>
    </div>
  );
}

// The download arrow, 20px, hand-authored on the precedent every other glyph in this feature sets
// (`AttachmentList.tsx`, which draws this same path): the icon font is subset to the shell's own
// eleven nav glyphs, so a codepoint borrowed here would render as tofu. `aria-hidden`, because
// each caller above already names the action in words.
function DownloadGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 4.5v12M7.5 12l4.5 4.5 4.5-4.5" />
      <path d="M4.5 15v3.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V15" />
    </svg>
  );
}
