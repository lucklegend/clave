import { outlinedButton, textButton } from "@/features/brand/cta";
import { removeAttachmentAction } from "../actions/remove-attachment";
import { formatBytes } from "../format-bytes";
import type { AnnouncementAttachment } from "../types";

/**
 * The files an announcement already carries: one row each, with the way to get it back and the
 * way to take it off.
 *
 * A **Server Component**, and it has to be one — `docs/FRONTEND.md` §1's leaf rule cuts the other
 * way here for once. The download URL is minted per render by the page that draws this (see
 * `createAttachmentDownloadUrl`), and the removal is a `<form action>` dispatching a server
 * action directly, so there is no state, no effect and nothing for `"use client"` to buy.
 *
 * It draws the same row vocabulary as `AttachmentPicker`'s chosen-file list — the 4/3 inset, the
 * name over its size, the divided rounded card — because these are the same objects at a
 * different moment in their life. It carries none of that component's type badges: a badge there
 * distinguishes files the person is still choosing between, and a stored file already announces
 * its kind in the name it is listed under.
 */

type ListedAttachment = AnnouncementAttachment & {
  /**
   * The signed URL minted for this render, or `null` when Storage would not mint one.
   *
   * Never stored and never cached: it is valid for a minute (`DOWNLOAD_URL_TTL_SECONDS`), so a
   * URL held over from an earlier render would be a link that is dead before it is clicked.
   */
  downloadUrl: string | null;
};

type AttachmentListProps = {
  /** The post these files hang from — the removal's destination, not its scope. */
  announcementId: string;
  attachments: readonly ListedAttachment[];
  /**
   * Whether to draw the remove control at all. `announcements.update`, the key
   * `removeAttachmentAction` re-checks server-side: a control that is always refused is not a
   * design, and the check that matters is the one behind it either way.
   */
  canRemove: boolean;
};

// The remove disclosure's trigger. `<summary>` is a button in every way that matters here, so it
// takes the same 40px-with-a-48px-target geometry `features/brand/cta.ts` gives the real ones —
// but not `textButton` itself, whose baked `text-on-surface-variant` would land on the element
// beside `text-error` and win or lose by Tailwind's emission order rather than by intent (the
// hazard `cta.ts` records against `outlinedButton`). `list-none` plus the WebKit pseudo-element
// takes away the disclosure triangle in every engine.
const removeSummaryClasses =
  "m3-state m3-target label-l inline-flex h-10 cursor-pointer list-none items-center " +
  "rounded-full px-3 text-error [&::-webkit-details-marker]:hidden";

export function AttachmentList({ announcementId, attachments, canRemove }: AttachmentListProps) {
  // A bottom rule rather than a top one: this list sits above the form now, so the divider
  // belongs between it and what follows rather than above it.
  return (
    <section className="mb-8 border-b border-outline-variant pb-8">
      <h3 className="title-m text-on-surface">Files on this announcement</h3>
      <p className="body-m mt-1 max-w-[62ch] text-on-surface-variant">
        These stay attached. Anything you add below is added to them, not in place of them —
        removing one is the only thing that takes it off, and that also deletes it from storage and
        cannot be undone. A download link is signed for this page load and stops working about a
        minute later.
      </p>

      <ul className="mt-3 divide-y divide-outline-variant rounded-m border border-outline-variant bg-surface">
        {attachments.map((attachment) => (
          <li
            key={attachment.id}
            className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3 pr-3 pl-4"
          >
            <span className="min-w-0 flex-1 basis-48 py-2">
              <span className="body-m block truncate text-on-surface">{attachment.file_name}</span>
              <span className="body-s num block text-on-surface-variant">
                {formatBytes(attachment.byte_size)}
              </span>
            </span>

            {/* No `download` attribute: the signed URL carries `Content-Disposition: attachment`
                from Storage itself, which is what makes this save rather than render — and a
                `download` attribute is ignored cross-origin anyway, which this URL is. `type` is
                the hint the attribute exists for, and it is the canonical MIME from the
                allowlist rather than anything a browser once claimed. */}
            {attachment.downloadUrl === null ? (
              <span className="body-s px-3 py-3.5 text-on-surface-variant">
                Download unavailable
              </span>
            ) : (
              <a
                href={attachment.downloadUrl}
                type={attachment.mime_type}
                className={`${textButton} shrink-0`}
              >
                <DownloadGlyph />
                Download
              </a>
            )}

            {canRemove && (
              <details className="shrink-0">
                <summary className={removeSummaryClasses}>Remove</summary>
                {/* A form and not a link, for the reason `(portal)/settings/page.tsx` records at
                    its sign-out button: this deletes a file, and a GET that mutates is followed
                    by every prefetcher that touches the page. Opening the disclosure is the
                    confirmation step. A dialog now exists (ticket 0011), and this is still not
                    the place for one: a disclosure keeps the page's focus order and costs
                    nothing typed into the form beside it. */}
                <form action={removeAttachmentAction} className="pt-2">
                  <input type="hidden" name="announcementId" value={announcementId} />
                  <input type="hidden" name="attachmentId" value={attachment.id} />
                  <button type="submit" className={`${outlinedButton} text-error`}>
                    Remove for good
                  </button>
                </form>
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// The download arrow, 20px, hand-authored on the precedent every other glyph in this feature sets
// (`AttachmentPicker.tsx`): the icon font is subset to the shell's own glyphs, so a codepoint
// borrowed here would render as tofu. `aria-hidden`, since the word beside it says the same.
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
