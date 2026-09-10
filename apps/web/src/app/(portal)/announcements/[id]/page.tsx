import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AnnouncementView } from "@/features/announcements/components/AnnouncementView";
import { can } from "@/features/authz/permissions";
import { loadAuthzContext } from "@/features/authz/server/context";

export const metadata: Metadata = {
  title: "Announcement — claveHQ",
  // Stays with every authenticated route: an admin console has nothing for a search index.
  robots: { index: false, follow: false },
};

/**
 * The same announcement, as a page.
 *
 * `@modal/(.)[id]/page.tsx` beside this one draws it in a dialog over the board, but interception
 * only happens on a soft navigation. A pasted link, a new tab, a bookmark and a reload are all
 * hard loads, and they arrive here — which is the point of giving the modal a real URL in the
 * first place. Both render the same `AnnouncementView`, so there is one view of an announcement in
 * this codebase and no second one to keep in step.
 *
 * The gate is the board's, repeated: `announcements.create` and `notFound()` when it is missing.
 * See the intercepted route for why it is that key and not `announcements.read`.
 *
 * Dynamic, like everything under `(portal)`, and it must stay that way — no `"use cache"` and no
 * `revalidate`, because the village this page is scoped to comes from the session and not from
 * the URL (ADR 0002 D3).
 */
export default async function AnnouncementPage({ params }: PageProps<"/announcements/[id]">) {
  const result = await loadAuthzContext();

  if (result.status === "signed-out") {
    redirect("/sign-in");
  }

  if (result.status !== "ok") {
    return null;
  }

  const { permissions } = result.context;

  if (!can(permissions, "announcements.create")) {
    notFound();
  }

  const { id } = await params;

  return (
    // The board's own measurements, so a link opened in a new tab lands on a page the same width
    // as the one it came from. The `<h1>` belongs to the app bar, as it does on every portal page.
    <main className="mx-auto w-full max-w-[1180px] px-[22px] pt-11 pb-14">
      <AnnouncementView id={id} permissions={permissions} />
    </main>
  );
}
