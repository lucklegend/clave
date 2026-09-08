import type { Village } from "@/features/authz/types";

// `village_tier`'s two values as the pill shows them. `satisfies` rather than an annotation, so
// adding a tier to the enum and regenerating `database.ts` fails here instead of rendering the
// raw `tier_1`.
const tierLabels = {
  free: "Free",
  tier_1: "Tier 1",
} satisfies Record<Village["tier"], string>;

type VillagePillProps = {
  village: Village;
};

/**
 * Which village the portal is scoped to: a statement of fact at the top of the drawer, not a
 * control.
 *
 * **It displays and it does not switch, and that is a recorded scope boundary rather than an
 * unfinished control.** The village is resolved on the server from `users.village_id` with no
 * cookie and no `/v/[village]` URL segment (`features/authz/server/context.ts`), so there is
 * nowhere for a selection to live — a switcher here would have to invent one, and which
 * mechanism it invents is what decides whether the portal's routes can stay flat. That is its
 * own ticket.
 *
 * So the canvas's trailing chevron is **deliberately not drawn**, and neither is the button it
 * belongs to. A chevron-down is the universal promise of a menu that opens; drawing one over a
 * scope that cannot change speaks only to the sighted mouse user, and tells them something
 * untrue. That is the same call the app bar made on the unread dot it could only ever light
 * permanently, and the amenity card on the booking dots and the legend for them: an affordance
 * for a thing that does not exist yet makes the portal look live where it is not. It arrives
 * with the switcher.
 *
 * A `<div>` and not a `<button>` for the same reason — a control that cannot act should not take
 * focus, sit in the tab order or announce itself as pressable — and `outline-variant` rather than
 * `outline` now that this is not a UI component at all: D4 rule 1 in
 * `docs/decisions/0001-material-3.md` reserves `outline` for a component boundary and makes
 * `outline-variant` the decorative one, which is the border every static outlined container on
 * Today already draws.
 */
export function VillagePill({ village }: VillagePillProps) {
  return (
    <div className="flex h-10 w-full items-center gap-2 rounded-full border border-outline-variant px-4">
      {/* `min-w-0` plus `truncate` is what keeps a long village name from pushing the tier tag
          out of a 336px pill. */}
      <span className="label-l min-w-0 flex-1 truncate text-on-surface">{village.name}</span>
      <span className="label-s shrink-0 text-on-surface-variant">{tierLabels[village.tier]}</span>
    </div>
  );
}
