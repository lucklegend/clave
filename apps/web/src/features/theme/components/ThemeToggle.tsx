"use client";

import { useEffect, useState } from "react";
import { applyTheme, readStoredTheme, setTheme, type ThemeChoice } from "../theme";

// The two themes the button switches between. `system` stays the stored default until the first
// press; it is simply never one of the destinations this control offers.
type ResolvedTheme = Exclude<ThemeChoice, "system">;

type ThemeState = {
  choice: ThemeChoice;
  /** What `system` resolves to right now. The glyph is a destination, so it depends on this. */
  prefersDark: boolean;
};

const DARK_QUERY = "(prefers-color-scheme: dark)";

// The button is icon-only, so its accessible name carries the whole meaning — and it names the
// *action*, because the glyph is where a press takes you and not where you are. `title` gets the
// same sentence, so a mouse user hovering the icon reads what a screen reader announces.
const actionLabels = {
  light: "Switch to light theme",
  dark: "Switch to dark theme",
} satisfies Record<ResolvedTheme, string>;

// Paired with the Sign in ghost button beside it: same 2px radius, same `--muted` border — never
// `--rule-strong`, which is 2.08:1 light / 1.82:1 dark on this `--surface` band and fails WCAG
// 1.4.11 for the boundary of a UI component — and the same 120ms colour transition, which the
// reduced-motion blanket in `globals.css` removes outright. There is no transform end-state left
// over, so no `motion-reduce:` companion is wanted. `group` is what lets the glyph fill on hover.
// 44px square is the tap target: the icon is 16px and would otherwise be a 16px one. Unlike the
// two-state toggle in `StatementCard` this is not `overflow-hidden`, so the global
// `:focus-visible` ring is not clipped at its usual +2px offset and needs no inset override.
const buttonClasses =
  "group inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center " +
  "rounded-[2px] border border-muted bg-transparent text-muted transition-colors " +
  "duration-[120ms] ease-[ease] hover:text-ink";

// The site's first iconography. Hand-authored inline SVG rather than an icon package: two glyphs
// do not justify a dependency, and both have to answer to `currentColor` and to one hover class.
// `aria-hidden` on each, because the button already carries the name.
function SunIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Only the disc takes the hover fill. Filling the rays as well would close the gaps
          between them and turn the glyph into a blob at 16px. */}
      <circle cx="8" cy="8" r="3.5" className="group-hover:fill-current" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M12.95 3.05l-1.06 1.06M4.11 11.89l-1.06 1.06" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* One closed path, so the crescent reads the same stroked or filled: the outer edge is the
          long arc of the circle centred (8,8) r5.5, the bite the short arc of the equal circle
          centred (12.125,3.875). They meet at the two intersection points, so there is no seam. */}
      <path
        d="M13.36 9.23A5.5 5.5 0 1 1 6.77 2.64A5.5 5.5 0 0 0 13.36 9.23Z"
        className="group-hover:fill-current"
      />
    </svg>
  );
}

function resolveTheme({ choice, prefersDark }: ThemeState) {
  if (choice === "system") {
    return prefersDark ? "dark" : "light";
  }

  return choice;
}

/**
 * One button, cycling light ↔ dark. The site's second and last client component: local UI state
 * for one control with no other consumer, so `useState` and not a store
 * (`docs/CODE_STANDARDS.md:39`).
 */
export function ThemeToggle() {
  // `system` on a light `:root` is the server render, because System is the majority case. A user
  // who chose otherwise gets one corrected frame in the glyph — the *page* is already the right
  // colour, stamped before paint by the inline script in the layout.
  const [state, setState] = useState<ThemeState>({ choice: "system", prefersDark: false });

  // Neither storage nor `matchMedia` can be read during render without an impure render or a
  // hydration mismatch on the glyph, so both are read on mount and the state corrected there.
  // `useSyncExternalStore` is deliberately not used: nothing outside React mutates the choice.
  useEffect(() => {
    const stored = readStoredTheme();
    const query = window.matchMedia(DARK_QUERY);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- one correction, see above
    setState({ choice: stored, prefersDark: query.matches });
    // Belt and braces: if the pre-paint script is ever blocked, this still applies the choice.
    applyTheme(stored);

    // Subscribed, where the plan put an OS listener out of scope, because the glyph now shows what
    // `system` *resolves* to: an OS flipping light/dark under an open tab would strand it pointing
    // at the theme the page is already in. It matters only until the first press.
    function handlePreferenceChange(event: MediaQueryListEvent) {
      setState((current) => ({ ...current, prefersDark: event.matches }));
    }

    query.addEventListener("change", handlePreferenceChange);
    return () => query.removeEventListener("change", handlePreferenceChange);
  }, []);

  const target = resolveTheme(state) === "dark" ? "light" : "dark";

  function handleClick() {
    setTheme(target);
    setState((current) => ({ ...current, choice: target }));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={actionLabels[target]}
      title={actionLabels[target]}
      className={buttonClasses}
    >
      {target === "light" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
