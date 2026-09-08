"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { PortalRoute } from "../nav/destinations";

type DestinationLinkProps = {
  href: PortalRoute;
  /** The row's classes when it is the page being displayed. */
  activeClassName: string;
  /** The row's classes when it is not. */
  inactiveClassName: string;
  /** The glyph and the label, already rendered by the server component that owns the row. */
  children: ReactNode;
};

/**
 * One built destination's link, and the only part of the drawer that knows what the current page
 * is.
 *
 * **It is a client component because a layout is not re-rendered on a client-side navigation
 * between sibling routes in its own group.** `(portal)/layout.tsx` renders once per full page
 * load; clicking the account avatar to `/settings` and back is a soft navigation, so anything the
 * layout computed from the route stays at whatever it was on first paint. Left on the server, the
 * active fill and — worse — `aria-current="page"` would keep pointing at Today from `/settings`,
 * which is not a stale style but a false statement to a screen reader.
 *
 * **What crosses the boundary is `href` and two class strings, and that is the whole point.** The
 * server still decides *which rows exist*: `visibleDestinations` runs in `NavigationDrawer` with
 * the permission set the layout resolved, and neither that set nor the destination table is
 * serialised here. This component only decides *which of the rows it was given is current*, which
 * is a question about the URL and nothing else. The glyph and the label arrive as `children` —
 * already-rendered JSX — so `icons.tsx` stays out of the browser bundle too.
 *
 * `usePathname` rather than a pathname prop: it is correct during the server render *and* it
 * updates on navigation, so seeding it from `src/proxy.ts`'s `x-clavehq-pathname` header would
 * only be a second source for a value this hook already has right on the first paint.
 */
export function DestinationLink({
  href,
  activeClassName,
  inactiveClassName,
  children,
}: DestinationLinkProps) {
  const pathname = usePathname();

  // The prefix arm is for the module pages that will grow detail routes: `/payments/<id>` keeps
  // Payments marked as the current destination, which is what `aria-current="page"` on the row is
  // claiming. `${href}/` and not `href`, so `/settings-archive` never matches `/settings`.
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      // `page`, not `true`: this row is the page being displayed, which is the value that says
      // so. `true` is for the current item in a set that is not a page.
      aria-current={active ? "page" : undefined}
      className={active ? activeClassName : inactiveClassName}
    >
      {children}
    </Link>
  );
}
