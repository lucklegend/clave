import type { Metadata, Viewport } from "next";
import { themeInitScript } from "@/features/theme/theme-script";
import { bricolageGrotesque, instrumentSans, sometypeMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  // Concept build: no domain is registered yet, so this origin is a placeholder
  // that only resolves relative metadata URLs.
  metadataBase: new URL("https://clavehq.com"),
  title: "claveHQ",
  description:
    "claveHQ runs dues, meter-based water and power billing, announcements, maintenance " +
    "tickets, amenity bookings and resident records on a single unit-level record.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// `data-theme` is stamped on <html> before first paint by the inline script below, out of the
// choice held in localStorage. The attribute is the override hook the token blocks in
// `globals.css` honour; it stays absent when that choice is System, and the system preference
// decides as it always has.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // `motion-safe:scroll-smooth` sits here because <html> is the element that scrolls, so it is
      // the only place a fragment jump reads `scroll-behavior` from. `motion-safe:` is load-bearing
      // rather than decorative: the reduced-motion blanket at `globals.css:210-215` suppresses
      // `transition` and `animation` and nothing else, so a bare `scroll-smooth` would keep
      // animating the page for the readers most likely to be hurt by it.
      className={`${bricolageGrotesque.variable} ${instrumentSans.variable} ${sometypeMono.variable} motion-safe:scroll-smooth`}
      // How Next declares that the smooth scrolling above is deliberate; without it the dev
      // overlay warns once per client-side route transition. Dev noise only — a production build
      // logs nothing and already lands a route change at the top on the first frame — but an
      // unexplained warning is a warning the next reader has to chase. The attribute states the
      // intent; `motion-safe:` on the class is still the only thing gating the behaviour on the
      // reader's motion preference, and neither stands in for the other.
      data-scroll-behavior="smooth"
      // Covers the `data-theme` attribute the script adds before React hydrates. It suppresses
      // this element's own attributes only, not its subtree.
      suppressHydrationWarning
    >
      <head>
        {/* In <head> and parser-blocking on purpose — never `defer`, never `async`, never
            `next/script`, and never below the content. As the first child of <body> the parser
            could paint the body background, already resolved from the OS media query, in the
            window before this ran: a ~120ms wrong-theme frame, reproduced in 2 of 10 trials at
            20x CPU throttling in both directions. Nothing paints before <head> is processed, so
            here the window does not exist. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-surface text-on-surface">{children}</body>
    </html>
  );
}
