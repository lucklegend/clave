"use client";

import { createContext, useContext, useState, type ReactNode, type UIEvent } from "react";

type ShellState = {
  /** Whether the navigation drawer is collapsed to nothing. */
  closed: boolean;
  /** Whether the content column has been scrolled away from its top. */
  scrolled: boolean;
  /** Collapses the drawer, or restores it. Both hamburgers call this one function. */
  toggle: () => void;
};

const ShellContext = createContext<ShellState | null>(null);

type ShellProviderProps = {
  /**
   * `<NavigationDrawer>`, **already rendered on the server**.
   *
   * A prop and not `children` because this component renders the drawer's *sibling* — the
   * scrolling content column — and a sibling cannot be passed as a child. It crosses the
   * boundary exactly the way `children` does: an element prop is rendered by the Server
   * Component that wrote it and arrives here as payload, so the permission set the drawer
   * filtered its rows with never reaches the browser.
   */
  drawer: ReactNode;
  /** The app bar and the page below it, likewise server-rendered. */
  children: ReactNode;
};

/**
 * The portal shell's two pieces of client state — is the drawer closed, has the content
 * scrolled — and the scroll container that answers the second one.
 *
 * **The state lives in a client frame and the content passes through it, rather than the
 * components themselves becoming client components.** `NavigationDrawer` decides *which* rows
 * exist from `visibleDestinations(NAV_DESTINATIONS, permissions)`; making it a client component
 * to hold a boolean would serialise the viewer's whole capability set and the destination table
 * into the browser bundle — the same thing ticket 0007 refused when it rejected
 * `useSelectedLayoutSegment`. So the boolean lives here, `DrawerFrame` and `StickyBar` read it
 * for their own styling, and everything they wrap is server output travelling as payload.
 *
 * Context rather than props threaded down: the two hamburgers, the `<nav>` and the `<header>`
 * are in four different subtrees of the layout, and only the state itself — two booleans and a
 * function — crosses.
 *
 * **This component owns the scroll container, and that is why it renders DOM at all.** The bar
 * sticks to the column, not to the document, so the column is the element whose `scrollTop`
 * decides `scrolled`; a Server Component cannot carry the `onScroll` that reads it.
 */
export function ShellProvider({ drawer, children }: ShellProviderProps) {
  const [closed, setClosed] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  function toggle() {
    setClosed((current) => !current);
  }

  // Called on every scroll frame, and setting a boolean to the value it already holds is a
  // no-op React bails out of — so the re-render happens on the two frames that cross zero and
  // on no others.
  function handleScroll(event: UIEvent<HTMLDivElement>) {
    setScrolled(event.currentTarget.scrollTop > 0);
  }

  return (
    <ShellContext value={{ closed, scrolled, toggle }}>
      {drawer}
      {/* `min-w-0` keeps a wide table or a long unbroken word from pushing this column past the
          drawer; `overflow-y-auto` makes it the scroll container the sticky bar sticks to. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto" onScroll={handleScroll}>
        {children}
      </div>
    </ShellContext>
  );
}

/**
 * The shell state, for the three frames that style themselves from it.
 *
 * The `null` arm is not a state the portal can be in — every caller is rendered inside the
 * provider by `(portal)/layout.tsx` — it is how the context's type narrows to `ShellState`
 * without a non-null assertion, and it turns "rendered this outside the shell" into a message
 * rather than into a silently dead toggle.
 */
export function useShell() {
  const state = useContext(ShellContext);

  if (state === null) {
    throw new Error("useShell was called outside <ShellProvider>.");
  }

  return state;
}
