# 0011 — View an announcement in a modal

**Filed:** 2026-09-09
**Stage:** in_progress — planned and approved at the gate before any code was written.
**Branch:** `feat/0011-announcement-view-modal`, off `feat/0010-announcement-board`.

## What was asked

> lets create a modal or pop up card regarding on viewing the announcment rather than open a
> new url /edit. let plan it out.. if there is an attachment, if image lets show it.. and have
> it a overlay donwload icon and if documents file like, pdf, docs.. only show the list and
> have it download button overlay on the top right.. and we can have also download all where as
> ziping all attached files in one go.

And, on the edit page:

> make sure also to show other attached files do not remove them as it looks like bug when i
> check.

## Decisions taken at the gate

1. **The modal is read-only** — for reading a post and downloading its files. `/edit` stays
   exactly as it is, reached by a button in the modal.
2. **The modal has its own URL**, `/announcements/[id]`, via a parallel + intercepting route.
   Back closes it; a pasted link opens the same view as a full page.
3. **Download-all is a streamed server route**, so it is an ordinary download link needing no
   client JavaScript.

## The reported "bug" — checked, and the data was never at risk

`saveAnnouncementAction`'s update path **appends** attachments and never deletes existing rows.
Nothing was being lost.

What produced the impression is a layout order: the attachment picker starts **empty**, inside
the form near the top, while the files already attached are drawn by `AttachmentList` in a
separate section **below the submit button**. Editing a post with three files therefore shows
an empty dropzone first, which reads as "my attachments are gone, and saving will finish the
job." The fix is presentational — put the kept files above the picker — and touches no action.

## Why this ticket is larger than "add a dialog"

**It is the repository's first dialog, and that was a deliberate deferral.** Three separate
comments decline to build one, in `announcements/new/page.tsx`, `DeleteAnnouncement.tsx` and
`AttachmentList.tsx` — all on the grounds that "a feature ticket that invents all three has
become a component-library ticket". There is no `<dialog>`, no `role="dialog"`, no focus trap,
no `createPortal`, no `Escape` handler and **no z-index scale** anywhere in `apps/web/src`.
This ticket pays that debt.

**It reverses ADR 0004 D6, which this project wrote three days ago.** That decision reads:

> No attachment is ever served inline, which closes off a stored file (an SVG snuck past the
> allowlist, say, or a polyglot PDF) rendering as content inside ClaveHQ's own security
> context.

An image preview is exactly inline serving. The ADR is **amended, not worked around**, and the
exposure narrowed rather than dropped: SVG is excluded from `ATTACHMENT_TYPES` by name, HEIC is
transcoded to JPEG on upload, and magic bytes are verified server-side — so `image/jpeg` and
`image/png` are the only image types that can ever be stored, and inline serving is restricted
to exactly those two, enforced server-side against the stored row.

## Security-sensitive steps

- **The three file routes.** Each mints a signed URL at click time after checking the session
  and `announcements.create`, and resolves the attachment through `fetchAnnouncementById` so
  **RLS decides visibility** — the id in the path is never trusted.
- **The `?inline=1` guard.** Refusing anything but the two raster MIME types is the whole of
  the D6 amendment and lives in one place.
- **The intercepted route is a route.** It inherits none of the board's checks and must gate
  on `announcements.create` itself.

## The stale-link problem, and why no signed URL appears in the HTML

Signed URLs live 60 seconds and are minted at render, so a modal left open for two minutes
would show broken images and dead links. Lengthening the TTL is the wrong fix — on a signed URL
the TTL _is_ the access control. Instead the page carries only same-origin links, and the route
behind each one mints a fresh signed URL when it is clicked.

Beyond never going stale, that means no credential is written into a page that could be cached,
screenshotted or pasted, and there is exactly one authorization point per file.

## The plan

`.agent-work/0011-announcement-view-modal/plan.md`, approved 2026-09-09.

---

## Delivered — 2026-09-09

Reading an announcement is a modal. `/edit` is untouched.

### Decisions the diff does not explain

- **The dialog is a native `<dialog>` with `showModal()`.** That is what makes the top layer,
  focus containment, `Escape` and `::backdrop` free, and it is why this ticket adds **no
  z-index scale** — the usual reason a modal forces one. `docs/decisions/0005-the-dialog-primitive.md`.
- **No signed URL appears in any page.** Three same-origin routes stand in front of Storage
  and mint one at click time. That is what makes a modal left open past the sixty-second TTL
  still work, and it means no credential is ever written into HTML that could be cached or
  screenshotted. Verified by actually waiting three minutes.
- **The zip streams.** `fflate`'s `Zip` + `ZipPassThrough` — stored, not deflated, because
  JPEG, PNG, PDF and OOXML are already compressed. Proved by a fixture whose second entry
  pointed at a missing object: the response returned 200, delivered the whole first entry, then
  cut the connection, which a buffered build could not have done.
- **ADR 0004 D6 was amended rather than contradicted.** Inline serving is restricted to
  `image/jpeg` and `image/png`, decided server-side against the stored row. The strongest part
  of the argument is one neither the plan nor the ticket led with: every image was re-encoded
  through `sharp` on upload, so the bytes served inline are bytes this system wrote.

### What the ticket did not anticipate

**Two bugs, both found by testing and neither findable by reading.**

Next's `@modal` slot keeps the **same DOM node** across a soft navigation to a sibling route it
does not intercept — proved by tagging the element and finding the tag still there afterwards.
So the modal stayed open over `/edit`, intercepting every click, while dismissing it navigated
back off the page the person had deliberately gone to. Every route out was closed.

And once that was fixed the form was **still** unclickable, for an unrelated reason: Tailwind's
`flex` in the dialog's class string outranks `dialog:not([open]) { display: none }` in the UA
stylesheet. Harmless while the dialog only ever existed open; the moment it could stay mounted
and closed it sat in the layout swallowing clicks. `not-open:hidden` restores the intent.

The general lesson, recorded in ADR 0005 D6: a utility class that sets a property the UA
stylesheet uses for _behaviour_ is a silent override, and it only surfaces in a state the
component did not previously have.

### The reported "bug" that was not one

`saveAnnouncementAction` appends attachments and has never deleted an existing row — checked
before anything was changed. What produced the impression was ordering: an empty dropzone at
the top of a post with three files, its actual files drawn below the submit button. The files
now sit above the picker and the copy says they are kept. **A layout that makes a correct
system look broken costs the same as a broken one until somebody checks.**

### Also fixed

- `BoardTable` hand-wrote `` `/announcements/${id}/edit` `` while `edit-url.ts` sat unused
  beside it. One route in two places is how the board would have kept pointing at the editor;
  there is now an `announcementHref(id)`.
- `PORTAL_PAGE_PATTERNS` titles the full-page view. The new pattern must stay **after** the
  edit pattern — first match wins, and `[^/]+` would otherwise swallow `/edit`.
- `docker-compose.yml`'s ClamAV healthcheck invoked `curl`, which that image does not ship. It
  had failed 587 consecutive times against a scanner that was working perfectly. Now
  `clamdscan --ping`.
- The three "there is no Dialog in this repository" comments are corrected — but each declined a
  dialog for _two_ reasons, and only the first expired, so they now say the conclusion stands on
  its own merits.

### Verification

Works-check round 1 returned **DOES NOT WORK** on the Edit-from-modal trap; round 2 returned
**WORKS** after the fix, and confirmed the fix is general by driving a _second_, unrelated soft
navigation (`/edit` → `/dashboard` via the drawer) rather than only the button that was
reported. Both rounds in `.agent-work/0011-announcement-view-modal/works.md`.

All seven gates green; all seven announcement routes report `ƒ`.

### Not done

**The merge gate did not run** — the repo still has no test runner, and `isImageFormat` plus the
zip-name slug are the newest additions to the list of pure functions that deserve one.

**Neither review ran. The branch is unreviewed.**
