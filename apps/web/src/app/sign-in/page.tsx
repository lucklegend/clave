import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "@/features/brand/components/BrandMark";
import { textButton } from "@/features/brand/cta";
import { SignInForm } from "@/features/auth/components/SignInForm";
import { createSupabaseServerClient } from "@/features/auth/lib/server";

export const metadata: Metadata = {
  title: "Sign in — claveHQ",
  description: "Sign in to the claveHQ portal for your village.",
  // A sign-in form has nothing for a search index and everything for a phishing scrape.
  robots: { index: false, follow: false },
};

const OAUTH_FAILURE_MESSAGE =
  "Google sign-in did not complete. Try again, or sign in with your email and password.";

// Self-contained by design, as the 0002 stub was: <Masthead> is not mounted here because its
// five nav links are `#fragment` anchors that resolve to nothing off `/`, and <SiteFooter>'s
// disclaimer is about the landing demo's invented data. <main> is the only landmark.
//
// `place-items-center` on a `min-h-dvh` grid is what centres the card on both axes without a
// transform or a fixed height — `dvh` rather than `vh` so a mobile browser's collapsing address
// bar does not leave the card scrolled half off-screen.
//
// The card is an M3 card: `surface-container-low` at `--md-shape-xl` with elevation 1, on a
// `surface-container-lowest` page. The two tones and the shadow are the whole separation — there
// is no border, which is what M3 means by a container tone doing structural work. 400px is M3's
// width for a single-column form; the padding drops 32 → 24px below a 400px viewport so the
// 320px floor still leaves a 228px content box.
export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  // Someone already signed in has no use for this page, and leaving it reachable invites them to
  // enter credentials that will be ignored. `getClaims` verifies the JWT rather than trusting
  // the cookie's contents.
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();

  if (claims?.claims !== undefined) {
    redirect("/dashboard");
  }

  const { error } = await searchParams;

  return (
    <main className="grid min-h-dvh place-items-center bg-surface-container-lowest px-[22px] py-12">
      <div className="w-full max-w-[400px] rounded-xl bg-surface-container-low p-6 shadow-[var(--md-elev-1)] min-[400px]:p-8">
        {/* The mark carries the link home that the text wordmark used to, and the wordmark is
            gone — the artwork already sets "claveHQ" and the tagline in type, so the two
            together were the product name twice.

            That makes this the only branding on the page, so unlike the landing hero's copy it
            must have an accessible name: an unlabelled image inside a link leaves a screen
            reader announcing the href. "claveHQ" and not the hero's longer
            "claveHQ — the heartbeat of your community", because a link's name should read as
            its destination rather than as a strapline.

            The size is set through the custom property `globals.css` reads, so this does not
            fight the `.mark` rule for the width — see BrandMark.

            `justify-center` is deliberate and is not the canvas: the design fragment draws this
            mark as a bare block image hard against the card's left padding edge, which would
            decentre a page that is centred today. The mark, the heading and the card all share
            one centre line. */}
        <div className="mb-5 flex justify-center">
          <Link
            href="/"
            className="inline-flex rounded-s transition-opacity duration-[120ms] ease-[ease] hover:opacity-80"
          >
            <BrandMark className="[--mark-width:104px]" label="claveHQ" />
          </Link>
        </div>

        <div className="text-center">
          {/* `headline-s`, not the hero's display scale: "Sign in" at 57px over a 400px card is
              a brochure move on a page that is a utility. */}
          <h1 className="headline-s">Sign in</h1>
          <p className="mt-1.5 body-m text-on-surface-variant">
            The portal for your village&apos;s dues, billing and records.
          </p>
        </div>

        <SignInForm initialError={error === "oauth" ? OAUTH_FAILURE_MESSAGE : undefined} />

        <div className="mt-9 flex justify-center">
          <Link href="/" className={textButton}>
            Back to claveHQ
          </Link>
        </div>
      </div>
    </main>
  );
}
