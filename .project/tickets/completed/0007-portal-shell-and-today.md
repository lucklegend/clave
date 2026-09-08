# 0007 — Admin portal shell and the Today dashboard

**Filed:** 2026-09-08
**Stage:** in_progress — planned in plan mode and approved by the user before filing, so this
ticket skipped `for_planning` / `planning` / `ready`.

## What was asked

> can we create plan for this and create the Dashboard - today. the existing dashboard can be
> move to settings

Said on 2026-09-08 against the published M3 design canvas
(`https://claude.ai/code/artifact/68df7d4c-e1b4-45dc-9054-99b13047d010`), after ticket 0004 shipped
Material 3 to the three built surfaces.

## The plan

`.agent-work/0007-portal-shell-and-today/plan.md` — nine steps (S1–S9), decisions, verification and
seven named risks. Approved by the user in plan mode.

## Decisions the user took at the gate

1. **Today's data: real, with empty states.** No fixtures. A screen that looks live and is not is
   worse than a sparse one.
2. **Routes: `/dashboard` stays and becomes Today; `/settings` takes the current dashboard's
   content.** Flat URLs, no `/v/[village]` segment.
3. **Village scope: server-resolved** from `users.village_id`. No cookie, no URL segment — so the
   switcher pill displays but does not switch. A real scope boundary, deferred to its own ticket.
4. **Nav gating on two independent axes**: lacking the capability _hides_ a destination; not yet
   built _disables_ it.
5. **Icons: Material Symbols** via `next/font`, addressed by codepoint rather than ligature.
6. **The route guard inverts to deny-by-default.**

## Where the design lives

The canvas artboards `Main.dc.html` (the shell) and `Payments.dc.html` (ticket 0006's queue) were
extracted during planning; every measurement this ticket needs is quoted in `plan.md` §S6 and §S7.
The canvas itself is a published artifact and the scratchpad copy will not survive the session.

## Security-sensitive steps

**S1** and **S4** both are, and for unrelated reasons — see `plan.md`. S1 carries a fix to the
existing function grants in `20260906120000_identity_and_rbac.sql`; S4 inverts the route guard and
turns the proxy matcher into a security boundary in both directions.

---

## Delivered — 2026-09-08

The admin portal shell and the Today dashboard. Nine planned steps (S1–S9, with S8 folded into S6 to
avoid a race), plus two correction rounds after code and security review.

### The thing that mattered most, and it was not the feature

**S1 found and closed a live vulnerability.** `20260906120000_identity_and_rbac.sql:485-488` revoked
the four `SECURITY DEFINER` helpers from `anon` only. `CREATE FUNCTION` grants `EXECUTE` to
`PUBLIC`, and revoking from a role does not remove a `PUBLIC` grant — so `anon` inherited it.
Reproduced against the running stack: all four answered over PostgREST with the anon key that ships
in the browser bundle. `user_has_permission` with `users.manage` and a named user id returned
`true`, HTTP 200, unauthenticated. `current_village_ids` was the worst — not a boolean oracle but a
direct handover of a named user's village ids, the join key for everything else. A control request
against `/rest/v1/users` correctly returned `42501`, which proves table RLS was fine and only the
function grants were wrong.

Fixed for all five functions: revoke from `public, anon`, then grant execute to `authenticated`
only. The security reviewer reproduced the Postgres semantics in a throwaway database and confirmed
the fix; the works-check confirmed it independently.

**The lesson, in one line: revoking a function from `anon` is not sufficient — it must be from
`public`.**

Ticket 0004's security review did not catch this because its scope was the M3 diff and the hole was
in 0003's migration. The authenticated half of the same problem is filed as ticket **0008**.

### Decisions the diff does not explain

- **`user_permission_keys` takes no `p_user`.** A set-returning `SECURITY DEFINER` function that
  answers for an arbitrary user id is a bulk permission-disclosure endpoint. It also diverges from
  `user_has_permission` deliberately: for a super admin the scalar returns **true** for a key that
  is not in the catalogue (its super-admin branch fires before any existence check), while the set
  function returns **false** (its super-admin term enumerates `public.permissions`). Both verified.
  They are not interchangeable.
- **Village scope is server-resolved** — no cookie, no URL segment. This contradicts the Zustand
  sentence in `CLAUDE.md`, which assumes a client-rendered app that does not exist. Consequence: the
  village pill states which village you are in and cannot switch. Constraint bought: every portal
  route must stay dynamically rendered.
- **The route guard inverted to deny-by-default.** An allow-list of protected paths fails open; the
  cost of forgetting is now a redirect loop rather than silent exposure. `/auth/callback` must stay
  named public or Google sign-in loops forever — the callback arrives with a PKCE code and no
  session cookie yet.
- **The active nav destination takes no state layer.** `m3-state` on a `secondary-container` fill
  erases the fill, and the obvious alternative drops the label to 4.13:1 against a 4.5 floor —
  ticket 0004 measured that pair at 4.54/4.52, 0.04 of headroom.
- **Two axes of gating, modelled differently.** A capability the viewer lacks _hides_ a destination;
  a feature not yet built _disables_ it with `aria-disabled` on a focusable non-link, never HTML
  `disabled` (which would remove it from the tab order and hide the roadmap from screen-reader
  users). Ten of eleven are disabled today. That is the rule working, not a bug.
- **No fixtures anywhere.** Every Today section renders an honest empty state: em-dashes rather than
  counts, no zero-peso figure where there is no billing table, no permanently-lit notification dot,
  no inert month arrows. Several steps refused a drawn-but-dead control on this reasoning.
- **Dates are pinned to Manila**, not the server clock. PH is UTC+8 with no DST; a UTC host would
  render "yesterday" after 4pm Manila, in production only.

### Five places the plan was wrong

1. **A Next 16 layout cannot see its own route** — it gets `params` and `children`, and no request
   header carries the path. Solved first with a proxy-stamped header, then superseded: the shell's
   active state moved to two small client leaves reading `usePathname()`, because a layout does not
   re-render on soft navigation either (CR-1). The header was removed once it had no reader.
2. **Typed routes do not type a `Link` href** in this configuration — a route that does not exist
   still compiles. The `Destination` union shipped anyway, with the guarantee re-derived from a
   `PortalRoute` key map.
3. **`next/font/google` cannot load Material Symbols** — this repo's `next@16.3.4` font manifest has
   1,942 families and none match; Google serves icon metadata from a different endpoint. Shipped
   via `next/font/local`, subset 3.9MB to 14KB, addressed by codepoint so no ligature word flashes.
4. **Keeping "Settings" a planned destination orphaned `/settings`**, where the only sign-out form
   now lives. The account avatar became the link.
5. **The "410 lines" figure for `globals.css` never reproduced** — the honest count is 612, and only
   the `@theme inline` block is covered by the config exemption; the `m3-*` utilities are authored
   CSS kept in one file solely because both checker scripts hardcode the path.

### Infrastructure fixed along the way

**`check:theme` and `check:permissions` were being served from turbo cache and not running.** Turbo
hashes the declaring package's files, but both scripts read across packages — `check-utilities.mjs`
scans `apps/web/src`, and the permissions checker reads `supabase/migrations/`. A change in
`apps/web` did not invalidate the cache, silently disarming the safety net ticket 0004 built to
replace the build check that turned out not to exist. Both are now uncached.

### Verification

Build, typecheck, lint, `check:theme` (108 tokens, 23 contrast pairs, 360 candidates),
`check:permissions` (28 keys both directions) and prettier all green.

**Works-check: WORKS.** Real browser against a production build with Supabase up. Eleven
destinations, one live, ten `aria-disabled` and all ten keyboard-reachable by a sequential Tab walk;
no hover state layer on the active row; the drawer scrolls internally at an 850px viewport; glyphs
resolve to private-use-area codepoints, never words; the month grid highlights 8 September 2026.

**Code review: 10 findings** (1 high, 2 medium, 7 low), all actioned. The high one — the shell going
stale on client navigation — was real and reachable on the portal's only client link.

**Security review: CLEARED WITH NOTES.** One substantive finding, SEC-1, marked pre-existing and
filed as ticket 0008.

**The merge gate did not run.** The repo still has no test runner, and adding one remains a separate
scope decision. `nav/select.ts` and `features/authz/permissions.ts` are pure functions and are the
obvious first tests when a runner lands — `CODE_STANDARDS.md` section 6 names access checks as a
money path.

### Known gaps, deliberate

- The village pill cannot switch. Needs its own ticket and a scope mechanism.
- **No navigation below `lg`** — the drawer is `hidden lg:flex`; the canvas's modal drawer and 80px
  bottom bar are unbuilt. `/settings` has an `lg:hidden` link back so nobody is stranded, but the
  village name is invisible on a phone.
- The three authz fallback screens (no-villages, no-access, unavailable) have never been exercised
  against a real database — no village-less account exists to test with.
