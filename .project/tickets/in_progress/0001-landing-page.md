# 0001 — Landing page

**Filed:** 2026-09-05
**Stage:** for_planning

## What was asked

> a landing page like what we made in the
> https://claude.ai/code/artifact/c6f97beb-bf02-474c-9b19-f346c50b254a

## The reference

A finished claveHQ landing page already exists as a published artifact. Full HTML
(89.8 KB, single self-contained file) is saved at:

`C:\Users\luckl\.claude\projects\C--JanFiles-Freedom-project-clavehq\fa4d261a-02c3-4624-99d1-c0e002347bec\tool-results\artifact-c6f97beb-1788260356-918d.html`

Read that file rather than re-fetching the artifact — it is the source of truth for
layout, copy and palette.

### What it contains

|     | Section         | Notes                                                                                        |
| --- | --------------- | -------------------------------------------------------------------------------------------- |
| —   | Masthead        | Wordmark `clave` + green `HQ`, two status pills                                              |
| —   | Hero            | Eyebrow, "One ledger for the whole village.", lede, two CTAs, 4-cell KPI strip, logo mark    |
| 01  | The statement   | Statement card — header, chip, resident/unit line, view toggle, line-item table, total, note |
| 02  | Module register | Table of six modules: code, name, description, action                                        |
| 03  | Billing run     | Five-step pipeline, reading → receipt                                                        |
| 04  | Amenities       | Slot-inventory grid (free / held / booked) plus booking rules                                |
| 05  | Shape of it     | Spec definition list                                                                         |
| —   | Closing         | "The dues are the easy part. The trust is the product."                                      |
| —   | Footer          | Wordmark plus a disclaimer                                                                   |

### Design language to preserve

- **Type:** Bricolage Grotesque (display), Instrument Sans (body), Sometype Mono
  (labels, figures, all tabular numbers). Loaded from Google Fonts.
- **Palette:** paper/ink editorial base with brand green `#8DC63F`; full light and
  dark token sets, keyed off both `prefers-color-scheme` and `data-theme`.
- **Feel:** an operations document, not a SaaS brochure — hairline rules, 1px-gap
  grids, uppercase mono microlabels, tabular figures throughout.
- One `<script>` block drives the statement card's view toggle.
- Honours `prefers-reduced-motion`.
- Logo mark is an inline base64 PNG, in a light and a dark variant.

## What planning has to settle

The repository holds documentation and no code, so this ticket cannot be a
self-contained page edit. Planning has to decide, at minimum:

1. **Where the page lives.** `apps/web` does not exist. Either the monorepo scaffold
   comes first (`docs/HANDOFF.md` build order step 1) and the page is its first
   route, or the page ships standalone and is folded into `apps/web` later. This is
   the decision that sets the size of the ticket.
2. **What the page is for.** Public marketing site, or the signed-out face of the
   resident/admin portal? That decides routing, and whether the CTAs go to a signup
   flow or to an anchor.
3. **Copy: reference or placeholder.** The artifact's figures (4,820 units, 9,640
   statements/mo, D+6 collection lag) are concept numbers. Confirm whether they stay
   as illustrative, get replaced, or get labelled.
4. **How the design language ports.** `docs/CODE_STANDARDS.md` sets Tailwind for
   web; the artifact is hand-written CSS with custom properties. Decide whether the
   tokens become Tailwind theme values or stay as CSS custom properties, since
   `apps/mobile` will need the same tokens through NativeWind later.
5. **The logo mark.** Base64 PNG inline today. Decide on a real asset file, and
   whether the light/dark pair stays two images or becomes one SVG.
6. **Scope of the interactive bits.** The statement toggle and the amenity grid are
   static demonstrations in the artifact. Confirm they stay static on the landing
   page rather than reaching for real data.

## Out of scope until stated otherwise

Supabase, auth, and any live data. This is a page.

---

## Answers — 2026-09-05

The open questions above are settled by the user's second request:

> a landing page from the [artifact] with the given techstack we included in the
> docs/TECH_STACK.md right now focus on Landing page only. Install all necessary
> frontend tools this should be also viewable in the mobile.

1. **Where it lives — settled.** Build on the stack in `docs/TECH_STACK.md`:
   Turborepo + pnpm workspaces, `apps/web` as Next.js + TypeScript. The scaffold
   comes first and the landing page is its first route. Scaffold only as far as the
   landing page needs — this is not the full monorepo build-out.
2. **Frontend tooling — settled.** Install what the page needs: pnpm workspaces,
   Turborepo, Next.js, TypeScript, Tailwind, the shared ESLint/Prettier config in
   `packages/config`. No Supabase client, no TanStack Query, no Zustand — nothing
   on this page fetches.
3. **Scope — landing page only.** No auth, no other routes, no `apps/mobile`, no
   `packages/shared` beyond what the page genuinely imports.
4. **"Viewable in the mobile" — read as responsive web.** The page must work on a
   phone browser, down to a 320px viewport. Building a landing page inside the Expo
   app would be unusual and `apps/mobile` is explicitly out of scope, so this is
   being taken as browser-on-phone. Flagged to the user; say so if it is wrong.
5. **Design language — port to Tailwind.** `docs/CODE_STANDARDS.md` sets Tailwind
   for web. The artifact's CSS custom properties become Tailwind theme tokens where
   that is natural, and stay as custom properties where the light/dark/`data-theme`
   triple-definition needs them. Both themes must survive the port.
6. **Copy and figures — keep as the artifact has them.** The concept figures stay
   as-is for now; replacing them is a separate ticket.
7. **Interactive bits — stay static.** The statement toggle keeps working as a
   client-side toggle. The amenity grid stays a static illustration.

### Confirmed 2026-09-05 (gate)

- **Answer 4 confirmed by the user:** "yes, responsive web is correct". The page is
  built for a phone browser down to 320px. `apps/mobile` stays out of scope.
