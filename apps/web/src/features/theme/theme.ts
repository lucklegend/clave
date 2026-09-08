// The whole theme mechanism. The token blocks in `globals.css` already carry it —
// `:root` light, the `prefers-color-scheme: dark` block for System, and the two
// `[data-theme]` overrides — so all this module does is set, clear and remember one
// attribute on <html>. It never touches `style.colorScheme`: every one of those blocks
// declares it, and a second writer of the same property is a race.
//
// No `"use client"`. It is a plain module, importable from a server file (the root layout
// pulls the storage key through `theme-script.ts`) and from a client one alike.

export const THEME_STORAGE_KEY = "clavehq-theme";

export const themeChoices = ["light", "dark", "system"] as const;

export type ThemeChoice = (typeof themeChoices)[number];

const THEME_ATTRIBUTE = "data-theme";

/**
 * The whitelist, on the way in rather than on the way out: a hand-edited or stale storage
 * value must never reach `setAttribute` and write a junk `data-theme`.
 */
export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && themeChoices.some((choice) => choice === value);
}

/**
 * Reading storage throws outright in Safari private mode and on profiles with site storage
 * disabled, so the access is wrapped. Absent, unreadable and invalid all mean System, which
 * is what the page already renders.
 */
export function readStoredTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

/**
 * System is the *absence* of the attribute, so the `prefers-color-scheme` block in
 * `globals.css` decides; light and dark are the explicit overrides that exclude it.
 */
export function applyTheme(choice: ThemeChoice): void {
  if (choice === "system") {
    document.documentElement.removeAttribute(THEME_ATTRIBUTE);
    return;
  }

  document.documentElement.setAttribute(THEME_ATTRIBUTE, choice);
}

export function setTheme(choice: ThemeChoice): void {
  try {
    // Written out rather than deleted, so a deliberate return to System is a value like any
    // other and the pre-paint script has one shape to read.
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage unavailable. The choice still applies for this session, just not the next one;
    // design.md §7.4 chooses silence over a message the user cannot act on.
  }

  applyTheme(choice);
}
