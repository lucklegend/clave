import type { Metadata, Viewport } from "next";
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

// No `data-theme` is set here. The attribute is an override hook the token blocks in
// `globals.css` honour; with it absent the system preference decides.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolageGrotesque.variable} ${instrumentSans.variable} ${sometypeMono.variable}`}
    >
      <body className="bg-paper text-ink">{children}</body>
    </html>
  );
}
