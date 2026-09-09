"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { iconButton } from "@/features/brand/cta";

/**
 * This repository's first dialog, and deliberately the last one anybody has to write.
 *
 * Three call sites declined to build one before this — `announcements/new/page.tsx`,
 * `DeleteAnnouncement.tsx` and `AttachmentList.tsx` — all on the same grounds: a feature ticket
 * that invents a dialog, a focus trap and an overlay has become a component-library ticket. This
 * is the ticket that pays that debt, so the primitive is built once, here, and the reasoning is
 * written down where the next caller will read it.
 *
 * **It is the native `<dialog>` element opened with `showModal()`, and that is the whole design.**
 * The platform gives, for free, every piece this repo would otherwise have had to hand-roll:
 *
 *   * focus is trapped inside the dialog and everything outside it is made inert, so `Tab` cannot
 *     reach the board behind;
 *   * `Escape` closes it, with no `keydown` listener anywhere;
 *   * focus returns to whatever was focused when it opened, on close, with no saved reference;
 *   * it renders in the **top layer**, above every stacking context on the page;
 *   * `::backdrop` is a real pseudo-element, so the scrim is CSS rather than a second div.
 *
 * **The top layer is why this ticket adds no z-index scale, and there still is none in the repo.**
 * A modal rendered inline would sit inside `ShellProvider`'s content column, which is
 * `overflow-y-auto` — so it would be clipped by the column — and would have to out-stack
 * `StickyBar`'s `z-10`. `showModal()` escapes both without a number: the top layer paints above
 * the whole document regardless of `z-index`. Adding a scale would have been the larger change and
 * would have had exactly one consumer.
 *
 * **The body is server-rendered and arrives as `children`.** Same seam as `ShellProvider`: this
 * client leaf owns the open/close mechanics and nothing else, so the announcement, its
 * attachments and the caller's permission set are rendered on the server and travel as payload.
 * Nothing about the content crosses into the browser bundle.
 *
 * **Dismissing navigates.** The modal's visibility is a fact about the URL — it is an intercepted
 * route, not client state — so every way out funnels through the one `close` event and from there
 * into a navigation. If dismissal only hid the dialog, the URL would still name the announcement
 * and the back button would appear to do nothing.
 *
 * **Being navigated away from is not dismissal, and telling the two apart is why `usePathname` is
 * here.** A parallel slot keeps its last rendered subtree when the router moves to a sibling
 * segment the slot's own pattern does not match: following the body's "Edit announcement" link to
 * `/announcements/[id]/edit` renders the editor underneath but leaves *this component mounted and
 * this dialog open*, because Next has no state for the slot at the new URL and reuses what it had.
 * `default.tsx` does not rescue it — that file answers a *hard* load, where there is no state to
 * reuse. Verified rather than assumed: the dialog node survives the navigation with its DOM
 * identity intact, so nothing unmounts, no cleanup runs, and `showModal()`'s inertness leaves the
 * editor unclickable behind a stale read-only view.
 *
 * So the dialog watches the path it was opened for and closes itself when the app leaves it — and
 * that close must **not** navigate. The navigation is what closed it; sending `router.back()` after
 * it would undo the very move the person asked for and drop them back on the page they were
 * reading. Dismissed by the user goes back; navigated away from just closes.
 */

// M3's basic dialog: `surface-container-high`, 28dp corners (`rounded-xl`) and elevation level 3.
// `--md-elev-3` is declared in `globals.css` and this is its first consumer; so is `--md-scrim`,
// mixed to M3's 32% scrim opacity on `::backdrop` below.
//
// **`::backdrop` reads `--md-scrim` by inheritance**, which is a recent platform change worth
// naming: `::backdrop` originally inherited from nothing, so a custom property declared on
// `:root` was invisible to it and every scrim had to be a literal colour. It became a
// tree-abiding pseudo-element that inherits from its originating element in Chrome 122,
// Firefox 120 and Safari 17.4, which is what lets the scrim be a token here like every other
// colour in this codebase.
//
// `p-0` is load-bearing twice: the dialog's box is then exactly its two children, so a click whose
// target is the dialog itself is unambiguously a click on the backdrop (see `handleClick`), and
// the scrolling region below can carry its own padding without the header scrolling away with it.
//
// M3 caps the basic dialog at 560dp and holds a 48dp minimum margin around it; `max-h` keeps the
// dialog inside the viewport so its body scrolls rather than the dialog running off-screen.
//
// **`not-open:hidden` puts back a UA rule that `flex` displaced.** The browser's own stylesheet
// hides a closed dialog with `dialog:not([open]) { display: none }`, and a class of ours that sets
// `display` — `flex`, needed for the header/body column — outranks it. That went unnoticed while
// the dialog only ever existed open: the element used to unmount on the way out. Now that it can
// stay mounted and closed (see the navigate-away branch above), a closed dialog without this would
// sit in the flow as an ordinary box, still swallowing clicks meant for the page it is over.
const dialogClasses =
  "m-auto flex not-open:hidden max-h-[calc(100dvh-96px)] w-[calc(100vw-48px)] max-w-[560px] flex-col " +
  "rounded-xl bg-surface-container-high p-0 text-on-surface shadow-[var(--md-elev-3)] " +
  "backdrop:bg-scrim/32 " +
  // The enter is decoration and is written so it can only ever be decoration. The
  // `prefers-reduced-motion` blanket in `globals.css` kills every transition and animation with
  // `!important`, so a dialog that faded itself in from an animation would never become visible
  // for those users. Here visibility comes from `showModal()` alone: `@starting-style` (the
  // `starting:` variant) supplies the values the transition starts *from*, and the settled state —
  // opaque, unscaled — is what the element has with no transition running at all.
  "scale-100 opacity-100 transition-[opacity,transform] duration-[150ms] " +
  "ease-[cubic-bezier(0.2,0,0,1)] starting:scale-95 starting:opacity-0 " +
  "backdrop:opacity-100 backdrop:transition-opacity backdrop:duration-[150ms] " +
  "backdrop:starting:opacity-0";

// The close control sits in its own row above the body rather than floating over it: the body is
// somebody else's server-rendered content and an absolutely positioned button would collide with
// whatever its first line happens to be. It is also the dialog's first focusable element, so
// `showModal()`'s own initial-focus rule puts the caret on "Close" — the one control every dialog
// has, and the one a keyboard user reaches for first.
const headerClasses = "flex shrink-0 items-center justify-end px-2 pt-2";

// `min-h-0` is what lets this shrink inside the flex column so its own overflow engages, rather
// than the column growing past the dialog's `max-h`. `overscroll-contain` stops a scroll that
// reaches the end of this region from chaining onwards to the page.
const bodyClasses = "min-h-0 overflow-y-auto overscroll-contain px-6 pt-1 pb-6";

// `iconButton` states no radius, for the reason `features/brand/cta.ts` records, so this call site
// states the full round it wants — as `SidebarToggle` and its siblings do.
const closeButtonClasses = `${iconButton} shrink-0 cursor-pointer rounded-full`;

type ModalProps = {
  /**
   * The dialog's accessible name, announced when it opens.
   *
   * An explicit label rather than `aria-labelledby`, because the heading it would point at is
   * rendered by the body this component is handed, and an id agreed across that boundary is a
   * contract neither side can see. The body's own heading is the first thing read after the name.
   */
  label: string;
  /**
   * Where to go when the dialog is dismissed and there is no history entry to go back to.
   *
   * Normally unused: this component only mounts on a *soft* navigation — a hard load of the same
   * URL renders the full page instead, because an intercepting route does not intercept one — so
   * there is essentially always an entry behind it. The fallback exists because the alternative
   * to handling it is a close button that silently does nothing, which is worse than a redundant
   * branch.
   */
  returnHref: string;
  /** The dialog's body, server-rendered by the route that opened it. */
  children: ReactNode;
};

export function Modal({ label, returnHref, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  // The path this dialog was opened for. A `useState` initialiser runs on the first render only,
  // so this holds still while `pathname` moves on underneath a slot that was never re-rendered.
  const [openedPathname] = useState(pathname);
  const hasNavigatedAway = pathname !== openedPathname;

  // Opening is an effect because `showModal()` is imperative: the `open` attribute alone renders a
  // *non-modal* dialog — no top layer, no inertness, no focus trap, no backdrop — so the element
  // has to be opened in the DOM rather than declared open in JSX.
  //
  // Closing on navigate is the same effect rather than a second one, so the scroll lock is released
  // by the cleanup that already exists: whether the dialog goes away because this component
  // unmounted or because the route moved on, the page is handed back in exactly the state it was
  // found in, through one code path.
  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog === null) {
      return;
    }

    if (hasNavigatedAway) {
      // A no-op on an already-closed dialog, and it fires no `close` event in that case, so the
      // ordinary dismissal path cannot be reached twice.
      dialog.close();
      return;
    }

    dialog.showModal();

    // `showModal()` blocks interaction with the rest of the document but explicitly does **not**
    // stop it scrolling, and the usual `document.body { overflow: hidden }` answer does not apply
    // here: the portal shell is `h-dvh` and the thing that scrolls is `ShellProvider`'s content
    // column, not the document. So the lock finds the scroll container this dialog was rendered
    // into and holds it still, restoring exactly what it found on the way out.
    const scroller = scrollableAncestor(dialog);

    if (scroller === null) {
      return;
    }

    const previousOverflow = scroller.style.overflowY;
    const previousPadding = scroller.style.paddingRight;
    // Measured before the lock, while the scrollbar is still there. Hiding the overflow takes a
    // classic scrollbar away with it and the content underneath jumps sideways to fill the gap;
    // padding of the same width keeps every pixel of the dimmed page where it was. Zero on a
    // platform with overlay scrollbars, or when there was nothing to scroll.
    const scrollbarWidth = scroller.offsetWidth - scroller.clientWidth;

    scroller.style.overflowY = "hidden";
    scroller.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      scroller.style.overflowY = previousOverflow;
      scroller.style.paddingRight = previousPadding;
    };
  }, [hasNavigatedAway]);

  /**
   * The single exit. Escape, the close button and a backdrop click all end as the platform's own
   * `close` event, so there is one place that navigates and no way for the dialog and the URL to
   * disagree about whether it is open.
   *
   * Pressing the browser's back button instead unmounts this component without closing the
   * dialog, so no `close` fires and nothing here runs twice.
   */
  function handleClose() {
    // The one `close` the person did not ask for: the effect above closed the dialog because the
    // app had already navigated somewhere else. Going back from here would reverse that navigation
    // — the trap this branch exists to prevent — so this exit is silent.
    //
    // Reading `hasNavigatedAway` from the render that closed it is sound and not a race: React
    // commits this handler onto the element before running the effect that calls `close()`, and the
    // platform fires `close` as a queued task afterwards.
    if (hasNavigatedAway) {
      return;
    }

    // `history.length` counts this tab's whole session, so `> 1` is a "there is somewhere to go
    // back to" heuristic rather than a proof. It is the only signal the platform offers, and both
    // branches land on the board either way.
    if (window.history.length > 1) {
      router.back();
    } else {
      router.replace(returnHref);
    }
  }

  // A click on the backdrop is delivered to the dialog element itself — the backdrop is the
  // dialog's own pseudo-element, not a separate node — so target === currentTarget identifies it.
  // That holds only because the dialog carries no padding of its own; see `dialogClasses`.
  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) {
      event.currentTarget.close();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      onClose={handleClose}
      onClick={handleClick}
      className={dialogClasses}
    >
      <div className={headerClasses}>
        {/* Icon-only, so `aria-label` carries the whole meaning and `title` gives a mouse user the
            same word — the convention `SidebarToggle` sets. `close()` rather than navigating
            straight from here, so this path goes through `handleClose` like the other two. */}
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close"
          title="Close"
          className={closeButtonClasses}
        >
          <CloseGlyph />
        </button>
      </div>

      <div className={bodyClasses}>{children}</div>
    </dialog>
  );
}

/**
 * The nearest ancestor that scrolls, or `null` when nothing between here and the root does.
 *
 * Walked at open time rather than passed in: the scroll container belongs to the portal shell, and
 * a prop naming it would make every call site restate a fact about a layout three levels up.
 */
function scrollableAncestor(element: Element): HTMLElement | null {
  let parent = element.parentElement;

  while (parent !== null) {
    const { overflowY } = window.getComputedStyle(parent);

    if (overflowY === "auto" || overflowY === "scroll") {
      return parent;
    }

    parent = parent.parentElement;
  }

  return null;
}

// The cross, 20px, hand-authored on the precedent `DeleteAnnouncement.tsx` and
// `AttachmentPicker.tsx` set: the Material Symbols subset carries the shell's eleven nav glyphs
// and nothing else, so a borrowed codepoint renders as a tofu box behind a green build.
function CloseGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  );
}
