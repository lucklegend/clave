import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadAuthzContext } from "@/features/authz/server/context";
import { Label } from "@/features/brand/components/Label";
import { AmenityCalendar } from "@/features/today/components/AmenityCalendar";
import { WorkQueue } from "@/features/today/components/WorkQueue";
import { formatDayLong, manilaToday, toIsoDate } from "@/features/today/month";

export const metadata: Metadata = {
  title: "Today — claveHQ",
  // Stays from the stub this page replaces: an authenticated route has nothing for a search index.
  robots: { index: false, follow: false },
};

/**
 * Today — the portal's landing page, and a deliberately sparse one.
 *
 * **Every section here is built for real and every one of them is empty**, because `payments`,
 * `units`, `bookings`, `reports`, `announcements` and `amenities` do not exist as tables yet:
 * `villages`, `users` and the six RBAC tables are the whole schema. So the work queue shows a
 * dash rather than a count, the money figures show nothing rather than `₱0`, and the calendar —
 * the one thing on the page that needs no table — is drawn in full. That is the decision the
 * ticket took at the gate: a screen that looks live and is not is worse than a sparse one, and
 * each later ticket lights up its own section here.
 *
 * A Server Component with no client half. It reads nothing itself: `loadAuthzContext()` is
 * `cache()`-wrapped, so this call is the same two round trips the layout above already paid for.
 */
export default async function TodayPage() {
  const result = await loadAuthzContext();

  // `(portal)/layout.tsx` already turned a signed-out request away, and this is the layer that
  // does not depend on it having run — the rule `docs/FRONTEND.md` §1 states and `/settings`
  // follows for the same reason.
  if (result.status === "signed-out") {
    redirect("/sign-in");
  }

  // The layout renders its own notice for the other three and never reaches a child, so this is
  // the type checker's narrowing rather than a state a reader can arrive in. There is nothing
  // honest to draw without a village and a permission set, so it draws nothing.
  if (result.status !== "ok") {
    return null;
  }

  const { permissions, village } = result.context;

  // One `new Date()` for the page, so the eyebrow and the calendar cannot disagree across
  // midnight, and Manila's calendar date rather than the server's — see `today/month.ts`.
  const today = manilaToday(new Date());

  return (
    <main className="mx-auto w-full max-w-[1180px] px-[22px] pt-11 pb-14">
      <Label>
        <time dateTime={toIsoDate(today)}>{formatDayLong(today)}</time>
      </Label>

      {/* An `<h2>`: the app bar in `(portal)/layout.tsx` carries this page's `<h1>`, and a second
          one would give the document two. */}
      <h2 className="headline-m mt-2 text-on-surface">Today at {village.name}</h2>
      <p className="body-l mt-3 max-w-[62ch] text-on-surface-variant">
        Every count on this page is read from a real row. The modules behind these queues are not
        built yet, so each shows nothing at all rather than a number it cannot stand behind.
      </p>

      <div className="mt-9 grid items-start gap-6 min-[1280px]:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-9">
          <section aria-labelledby="queue-h">
            <h3 id="queue-h" className="title-m mb-3 text-on-surface">
              Waiting on you
            </h3>
            <WorkQueue permissions={permissions} />
          </section>

          <section aria-labelledby="money-h">
            <h3 id="money-h" className="title-m mb-3 text-on-surface">
              Collections this month
            </h3>
            {/* Three tiles — collected, outstanding, overdue — replaced by one empty state, and
                not by three tiles reading `₱0`. There is no `billing` table, so nothing has been
                billed and nothing could have been collected: zero collected and no data are
                different claims, and only the second one is true. When the figures arrive they
                are formatted the way `StatementCard.tsx` formats money, with
                `Intl.NumberFormat("en-PH")` and the ₱ outside the number so the `num` digits
                stay aligned down the column. */}
            <div className="rounded-m bg-surface-container-highest p-4">
              <p className="label-m text-on-surface-variant">Collected · Outstanding · Overdue</p>
              <p className="body-m mt-1 max-w-[62ch] text-on-surface">
                These three figures come from the billing ledger, and there is no ledger yet.
                Nothing is shown until there is something real to total.
              </p>
            </div>
          </section>
        </div>

        <section aria-labelledby="amenities-h">
          <h3 id="amenities-h" className="title-m mb-3 text-on-surface">
            Amenity bookings
          </h3>
          <AmenityCalendar today={today} />
        </section>
      </div>
    </main>
  );
}
