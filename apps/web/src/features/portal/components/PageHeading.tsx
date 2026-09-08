"use client";

import { usePathname } from "next/navigation";

type PageHeadingProps = {
  /**
   * `PORTAL_PAGES` from `nav/destinations.ts`, keyed by path.
   *
   * Passed as a prop rather than imported here because a `"use client"` module that imported
   * `nav/destinations.ts` would pull `NAV_DESTINATIONS` — and through it every glyph in
   * `icons.tsx` — into the browser bundle to read a two-entry table. Two strings serialise; a
   * module graph does not have to.
   */
  titles: Readonly<Record<string, string>>;
};

/**
 * The app bar's `<h1>`, titled from the route being displayed.
 *
 * A client component for exactly the reason `DestinationLink` is one, and the same size: the
 * portal layout does not re-render on a soft navigation, so a title computed there reads "Today"
 * on `/settings`. `document.title` follows the route already — this is the visible heading
 * catching up with it.
 *
 * The `claveHQ` fallback is reachable in exactly one way — a portal page added without an entry
 * in `PORTAL_PAGES` — and it is meant to be noticed on the screen rather than swallowed.
 */
export function PageHeading({ titles }: PageHeadingProps) {
  const pathname = usePathname();

  return (
    <h1 className="title-l min-w-0 flex-1 truncate text-on-surface">
      {titles[pathname] ?? "claveHQ"}
    </h1>
  );
}
