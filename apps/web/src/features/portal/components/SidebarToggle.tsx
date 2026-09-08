"use client";

import type { ReactNode } from "react";
import { iconButton } from "@/features/brand/cta";
import { useShell } from "./ShellProvider";

// `iconButton` is M3's 48x48 icon button — no fill, no border, `m3-state` doing the hover — and
// states no radius, so this call site states the full round it wants, like both of its siblings.
//
// `max-lg:hidden` rather than a `lg:` display, so it never competes with `iconButton`'s own
// unprefixed `inline-flex`: a variant rule is emitted after an unprefixed one and wins on source
// order, which the other direction cannot rely on. It is what keeps the bar's copy from becoming
// an orphan control — the drawer does not exist below `lg`, so neither may a button that hides
// it, and a window narrowed while the drawer is collapsed is the one way to arrive there.
const buttonClasses = `${iconButton} max-lg:hidden shrink-0 cursor-pointer rounded-full`;

type SidebarToggleProps = {
  /** The `menu` glyph, rendered by the Server Component that placed this button. */
  children: ReactNode;
};

/**
 * The hamburger. One component, rendered twice: in the drawer's header row, and in the app bar's
 * leading slot while the drawer is closed.
 *
 * Both copies read and write the same `closed` through `ShellProvider`, which is what makes them
 * feel like one control that moved rather than two that agree — the button that hid the sidebar
 * is the button that brings it back, in the corner it left from.
 *
 * The glyph arrives as `children` rather than being imported here, for the reason
 * `DestinationLink` gives: an already-rendered element crosses the boundary as payload, so
 * `icons.tsx` stays out of the browser bundle.
 */
export function SidebarToggle({ children }: SidebarToggleProps) {
  const { closed, toggle } = useShell();

  // Icon-only, so the accessible name carries the whole meaning — and it names the *action*,
  // exactly as `ThemeToggle` beside it in the bar does, because the glyph is where a press takes
  // you rather than where you are. `title` gets the same sentence, so a mouse user hovering
  // reads what a screen reader announces.
  const label = closed ? "Show the sidebar" : "Hide the sidebar";

  return (
    <button
      type="button"
      onClick={toggle}
      // The disclosure pair: what this expands, and whether it currently is. `aria-controls`
      // names the `<nav>` in `DrawerFrame`, which is in the document at every width.
      aria-controls="portal-drawer"
      aria-expanded={!closed}
      aria-label={label}
      title={label}
      className={buttonClasses}
    >
      {children}
    </button>
  );
}
