"use client";

import type { ReactNode } from "react";
import { useShell } from "./ShellProvider";

// The canvas's measurements. `overflow-hidden` is what lets the width animate at all: the rows
// inside keep their 360px layout while the box closes over them, rather than reflowing through
// every intermediate width. Only `width` and `padding` transition — `visibility` below is a
// discrete property and flips at once, which is the intent.
const frameBase =
  "hidden h-dvh shrink-0 flex-col overflow-hidden bg-surface-container-low lg:flex " +
  "transition-[width,padding] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)]";

const frameOpen = `${frameBase} w-[360px] p-3`;

// `invisible` is the half that is easy to leave out, and it is not a belt-and-braces repeat of
// the width: a 0px-wide `<nav>` still holds its eleven destination buttons in the tab order, so
// a keyboard user would tab through a sidebar that is not on screen. `visibility: hidden` takes
// them out, and the open class restores it by simply not setting it.
const frameClosed = `${frameBase} invisible w-0 p-0`;

type DrawerFrameProps = {
  /** The drawer's whole contents — wordmark, village pill and destination list — from the server. */
  children: ReactNode;
};

/**
 * The drawer's `<nav>`, and the only part of the drawer that knows whether it is open.
 *
 * A client component holding one boolean's worth of styling, wrapped around server output that
 * passes straight through: `NavigationDrawer` stays a Server Component so neither the permission
 * set it filters its rows with nor the destination table reaches the browser. See
 * `ShellProvider`, which owns the boolean.
 *
 * **It collapses to nothing, not to a rail.** That was the choice on the canvas: a rail is a
 * second navigation surface to design, and the hamburger reappears in the app bar's leading
 * slot instead, so the control that hid the sidebar is what brings it back.
 *
 * `hidden lg:flex` is unchanged — below `lg` the drawer is not rendered at all and the toggle
 * goes with it, which is why the collapsed state is only ever reachable at desktop widths.
 */
export function DrawerFrame({ children }: DrawerFrameProps) {
  const { closed } = useShell();

  return (
    // `id` for the two toggles' `aria-controls`: this is the region their `aria-expanded`
    // describes, and it is in the document at every width so the reference always resolves.
    <nav id="portal-drawer" aria-label="Portal" className={closed ? frameClosed : frameOpen}>
      {children}
    </nav>
  );
}
