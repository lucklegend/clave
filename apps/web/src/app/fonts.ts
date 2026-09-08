import { Bricolage_Grotesque, Instrument_Sans, Sometype_Mono } from "next/font/google";

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
