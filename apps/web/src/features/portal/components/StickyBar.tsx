"use client";

import type { ReactNode } from "react";
import { useShell } from "./ShellProvider";

// `shrink-0` is load-bearing now that the column scrolls: a flex item in an overflowing column
// shrinks towards its content before the container scrolls, and the bar's tallest content is a
// 48px button — so without it a long page squeezes the 64px bar to 48.
const barBase =
  "sticky top-0 z-10 flex h-16 shrink-0 items-center gap-1 pr-3 " +
  "transition-[background-color,box-shadow] duration-[200ms] ease-[cubic-bezier(0.2,0,0,1)]";

// At the top of the page the bar is exactly what it was before it stuck: one surface with the
// content, no boundary of any kind.
const barAtTop = "bg-surface shadow-none";

// M3's on-scroll step, and the whole reason the bar can stick at all — see the note on the
// component below.
const barScrolled = "bg-surface-container shadow-[var(--md-elev-1)]";

// 4px of leading padding for the 48px hamburger, 16px for the `<h1>` on its own. `max-lg:pl-4`
// keeps the second case below `lg`, where `SidebarToggle` hides itself and the heading would
// otherwise sit 4px from the edge with nothing in front of it — reachable by collapsing the
// drawer at desktop and then narrowing the window.
const barLeadingClosed = "pl-1 max-lg:pl-4";

type StickyBarProps = {
  /**
   * The hamburger, rendered into the leading slot **only while the drawer is closed**.
   *
   * A prop rather than something `TopAppBar` renders inline, because the same `closed` decides
   * two things that have to agree: whether the button is there, and whether the bar's leading
   * padding is the 4px that button wants or the 16px the `<h1>` wants without it. Below `lg`
   * neither happens — see `barLeadingClosed`.
   */
  toggle: ReactNode;
  /** The heading and the trailing controls, rendered by `TopAppBar` on the server. */
  children: ReactNode;
};

/**
 * The app bar's `<header>`: sticky to the content column, and carrying the boundary that lets it
 * be sticky.
 *
 * A client frame for the same reason `DrawerFrame` is one — it styles itself from `ShellProvider`
 * state — with `TopAppBar` staying a Server Component above it.
 *
 * **The tonal step is the boundary, and it is conditional on purpose.** The bar and the page
 * below it are one `surface`, and the drawer's `surface-container-low` is the only tonal step in
 * the shell; a bar with no edge that content slides under reads as content overlapping itself.
 * So the edge appears exactly when there is something underneath: at scroll top the bar is
 * `surface` with no shadow and looks precisely as it did when it did not stick, and past the
 * first pixel it takes M3's step to `surface-container` plus 1dp over 200ms. That is why this is
 * a step rather than the permanent divider the earlier bar refused.
 */
export function StickyBar({ toggle, children }: StickyBarProps) {
  const { closed, scrolled } = useShell();

  return (
    <header
      className={`${barBase} ${scrolled ? barScrolled : barAtTop} ${closed ? barLeadingClosed : "pl-4"}`}
    >
      {closed && toggle}
      {children}
    </header>
  );
}
