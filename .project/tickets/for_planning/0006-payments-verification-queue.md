# 0006 — Payments verification queue

**Filed:** 2026-09-08
**Stage:** for_planning
**Source:** deliberately deferred by ticket 0004. The M3 canvas includes a `Payments.dc.html`
artboard for this screen; 0004's plan treated it as a follow-up rather than bundling a new route
into a theme adoption, and the ticket's own "Proposed split" said so.

## What it is

The admin-facing queue for verifying payments. Per `CLAUDE.md` and `docs/PROJECT_PROPOSAL.md`,
payments in the MVP are **receipt screenshots uploaded to Storage and verified by an admin by hand**
— there is no payment gateway wired up, and PayMongo is Phase 2. So this screen is the whole
payment-verification mechanism for the MVP, not a convenience on top of an automated flow.

## Where the design already exists

The canvas artboard is in a session scratchpad that may no longer exist:
`…\15ccbded-5c24-4d80-a909-65bc81501cab\scratchpad\canvas-m3\Payments.dc.html`. **Do not depend on
it.** Ticket 0004's design review recorded the numbers it used and found them internally consistent:
₱184,200 of ₱245,600, a ₱61,400 shortfall, 75% against 68% prior, with receipt/booking/report counts
and resident/unit pairings agreeing across artboards. Those are mock figures for layout, not data.

The M3 design system this screen needs is now **in code** — `apps/web/src/app/globals.css`, the
button vocabulary in `cta.ts`, and `docs/decisions/0001-material-3.md`. Build against those rather
than re-deriving anything from the canvas.

## What planning must not skip

- **`payments` does not exist yet.** `docs/HANDOFF.md`'s build order lists it under "still to
  build", alongside `units`. This ticket needs a migration, and per `CLAUDE.md` a village-scoped
  table gets its RLS policy **in the same migration that creates it**.
- **Capability, not role.** Verification is gated on the `payments.verify` permission, asked via
  `public.user_has_permission(permission, village, user)`. Never assemble the joins at the call site.
- **Receipts live in Supabase Storage**, so the Storage bucket needs its own access policy — RLS on
  the table does not cover the file.
- **A contrast constraint inherited from 0004:** `secondary-container` / `on-secondary-container`
  has 0.04 of headroom (4.54/4.52 measured). Any state layer on that pair fails AA at 14px/500. A
  queue screen with hoverable rows on a tonal fill will hit this — pick the row treatment with the
  measured numbers in hand.
