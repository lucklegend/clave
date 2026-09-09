# 0004 — Announcements and attachment uploads

**Date:** 2026-09-09
**Status:** Accepted
**Ticket:** `0010-announcement-board`

## Context

The announcement board is the first vertical slice that touches every layer of this repo at
once: a village-scoped table with RLS, the first Storage bucket and therefore the first
`storage.objects` policies, the first server action that writes rather than authenticates, and
the first TypeScript caller of `public.user_has_permission`. It shipped as
`supabase/migrations/20260909120000_announcements.sql`,
`packages/shared/src/schemas/announcements.ts`, and
`apps/web/src/features/announcements/{validation,server,actions,components}`.

The branch is **unreviewed**. Neither a code review nor a security review has run yet, and the
merge gate has not run either, so nothing here has been written to a test — there is still no
runner in the repo. This ADR records the reasoning the diff itself does not carry, not a claim
that the feature is finished.

## Decisions

### D1 — Scheduling is derived visibility, not a job

`public.announcement_status` is `('draft', 'published', 'archived')`. There is deliberately no
`scheduled` value. A row that is going out is `published` and carries a `publish_at`; the
`announcements_select` policy compares `publish_at <= now()` on every read, so "scheduled" is the
state where `status = 'published' and publish_at > now()` — never stored, always computed, and
computed in exactly one place (`apps/web/src/features/announcements/status.ts` on the TypeScript
side, the RLS policy on the database side, both reading the same two columns).

The alternative — a `scheduled` enum value flipped to `published` by a job at the appointed time —
was rejected before it was built. Nothing to run means nothing that can fail silently at 6am and
leave a post that never lands, and it works identically on a laptop with no scheduler running as
it will in production. It also removes a whole class of disagreement: a badge computed from a
cron's last-known state can say "scheduled" for a post residents can already see, if the two ever
drift. Here they cannot drift, because they are the same comparison read twice.

The trade is that "scheduled" has no row, no index entry, no admin console that filters WHERE
`status = 'scheduled'`. `announcements_village_publish_idx` is built on
`(village_id, publish_at desc nulls first, created_at desc)` precisely so the board's own listing
— drafts first, then everything else newest first — is an index scan rather than a sort, and the
same index serves both "show me what's scheduled" (filter client-side on the derived label) and
"show me what's live" (the RLS policy's own comparison) without a second column to keep in step.

### D2 — The page gates on `announcements.create`, not `announcements.read`

`apps/web/src/features/portal/nav/destinations.ts`'s Announcements entry requires
`announcements.create`. Every role — `owner`, `tenant`, `maintenance`, `guard`, `officer`,
`hoa_admin`, `super_admin` — holds `announcements.read`, because that key is the future resident
feed on mobile: it is what a phone will ask for when this ticket's counterpart on `apps/mobile`
reads the board. Gating the admin console on the same key would put a "compose an announcement"
page in every resident's sidebar drawer, next to Payments and Bookings, which is not what `read`
means to any of them.

`announcements.create` is held only by `super_admin`, `hoa_admin` and `officer` — the roles that
can actually see the button do anything. This is the first of the eleven drawer destinations whose
`requires` is not simply the matching `.read` key of the thing it leads to, and the comment left on
the entry says so, because `read` is the name that looks obviously right and would be the wrong
one to pick without having read the seed migration first.

The two capability keys keep answering two different questions the whole way down: the RLS
`announcements_select` policy grants a holder of `announcements.create` visibility into every row
in the village, drafts included — the board is their workspace — while everyone else, `read`-only,
sees a row only once `status = 'published' and publish_at <= now()`. The same divergence the page
gate uses is what the database enforces if the gate is ever bypassed.

### D3 — The first capability-keyed RLS policies in the schema

Every RLS policy shipped before this ticket gates through `public.is_village_admin`, which
resolves to `public.user_has_permission('users.manage', …)` under the hood — a single key,
reused everywhere a policy needed "is this person an admin here". The four `announcements` and
`announcement_attachments` policies are the first to ask for a specific capability directly:
`announcements.create`, `.update`, `.delete`, and `.read` folded into the select policy's
visibility branch. `is_village_admin`'s own doc comment already said this was coming — "not a
hardcoded role list" — and `CLAUDE.md`'s rule that a single guard at a mutation boundary asks
`user_has_permission` is exactly the shape these four policies take.

`announcement_attachments`'s own policies do not restate the rule. `announcement_attachments_select`
is `exists (select 1 from public.announcements a where a.id = announcement_id)` — a subquery that
runs under the caller's own RLS, so a file is visible exactly when its announcement is, including
the publish-time comparison, without a second copy of that comparison to keep in step by hand.

### D4 — `created_by` is nullable, `on delete set null`

`public.users` cascades from `auth.users`: deleting an account deletes the profile row with it.
A `not null` `created_by` on `announcements` would force one of two outcomes on that cascade —
either block the account deletion entirely, or let the cascade take the village's announcement
history down with the one person who happened to write it. Neither is acceptable for a board that
is meant to be the village's durable record of what it was told, so `created_by` is nullable and
`on delete set null`; the list falls back to "Removed account" for the small number of rows this
ever touches. Authorship is not weakened by this — `announcements_insert`'s `with check` pins
`created_by = (select auth.uid())` at write time, and `announcements_guard_created_by`, a trigger
copied from `users_guard_privileged_columns`'s shape, freezes it against every subsequent update,
because a `with check` on an `UPDATE` policy can see the new row but not `OLD`, so it can pin a
value on insert and cannot, by itself, stop that value being rewritten later.

### D5 — Attachments are a child table, not the `attachment_url` column `docs/TECH_STACK.md` sketched

The starting data model in `docs/TECH_STACK.md` carries a singular `attachment_url` on the
announcement row. The ticket asked for a set of files of mixed type per post, which a single
column cannot hold, and the alternative of a JSON array in that column would have carried the same
rows with none of a real table's guarantees: no `unique` on `storage_path`, no foreign key tying an
attachment to its parent's village, nothing a NOT NULL or a CHECK could say about a byte size or a
checksum. `announcement_attachments` is that table, with a composite foreign key,
`(announcement_id, village_id) references announcements(id, village_id)`, so a child row cannot
claim a different village from its parent even if something upstream of the constraint got it
wrong — verified directly (`verify-rls.sql`, block 10): attempting exactly that insert raises the
constraint violation rather than silently mismatching a tenant.

### D6 — Private bucket, short-lived signed URLs, never inline

`storage.buckets` for `announcement-attachments` is inserted with `public = false`, and that is
never negotiable in this schema — a public bucket serves every object to anyone who can guess or
is handed the URL, with no session and no RLS policy in the path at all, which for a multi-tenant
product is a tenancy breach wearing a friendly interface. Every read goes through
`createAttachmentDownloadUrl`, minting a `createSignedUrl(path, 60, { download: fileName })`
token — sixty seconds, per request, never cached. The `download` option is what makes this a
download rather than a view: Storage answers with `Content-Disposition: attachment;
filename="…"`, so a browser saves the file to disk rather than rendering it in the app's own
origin. No attachment is ever served inline, which closes off a stored file (an SVG snuck past the
allowlist, say, or a polyglot PDF) rendering as content inside ClaveHQ's own security context.

Both halves of this were driven against the running stack rather than reasoned about: a token
re-fetched after its sixty seconds expired with `"exp" claim timestamp check failed`, and a signed
URL minted with one tenant's real session against another tenant's object returned `404 Object
not found` — Storage's own RLS on `storage.objects` hides the object from a caller outside its
village entirely, which is why the refusal reads as "not found" rather than "forbidden".

### D7 — The upload pipeline's ordering, and why the acceptance test is the refusals

`prepareAttachments` runs the cheap, pure checks (`validation/magic-bytes.ts`,
`validation/office-zip.ts`, count and size) over the **whole set** before any expensive step —
image transcode, virus scan — runs over **any** file in it. A set of five where the second file is
an `.exe` should not cost four image decodes and four network round trips to a scanner it was
always going to fail. Nothing is written to the database until every file in the set has passed
every check; the whole set is refused together, and every refusal is reported at once, so a
person fixes their attachments in one pass rather than resubmitting five times to discover five
separate problems one at a time.

Order of the write itself: the action inserts the announcement row and its attachment rows first,
then uploads bytes. That ordering is what lets `announcement_attachments_object_select` be
written as "the row exists and is visible" rather than duplicating the tenancy rule inside
`storage.objects` — but it means an upload can fail after the rows already exist, so
`prepareAttachments`'s caller compensates: an upload failure deletes the attachment rows and, for
a call that created the announcement itself (never for an edit — reverting an edit would need a
snapshot this pipeline does not keep, and deleting an announcement outright over a failed
attachment on an edit would turn a partial failure into a lost notice), the announcement row too.
No attachment row is ever left pointing at an object that does not exist.

The plan named the acceptance test correctly before any of this was built: **the rejections, not
the happy path.** An allowed file of every type uploading successfully proves little on its own;
what the works-check spent most of its time on, and what this decision is really about, is an
`.exe` renamed `.pdf` refused by magic bytes, a `.docm` renamed `.docx` and a genuinely
macro-bearing `.xlsx` both refused by the OOXML deep inspection, an `.svg` refused for not being
on the allowlist at all, oversized and over-count sets refused with a named file, and the EICAR
test string refused by the scanner. Every one of those was driven against the real pipeline, not
asserted.

### D8 — Antivirus fails closed, and the local-only flag is enforced rather than merely documented

`scanFile`'s default implementation posts each file to `ANTIVIRUS_SCAN_URL`, a `clamav-rest`
container defined in the new root `docker-compose.yml`. **This is infrastructure the project does
not yet have anywhere but a developer's own machine** — a service that has to run, and be paid
for, in whatever production actually looks like, and nothing about this ticket stands that up
anywhere but locally.

If the variable is unset, every attachment is refused — not accepted, not accepted-with-a-warning.
An antivirus integration that passes files while the scanner is unreachable is worse than no
integration at all, because it is believed. `ALLOW_UNSCANNED_UPLOADS=1` is the only escape from
that refusal, documented in `apps/web/.env.example` as local-development-only, and that
restriction is not left to documentation alone: `scan.ts` checks `NODE_ENV === "production"` and
ignores the flag outright when it is, so "local-only" is a property of the running code, not a
promise about how it will be deployed. Verified against the running stack in both directions —
with `ANTIVIRUS_SCAN_URL` unset and no flag, a perfectly valid PDF was refused; with the flag set
under a production build, the same file was refused again, `scanner-not-configured` in the log
either way.

### D9 — HEIC: `sharp` cannot decode it here; `libheif-js` is the complement, not the superset

The plan flagged HEIC as the riskiest dependency and asked for it to be proved before the rest of
the pipeline was built. `heic-probe.md`'s first pass established that this repo's `sharp` build
reports `heif: 1.23.2` and `aom: 3.14.1` with no `libde265` — libheif with an AV1 decoder and no
HEVC decoder, which handles AVIF-in-HEIF and nothing an iPhone actually writes, since a phone
writes HEVC-encoded HEIC.

That first pass reasoned that `libheif-js`, a WASM build of libheif shipped as an npm package,
must therefore be a **superset** of what `sharp` has — more codecs, including the HEVC one that
was missing. **That reasoning was wrong, and the correction matters as much as the conclusion.**
Scanning the WASM `libheif-js` actually ships shows `libde265` (HEVC) present and `aom`/`dav1d`
(AV1) absent — the exact mirror image of `sharp`'s codec table, not a strict superset of it. Proof
by round trip: a `sharp`-encoded AVIF-in-HEIF handed to `libheif-js` fails with "Support for this
compression format has not been built in," the same failure `sharp` gives on HEVC, just for the
other format. The two libraries are **complements** — between them they cover both codecs, and
neither covers both alone.

The path that ships: HEIC decodes through `libheif-js` (its own WASM bundle, decoders compiled in,
which is the entire reason the package exists — decoding phone photos a system libheif will not),
and the decoded RGBA is handed to `sharp` for the JPEG encode that every other image format also
goes through. Every image, whichever way it arrived, ends at the same `sharp` encode, so the
metadata-stripping and polyglot-killing guarantee is identical regardless of source format. The
stored `file_name` is renamed to `.jpg` to match — a download served as
`Content-Disposition: attachment; filename="photo.heic"` for bytes that are actually a JPEG would
save a file nothing opens.

The decode path was exercised, not merely shown to exist: Nokia's `heif_conformance` corpus
provided four real HEVC-encoded HEIF files, and all four were taken end to end through
`prepareAttachments` inside a `next build`/`next start` production build — confirming the dynamic
`import("libheif-js/wasm-bundle.js")` bundles and runs under Turbopack with no
`serverExternalPackages` entry needed. **What remains unproven is a photograph taken on an actual
iPhone.** The works-check tried to close that gap and could not: no genuine iPhone `.heic` file
was available in either session, and a browser sandbox with no OS-level `.heic` MIME association
reports an empty `File.type`, which the pipeline's own MIME-agreement check correctly refuses
before the HEIC decode path is ever reached — a sandbox limitation, not a pipeline regression, and
not a re-confirmation either. HEIC support rests on conformance-file evidence and the codec-level
reasoning above, not on a green test against a real phone photo; see Consequences below.

### D10 — Two Next.js findings worth their own record, because the next feature that uploads anything will hit them again

**`proxyClientMaxBodySize` truncates silently, and the truncation crashes the action rather than
producing a message.** `apps/web/src/proxy.ts` runs as Next middleware in front of every
`(portal)` route, and Next clones the request body for any route a proxy runs on
(`getCloneableBody`), capped by `experimental.proxyClientMaxBodySize` — a default of 10 MiB that
has nothing to do with `experimental.serverActions.bodySizeLimit`, the number this repo had
already raised for the action handler itself. Crossing the clone cap does not refuse the request;
it truncates the stream and logs a warning. The truncated multipart body then reaches the action
at exactly the clone's cap, which is not _over_ `bodySizeLimit`, so the action's own byte-counting
guard never fires, and busboy hits a torn envelope with no closing boundary:
`Error: Unexpected end of form`, an unhandled exception, and the portal's generic error boundary
instead of the pipeline's own "this file is too large" message — for a single file over roughly
10 MB, a threshold **inside** the feature's own advertised 10 MB-per-file / 25 MB-total caps. The
fix is `experimental.proxyClientMaxBodySize: "64mb"` against `experimental.serverActions.bodySizeLimit:
"56mb"` in `apps/web/next.config.ts`, with the relationship written into the file as a comment
rather than left for the numbers to imply: **the proxy cap must be strictly greater than the
action cap**, because equal still lands a truncated body exactly on the boundary rather than
over it, which is the same bug again. 56 MiB is derived from `5 × 10 MiB` — the pipeline's own
per-file cap times its own file count — with headroom above it for the 64 MiB proxy figure to sit
strictly higher than. `apps/web/src/proxy.ts` itself needed no functional change; the fix is
config-only, and the nine lines added to that file are comments explaining why the fix belongs in
`next.config.ts` and not in the matcher.

**A bare `name` inside a `storage.objects` policy subquery silently binds to the wrong table's
column.** `announcement_attachments_object_insert` and `_object_delete` both need to read the
uploaded object's own path to find its village, via `(storage.foldername(name))[1]`. Written that
way, with an unqualified `name`, the subquery's `from public.villages v` puts a second `name`
column in scope — `villages.name` — and Postgres resolves the inner reference to the nearer one
silently, no warning, no error. `\d+` on the applied policy confirms it stored
`storage.foldername(v.name)`. A village's own id compared against a folder segment of the
village's own _name_ never matches anything, so both policies refused every upload and every
delete, while reading, in the source, as though they should work — the exact shape of trap
`docs/decisions/0002`'s D1 already named for function grants: a security rule that looks correct
and was never exercised against a real request. It was caught only because the working policy sat
right beside it: `announcement_attachments_object_select` was written `storage.objects.name` from
the start and was never affected, which made the asymmetry between "reads work, writes refuse
everything" the signal that led to it. The fix is qualifying both occurrences as
`storage.foldername(storage.objects.name)`, and the migration's own comment now says the column
must stay qualified and why, so the next policy written against this bucket does not reintroduce
it by habit.

## Consequences and open questions

- **No download link on the board table itself.** The Files column is fixed at 30px by design —
  drawing a signed-URL link for every attachment of every row on every render would mint a
  sixty-second credential nobody asked for, for every row the table shows. The board's title links
  to the edit page instead, and that page is where the download links, and the delete and remove
  controls, actually live.
- **`notFound()` returns HTTP 200.** The portal shell streams its layout before the page component
  resolves, so a caller who lacks `announcements.create` gets a response that reads as a normal
  200 at the network layer and renders the not-found body — correct in substance (no page content,
  no form, no data leaks into the markup) but not the status code an automated check would expect.
  This is a shell-level property from ticket 0009, not something this ticket introduced or fixed.
- **A request body above 56 MB still reaches the portal's generic error boundary**, not a form
  message. D10 moved the crash threshold from 10 MB — inside the feature's own caps, so an
  ordinary five-file upload could trigger it — to 56 MB, outside anything a legitimate use of the
  form produces. It did not remove the class: the attachment picker's own client-side count/size
  checks are convenience only, `AnnouncementForm` submits regardless of what they say, and nothing
  currently stops a deliberately oversized POST from reaching the 413 boundary rather than a named
  refusal.
- **The set-level cap message can render twice.** `AttachmentPicker`'s own convenience check on
  the total byte count and the server's own `attachmentErrors` entry (with a `null` filename) both
  fire for the same over-25-MB set, so "All the files together must be 25 MB or smaller." appears
  twice in the form. Cosmetic, reproduced consistently, not fixed here.
- **HEVC HEIC is proved against Nokia's `heif_conformance` corpus, not a real phone photograph.**
  See D9. The codec-level risk is closed; the remaining risk is in the ancillary boxes a real
  iPhone writes (orientation transforms, auxiliary depth/alpha images) that a conformance file
  does not exercise the same way.
- **There is still no test runner in this repo.** `apps/web/src/features/announcements/validation/
magic-bytes.ts`, `validation/office-zip.ts`, and `status.ts` are pure, security-bearing functions
  with no I/O, and are the strongest candidates yet for installing Vitest — everything above about
  their behaviour was exercised with throwaway scripts against the running stack and then deleted,
  not asserted by a suite that stays in the tree.
- **Neither a code review nor a security review has run on this branch.** The RLS policies named
  in D3, the storage policies named in D6 and D10, and the whole upload pipeline in D7/D8/D9 are
  exactly the surfaces the ticket itself flagged as security-sensitive and requiring review before
  merge; that review has not happened yet.

## Alternative considered

A `pg_cron`-driven job that flips a row from a stored `scheduled` status to `published` at its
appointed time was the natural alternative to D1, and the shape most schemas reach for first.
Rejected for the reasons D1 gives: a cron is one more thing that can fail silently in a window
nobody is watching, it needs an equivalent running on every environment including a local stack
that has no scheduler, and a status column updated by a job can disagree with what the RLS policy
actually shows a resident if the two are ever out of step — which a purely derived comparison
cannot do, because there is only one comparison, read by both sides.

The `attachment_url` column `docs/TECH_STACK.md` originally sketched, or a JSON array in its
place, was the alternative to D5's child table. Rejected because neither can carry a foreign key
tying a file to its parent's village, a uniqueness constraint on the storage path, or a CHECK on
byte size or checksum format — the file's provenance would rest entirely on the application
remembering to enforce what a real table enforces for free.
