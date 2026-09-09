# 0005 — The dialog primitive

**Date:** 2026-09-09
**Status:** Accepted
**Ticket:** `0011-announcement-view-modal`

## Context

Until this ticket the repository had no dialog, and that was not an oversight — it was a
decision, taken three times, in writing:

> "a full page rather than a dialog, because this repo has no dialog, no focus trap and no date
> picker, and inventing three of them inside a feature ticket is how a feature ticket becomes a
> component-library ticket." — `app/(portal)/announcements/new/page.tsx`

> "**The confirmation is a `<details>` and not a dialog.** This repository has no Dialog, no
> focus trap and no overlay, and a feature ticket that invents all three has become a
> component-library ticket." — `components/DeleteAnnouncement.tsx`

> "Opening the disclosure is the confirmation step — there is no Dialog in this repository and
> this ticket is not the one to invent one." — `components/AttachmentList.tsx`

Ticket 0011 is the one that is. Reading an announcement is the most common thing anyone does
on the board, and routing it through the editing form was making the common case pay for the
rare one. A modal is the right shape for it, so the debt those three comments deferred comes
due here — deliberately, in a ticket whose own feature is small enough that the primitive is
the interesting part.

What existed to build on: no `<dialog>`, no `role="dialog"`, no `aria-modal`, no
`createPortal`, no focus trap, no `Escape` handler, no `inert`, and **no z-index scale**. Three
literal `z-10`s, one of which carries the only recorded reasoning about stacking in the
codebase.

## Decisions

### D1 — The native `<dialog>` element, opened with `showModal()`

Not a positioned `<div>` with a hand-rolled focus trap. `showModal()` gives focus containment,
`Escape`, the top layer, `::backdrop` and inertness of everything behind it — five things this
repository would otherwise have had to write, test and maintain, of which the focus trap alone
is a well-known source of subtle bugs.

The cost is that the element's behaviour is the platform's rather than ours, which is exactly
the trade wanted for a primitive nobody wants to think about again.

### D2 — The top layer is why this ticket adds no z-index scale

`ShellProvider`'s content column is `overflow-y-auto` and `StickyBar` holds `z-10`. A modal
rendered inside that column would be clipped by the first and would fight the second, and the
ordinary answer — invent a z-index scale, put the dialog at the top of it — would have made
this ticket the owner of a stacking policy for the whole app.

`showModal()` promotes the element to the browser's top layer, which is above every stacking
context on the page by definition. So the repository still has no z-index scale, and the next
ticket that genuinely needs one gets to decide it on its own merits.

### D3 — The body is server-rendered and passes through as `children`

The same seam ticket 0009 established for the portal shell (`ShellProvider`, `DrawerFrame`,
`StickyBar`), for the same reason: `Modal` is a `"use client"` leaf that owns open/close
mechanics and nothing else. The announcement, its attachments and the viewer's permission set
are rendered on the server and arrive as payload. Nothing about who may see what crosses into
the browser bundle.

### D4 — The URL is the state, through a parallel + intercepting route

`@modal/(.)[id]` renders the modal over the board on a client navigation; `[id]/page.tsx`
renders the same view as a full page on a hard load. Both call one component, so the two cannot
drift.

This buys three things a client-side boolean could not: the back button closes the modal
because closing _is_ a navigation; an open announcement can be linked, bookmarked and pasted to
a colleague; and the content stays server-rendered, which is what makes D3 possible.

**Each route gates independently.** An intercepted route is a route: it inherits none of the
board's checks and repeats `loadAuthzContext()` + `can(permissions, "announcements.create")` in
full.

### D5 — Dismissed by the user and navigated away from are different, and conflating them was a bug

Dismissing the modal navigates back, so the URL and the dialog cannot disagree. But Next's
`@modal` slot **keeps the same DOM node across a soft navigation to a sibling route it does not
intercept** — `Modal` never unmounts, its cleanup never runs, and `@modal/default.tsx` is never
consulted, because that file answers a hard load where there is no slot state to reuse.

Proved by DOM identity rather than inferred: a `data-marker` set on the open dialog was still
on the node after navigating to `/edit`.

What that produced was a trap. Clicking **Edit** left the edit form rendered _underneath_ an
open dialog that intercepted every pointer event, and dismissing that dialog called
`router.back()` — carrying the person away from the page they had deliberately gone to, back to
the one they were trying to leave. Every route out was closed.

So `Modal` records the path it was opened for and compares it with the current one. A mismatch
closes the dialog and does **not** navigate; a genuine dismissal still goes back. The close-on-
navigate branch lives in the same effect as the scroll lock rather than a new one, so the lock
is released by the cleanup that already existed and "restored exactly as found" holds by
construction rather than by a second implementation that has to agree with the first.

This is general, not a patch for one button: it was verified with a navigation-drawer link as
well as with Edit. The hard-navigation alternative — making Edit an `<a href>` — was declined
for that reason; it would have fixed one call site and hidden the problem from whoever adds the
next link to a modal body.

### D6 — A closed dialog must be told to disappear, because Tailwind's `flex` outranks the UA rule

`dialogClasses` carries `flex`, which sets `display` and therefore beats
`dialog:not([open]) { display: none }` in the user-agent stylesheet.

This was harmless for as long as the dialog only ever existed while open — it unmounted on the
way out. The moment D5 let it stay mounted and closed, a closed dialog sat in the layout as an
ordinary box and went on swallowing clicks: the _first_ fix appeared not to work, for a
completely different reason than the bug it fixed. `not-open:hidden` restores the intent.

Worth stating because the general shape recurs: a utility class that sets a property the UA
stylesheet uses for behaviour is a silent override, and it only shows up in the state the
component did not previously have.

### D7 — The entrance is `@starting-style`, not an animation

`globals.css` kills every `transition` and `animation` with `!important` under
`prefers-reduced-motion: reduce`. A modal whose _appearance_ was produced by a keyframe
animation would therefore never appear at all for those users — a component that works for
everyone except the people who asked for less motion.

With `@starting-style` the settled state is the visible one and the transition is the only
thing the blanket can remove. Verified by emulating the preference: `transition-property`
computes to `none` and the dialog is present at full opacity.

### D8 — The scroll lock is applied to the shell's column, not to `<body>`

`showModal()` does not stop the page behind from scrolling, and the usual `body { overflow:
hidden }` answer does not apply here: the shell is `h-dvh` and the real scroller is
`ShellProvider`'s content column. `Modal` walks to the nearest scrolling ancestor, locks it,
and compensates with a `padding-right` equal to the scrollbar it just removed so the dimmed
board does not jump sideways. Both are restored exactly on unmount.

## Consequences and open questions

- **`Modal` closes on any pathname change**, so a link from one intercepted modal route to
  another would close rather than swap. No such link exists — the only links in the body are the
  file routes, the editor and the board — and the fix when one is added is to key the `Modal` by
  id. That belongs to the ticket that adds the link.
- **`notFound()` from inside the modal or the view returns HTTP 200** with the not-found body,
  because `announcements/loading.tsx` puts a Suspense boundary above the page and the shell
  flushes before the read resolves. **Pre-existing from ticket 0010** and unchanged here; the
  body carries no announcement data. Fixing the status code means moving the read above the
  boundary or dropping the boundary, and wants its own ticket.
- **M3's compact full-screen dialog variant is not implemented.** It is a different anatomy — a
  top app bar, square corners, edge to edge — and building it unprompted would have been a second
  component. The basic dialog at 560dp is what exists, which is also the width M3 specifies.
- **The backdrop's `color-mix` fallback is opaque.** Tailwind synthesises the pre-`color-mix`
  fallback from the first colour argument, so an engine without `color-mix` paints
  `--md-scrim` — black — at full strength rather than at 32%. Correct-by-accident for a scrim,
  and the same trap `features/brand/cta.ts` documents at length for state layers.
- The dialog is now the repository's only overlay primitive. The three comments quoted at the
  top are stale in their claim that none exists, and the next ticket to touch those files should
  say so.

## Alternative considered

**A client-side dialog holding its own open state, with no URL.** Rejected on three counts: an
announcement could not be linked or bookmarked; the back button would leave the board entirely
rather than close the modal; and the attachment data for every row would have to be either
serialised into the page up front or fetched on open — the first putting every row's contents
into the browser bundle, the second adding a loading state to a thing that should feel
instantaneous.

**A hand-rolled overlay with a focus trap**, on the grounds that `<dialog>` support is uneven.
It is not, in any browser this product targets, and writing a focus trap to avoid a platform
feature that already implements one correctly is how a component-library ticket starts.
