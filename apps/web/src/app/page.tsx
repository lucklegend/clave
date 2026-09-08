import type { Metadata } from "next";
import { AmenitiesSection } from "@/features/landing/components/AmenitiesSection";
import { BillingRun } from "@/features/landing/components/BillingRun";
import { Closing } from "@/features/landing/components/Closing";
import { Hero } from "@/features/landing/components/Hero";
import { Masthead } from "@/features/landing/components/Masthead";
import { ModuleRegister } from "@/features/landing/components/ModuleRegister";
import { SiteFooter } from "@/features/landing/components/SiteFooter";
import { Specs } from "@/features/landing/components/Specs";
import { StatementSection } from "@/features/landing/components/StatementSection";

export const metadata: Metadata = {
  title: "claveHQ — one ledger for the whole village",
  description:
    "Dues, meter-based water and power billing, announcements, maintenance tickets, amenity " +
    "bookings and resident records on a single unit-level record, for HOAs, condo corps and " +
    "site developers.",
};

// The artifact has no landmark structure. <main> is added here: the masthead is the banner
// above it, the footer the contentinfo below it, and everything between — hero, the five
// register sections, the closing block — is the main content.
//
// Every component below is zero-prop. Hero mounts BrandMark, SiteFooter renders its own
// <footer>, and each register section owns its `id` so the four in-page CTAs resolve.
export default function LandingPage() {
  return (
    <>
      <Masthead />
      <main id="main">
        <Hero />
        <StatementSection />
        <ModuleRegister />
        <BillingRun />
        <AmenitiesSection />
        <Specs />
        <Closing />
      </main>
      <SiteFooter />
    </>
  );
}
