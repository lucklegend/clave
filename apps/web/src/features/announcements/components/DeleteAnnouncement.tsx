import { outlinedButton } from "@/features/brand/cta";
import { deleteAnnouncementAction } from "../actions/delete-announcement";

/**
 * The way out: delete this announcement, and every file attached to it, for good.
 *
 * A **Server Component** with a plain `<form action>`, copied from the sign-out control in
 * `(portal)/settings/page.tsx` — a delete is a mutation, and a link that mutates is followed by
 * every prefetcher and link scanner that touches the page. Nothing here needs `"use client"`:
 * there is no state, and the disclosure below is HTML's own.
 *
 * **The confirmation is a `<details>` and not a dialog.** This repository has no Dialog, no focus
 * trap and no overlay, and a feature ticket that invents all three has become a component-library
 * ticket. A disclosure is the smallest thing that makes the destructive button a second,
 * deliberate action rather than a mis-click — it keeps the page's own focus order, it needs no
 * JavaScript, and it costs nothing typed into the form above it, which a confirm-by-navigation
 * would throw away.
 *
 * The page decides whether to draw this at all, on `announcements.delete`. The action re-checks
 * the same key server-side; the gate here is so that nobody is offered a button that can only
 * refuse them.
 */
export function DeleteAnnouncement({ announcementId }: { announcementId: string }) {
  return (
    <section className="mt-10 border-t border-outline-variant pt-8">
      <h3 className="title-m text-on-surface">Delete this announcement</h3>
      <p className="body-m mt-1 max-w-[62ch] text-on-surface-variant">
        The post goes, and so does every file attached to it. Residents stop seeing it on their next
        load. There is no undo and no archive to fish it back out of.
      </p>

      <details className="mt-3">
        {/* `<summary>` is the trigger, styled like the button it behaves as. It carries no baked
            label colour from `features/brand/cta.ts` for the reason that file records: two text
            colours on one element are resolved by Tailwind's emission order, not by intent. */}
        <summary className="m3-state m3-target label-l inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-outline px-6 text-error [&::-webkit-details-marker]:hidden">
          <DeleteGlyph />
          Delete announcement
        </summary>

        <form action={deleteAnnouncementAction} className="mt-3 flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={announcementId} />
          <button type="submit" className={`${outlinedButton} text-error`}>
            Yes, delete it and its files
          </button>
          <p className="body-s text-on-surface-variant">
            This is the second and last step — the next click removes it.
          </p>
        </form>
      </details>
    </section>
  );
}

// The bin, 20px, hand-authored on the precedent every other glyph in this feature sets
// (`AttachmentPicker.tsx`): the icon font is subset to the shell's eleven nav glyphs, so a
// borrowed codepoint would render as a tofu box with a green build behind it.
function DeleteGlyph() {
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
      <path d="M5 7h14M10 7V5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V7" />
      <path d="M6.5 7l.8 11a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9L17.5 7" />
      <path d="M10.5 10.5v5.5M13.5 10.5v5.5" />
    </svg>
  );
}
