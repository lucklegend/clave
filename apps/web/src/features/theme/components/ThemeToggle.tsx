"use client";

import { useEffect, useState } from "react";
import { iconButton } from "@/features/brand/cta";
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

// The site's only icon button, and M3 draws one at 48x48 outright — no border, no fill, the
// `m3-state` layer inside `iconButton` doing the whole hover job that a border plus a
// `hover:text-ink` pair used to do. 48 is not this repo's old 44px floor restated: it is M3's
// icon-button spec, and it is the other half of D1, where a *text* button stays painted at 40px
// and reaches 48 through `m3-target`'s expanded hit area instead. Being the tallest thing in the
// masthead, this box is also what sets the band's height, which `RegisterSection`'s `scroll-mt-*`
// is sized against.
//
// `iconButton` states no radius, so this call site states the one the morph needs.
// `m3-morph-round` paints the same 48px circle a full round does, from a pinned 24px — and a
// transition interpolates the *specified* radius, so starting from 9999px would send the spring's
// overshoot to roughly -935px and clamp the corner square mid-press (`globals.css` carries the
// arithmetic). The password reveal, the other `iconButton` caller, does not morph and writes
// `rounded-full`.
//
// Shape, not colour, is what says "pressed" under M3 Expressive. The reduced-motion blanket in
// `globals.css` kills the morph outright and the rest state is the correct static one, so no
// `motion-reduce:` companion is wanted. Unlike the two-state toggle in `StatementCard` this is
// not `overflow-hidden`, so the global `:focus-visible` ring is not clipped at its usual +2px
// offset and needs no inset override.
const buttonClasses = `${iconButton} cursor-pointer m3-morph-round m3-morph active:rounded-m`;

// The site's only iconography. Hand-authored inline SVG rather than an icon package: two glyphs
// do not justify a dependency, and both have to answer to `currentColor`. `aria-hidden` on each,
// because the button already carries the name.
//
// Both are drawn on M3's 24-box grid at the design's 1.6px stroke, not the old 16-box pair scaled
// up: a glyph grid is a design, and 16px geometry enlarged 1.5x lands its strokes off the pixel
// and its rays out of proportion. The `group-hover:fill-current` disc and crescent are gone with
// the `group` — the state layer behind them is the hover affordance now, and a glyph that fills
// on top of it is two signals for one event.
function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="4.6" />
      <path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* One closed path, so the crescent reads the same stroked or filled: the outer edge is the
          long arc of an r8.5 circle, the bite the short arc of an equal circle offset up and to
          the right. The two arcs share both endpoints, so there is no seam to show at 24px. */}
      <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a8.5 8.5 0 0 0 10.7 10.7z" />
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
