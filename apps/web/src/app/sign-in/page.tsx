import type { Metadata } from "next";
import Link from "next/link";
import { Label } from "@/features/landing/components/Label";

export const metadata: Metadata = {
  title: "Sign in — claveHQ",
  description:
    "claveHQ accounts are not open yet. This route is the placeholder the phone-OTP sign-in " +
    "form drops into.",
  // A placeholder route should not be indexed.
  robots: { index: false },
};

// Hero.tsx's ghost CTA class string (design §6.2), duplicated rather than extracted: this
// ticket does not pull a shared CTA component out for one more caller (plan out-of-scope).
const backLinkClasses =
  "mt-[26px] inline-flex min-h-[44px] items-center rounded-[2px] border border-muted " +
  "bg-transparent px-3 font-mono text-[11px] tracking-[.06em] uppercase text-ink " +
  "transition-colors duration-[120ms] ease-[ease] hover:border-accent hover:text-accent";

// Self-contained by design (plan D-G): the masthead's five nav links are #fragment anchors
// that resolve to nothing off `/`, so <Masthead> is not mounted here, and <SiteFooter>'s
// disclaimer is about the landing demo's invented data, not this route. <main> is the only
// landmark; no auth mechanism of any kind lives on this page.
export default function SignInPage() {
  return (
    <main className="mx-auto max-w-[1180px] px-[22px] pt-11 pb-14">
      {/* SiteFooter.tsx:7-9's wordmark markup, made a link. A 15px text link is a ~23px
          target, so the tap box is padded out to 44px — the page's one deliberate
          sub-44px-text link (design §12 N7); the footer's own wordmark stays unlinked. */}
      <Link
        href="/"
        className="inline-flex min-h-[44px] items-center font-display text-[15px] font-extrabold tracking-[-0.03em] hover:text-accent"
      >
        clave<em className="not-italic text-accent">HQ</em>
      </Link>
      <div className="mt-14 mb-5 flex max-w-[56ch] items-center gap-2.5">
        <Label>Access</Label>
        <span className="h-px flex-1 bg-rule-strong" />
      </div>
      {/* Closing-h2 type role, not the hero's h1 scale (design §12 N6): "Sign in" at 62px on
          an otherwise empty page reads as a brochure move. */}
      <h1 className="text-[clamp(27px,4vw,42px)] font-bold tracking-[-0.035em]">Sign in</h1>
      <p className="mt-5 max-w-[56ch] text-[16.5px] text-ink-2">
        Accounts are not open yet. claveHQ signs in by phone OTP once the platform&apos;s backend
        lands; this route is the placeholder that form drops into.
      </p>
      <Link href="/" className={backLinkClasses}>
        Back to claveHQ
      </Link>
    </main>
  );
}
