# 0010 — Announcement board

**Filed:** 2026-09-09
**Stage:** in_progress — planned and approved at the gate before any code was written.

## What was asked

> on the [M3 canvas] lets create a page for announcement. this is for admin-role only so we
> should add permission if the user login they will not be able to see this on sidebar nor
> cannot view this page. let have a data table view/dashboard for announcement using the
> URL/route /announcements lets also have a form where as we can have title description and
> attachedment where we can upload docs like pdf, docx, xlsx, pptx, image(jpeg, png, .heic)
> also in uploading create a security features. we should also have draft type of post where
> it will not be submitted totally. we can also have schedule announcement where it will be
> posted on this date. On the form we also save the creator so that we can know who posted it.

## Why this one is the interesting one

It is the first vertical slice that touches every layer at once: a village-scoped table with
RLS, the repo's **first Storage bucket** and therefore its first `storage.objects` policies,
the first server action that writes rather than authenticates, the first TypeScript caller of
`public.user_has_permission`, and the first of the eleven drawer destinations to stop being
`aria-disabled`.

`docs/HANDOFF.md` has named it the next milestone since 0003, four session entries running.

## Decisions taken at the gate

1. **Design on the canvas first**, sign-off, then build. Precedent: ticket 0009.
2. **The page gates on `announcements.create`, not `announcements.read`.** This is the
   non-obvious one and it is a trap worth naming. The drawer row has been declared since 0007
   with `requires: "announcements.read"` — and
   `supabase/migrations/20260906120100_seed_roles_and_permissions.sql` grants
   `announcements.read` to **every** role, `owner` and `tenant` and `maintenance` and `guard`
   included, because that key is the future resident feed on mobile. Shipping the page behind
   `read` would put an admin console in every resident's sidebar. `create` is held by
   `super_admin`, `hoa_admin` and `officer` only. No catalogue change: all four
   `announcements.*` keys already exist and are already granted.
3. **Scheduling is derived visibility, not a job.** A row is `published` with a `publish_at`,
   and it is live once that instant passes — evaluated in the RLS policy itself. There is no
   `scheduled` enum value, no `pg_cron`, no edge function. Nothing to run means nothing that
   can fail silently and leave a post that never lands, and it works on a local stack where a
   cron would not.
4. **Upload security: the full set** — private bucket and signed URLs, storage RLS, magic-byte
   sniffing, MIME/extension agreement, size and count caps, UUID object names, Office
   deep inspection (macro parts, zip-slip, zip bombs), image re-encode with EXIF stripped, and
   virus scanning.

## Security-sensitive steps

Every one of these gets a security review before merge:

- The RLS policies on `announcements` and `announcement_attachments` — the **first
  capability-keyed policies in the schema**. Everything to date gates on `is_village_admin`,
  which resolves through `users.manage`. These ask the announcement keys directly.
- The `storage.objects` policies. `docs/decisions/0002` records what happens when a grant is
  reasoned about rather than tested: four helpers were revoked from `anon` but not from
  `PUBLIC`, and answered unauthenticated on `main` for two days. Test these against the
  running stack with a real anon key, do not reason about them.
- The whole attachment pipeline. The acceptance test is the **rejections**, not the happy path.

## What planning must not skip

- **A village-scoped table gets its RLS policy in the migration that creates it** (`CLAUDE.md`).
  The bucket and its policies ride in the same file for the same reason.
- **No second service-role reader.** `CLAUDE.md` names
  `apps/web/src/features/auth/server/resolve-identifier.ts` as the only one and says widening
  that blast radius is a decision to raise, not a convenience. Nothing here needs it: the
  writer is the caller, and the caller has a session.
- **Every route under `(portal)` stays dynamic.** No `"use cache"`, no `revalidate` — village
  scope is server-resolved per request and a cache key that does not name the tenant is a
  cross-tenant leak RLS never sees (`docs/decisions/0002` D3).
- **The icon font is subset.** 0009's postmortem: a codepoint that is not in the woff2 renders
  as tofu, with a green build and a passing checker. attach-file, schedule and delete are all
  new.
- **`secondary-container` / `on-secondary-container` has 0.04 of contrast headroom.** No state
  layer on that pair. A data table with hoverable rows on a tonal fill walks straight into it,
  as ticket 0006 also flags.

## The plan

`.agent-work/0010-announcement-board/plan.md`, approved 2026-09-09.

## The design

Two artboards on the M3 canvas, `https://claude.ai/code/artifact/68df7d4c-e1b4-45dc-9054-99b13047d010`:

- **Announcements — board** — the table (Announcement / Status / Files / Posted by / Publishes),
  the status segmented filter, and the empty state drawn rather than described, because the
  empty state is what actually ships on day one.
- **Announcements — compose** — title, description, the attachment dropzone with a **refused**
  file drawn in place, the three-way when-it-goes-out control, and the creator line. The aside
  documents what happens to a file after it is dropped, since none of it is visible and all of
  it matters.

Both were assembled from `.agent-work/0009-collapsible-sidebar-sticky-bar/reference-Main.dc.html`
by script (`.agent-work/0010-announcement-board/design/assemble.mjs`) rather than retyped, so
the shell in the design is byte-identical to the shell in the code. That is a direct response to
0009's closing note: `Payments.dc.html` still carries the pre-0009 shell, and the design and the
code have silently differed on that artboard ever since.
