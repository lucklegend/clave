import { Bricolage_Grotesque, Instrument_Sans, Sometype_Mono } from "next/font/google";
import localFont from "next/font/local";

// Self-hosted at build time, so the page costs no round trip to fonts.googleapis.com
// and gets `size-adjust` fallback metrics for free. Each loader exposes a CSS variable
// that `globals.css` folds into --f-brand / --f-plain / --f-mono with the M3 type
// scale's fallback stack behind it.

// Variable font: no `weight`. `axes: ["opsz"]` opts into the optical-sizing axis: under
// the M3 type scale this face now runs from 22px (`title-l`) to 57px (`display-l`),
// exactly the range optical sizing exists for, and CSS's default
// `font-optical-sizing: auto` does the rest with no further declaration.
export const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bricolage-grotesque",
  axes: ["opsz"],
});

// Variable font: no `weight`.
export const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument-sans",
});

// Static font: the three weights the M3 type scale requests.
export const sometypeMono = Sometype_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-sometype-mono",
});

// `next/font/local`, not `next/font/google` like the three faces above: Material Symbols is
// served from a separate metadata endpoint (`fonts.google.com/metadata/icons`) that the `google`
// loader never reads, so `Material_Symbols_Outlined` does not exist as an import from
// `next/font/google` — there is no font-data entry to resolve it against. `next/font/local` is
// the fallback the Next.js maintainers point to for exactly this font, and it keeps the same
// shape as the other three: no round trip to fonts.googleapis.com, `display: "swap"`, and a CSS
// variable that `globals.css` reads.
//
// The upstream variable file carries the full ~3,000-glyph set at ~3.9MB; `./fonts/` ships a copy
// subset to only the sixteen codepoints `features/portal/icons.tsx` addresses (~14KB), with
// `fonttools`' `pyftsubset` and no layout features, since codepoint addressing needs no `liga`
// GSUB lookup. Re-run the subset if `icons.tsx` ever adds a codepoint that isn't in it yet —
// `check-utilities.mjs` cannot see a missing glyph, only a missing class.
//
// The four M3 axes (FILL, wght, GRAD, opsz) live on the font, not on this loader: `next/font`
// exposes no per-call-site way to pin a variable axis's default, so `globals.css` sets them once
// on the class every glyph renders through.
export const materialSymbolsOutlined = localFont({
  src: "./fonts/material-symbols-outlined.woff2",
  display: "swap",
  variable: "--font-material-symbols",
});
