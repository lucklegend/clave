import { Bricolage_Grotesque, Instrument_Sans, Sometype_Mono } from "next/font/google";

// Self-hosted at build time, so the page costs no round trip to fonts.googleapis.com
// and gets `size-adjust` fallback metrics for free. Each loader exposes a CSS variable
// that `globals.css` folds into --f-display / --f-body / --f-mono with the artifact's
// fallback stack behind it.

// Variable font: no `weight`. The artifact's Google URL also requests the `opsz` and
// `wdth` axes, but nothing in the stylesheet sets `font-optical-sizing`, `font-stretch`
// or `font-variation-settings`, so `axes` is deliberately not passed.
export const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bricolage-grotesque",
});

// Variable font: no `weight`.
export const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument-sans",
});

// Static font: the three weights the artifact requests.
export const sometypeMono = Sometype_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-sometype-mono",
});
