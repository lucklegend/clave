import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AnnouncementForm } from "@/features/announcements/components/AnnouncementForm";
import { AttachmentGuidance } from "@/features/announcements/components/AttachmentGuidance";
import { can } from "@/features/authz/permissions";
import { loadAuthzContext } from "@/features/authz/server/context";
import { loadAccountName } from "@/features/portal/server/identity";

export const metadata: Metadata = {
  title: "New announcement — claveHQ",
  // Stays with every authenticated route: an admin console has nothing for a search index.
  robots: { index: false, follow: false },
};

/**
 * Compose an announcement — a full page rather than a dialog, because this repo has no dialog, no
 * focus trap and no date picker, and inventing three of them inside a feature ticket is how a
 * feature ticket becomes a component-library ticket.
 *
 * A Server Component: it resolves the caller, gates the route and reads the display name, then
 * hands a props' worth of that to `AnnouncementForm`, which is the only `"use client"` leaf here.
 *
 * **Gated on `announcements.create`, and `notFound()` rather than a message** — the same
 * reasoning `(portal)/announcements/page.tsx` records for the board: `announcements.read` is
 * seeded to every role, and a 404 does not confirm the route's existence to someone who cannot
 * use it. The action re-checks the capability server-side before it writes; this gate is what
 * keeps the form off the screen in the first place.
 */
export default async function NewAnnouncementPage() {
  const result = await loadAuthzContext();

  if (result.status === "signed-out") {
    redirect("/sign-in");
  }

  if (result.status !== "ok") {
    return null;
  }

  const { permissions, userId, village } = result.context;

  if (!can(permissions, "announcements.create")) {
    notFound();
  }

  // The same read the app bar's avatar makes, memoised by `cache()`, so naming the author here
  // costs no extra round trip.
  const authorName = await loadAccountName(userId);

  return (
    <main className="mx-auto w-full max-w-[1180px] px-[22px] pt-11 pb-14">
      {/* The design's two columns — 680px of form beside a 320px aside — need 1024px of content
          box, and the portal's drawer takes 360 of the viewport before this page sees any of it.
          They only both fit from 1440 up, which is where the design was drawn; below that the
          aside follows the form rather than squeezing it. */}
      <div className="flex flex-col gap-6 min-[1440px]:flex-row min-[1440px]:items-start">
        <div className="min-w-0 min-[1440px]:w-[680px] min-[1440px]:flex-none">
          <h2 className="headline-m text-on-surface">New announcement</h2>
          <p className="body-l mt-2 mb-6 text-on-surface-variant">
            Posting to <strong className="font-medium text-on-surface">{village.name}</strong>.
            Residents see it once its publish time has passed, and not before.
          </p>

          <AnnouncementForm announcement={null} authorName={authorName} />
        </div>

        <div className="min-[1440px]:w-80 min-[1440px]:flex-none">
          <AttachmentGuidance />
        </div>
      </div>
    </main>
  );
}
